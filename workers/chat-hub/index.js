import { DurableObject } from "cloudflare:workers";
// Only rate-limit metadata is stored. Message text is broadcast, never written to storage.
export class ChatHub extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec("CREATE TABLE IF NOT EXISTS chat_rate_v2(author TEXT NOT NULL,t INTEGER NOT NULL)");this.sql.exec("CREATE INDEX IF NOT EXISTS chat_rate_time ON chat_rate_v2(t)");this.sql.exec("CREATE INDEX IF NOT EXISTS chat_rate_author ON chat_rate_v2(author,t)")}
  send(data,tag){const text=JSON.stringify(data);for(const ws of this.ctx.getWebSockets(tag)){try{ws.send(text)}catch{try{ws.close(1011,"Reconnect")}catch{}}}}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if((path==="/socket"||path==="/socket-v2")&&request.headers.get("Upgrade")?.toLowerCase()==="websocket"){
      if(this.ctx.getWebSockets().length>=1000)return new Response("Room full",{status:503});
      const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],[path==="/socket-v2"?"v2":"v1"]);return new Response(null,{status:101,webSocket:pair[0]});
    }
    if(path==="/notify"&&request.method==="POST"){for(const ws of this.ctx.getWebSockets("v1")){try{ws.send("changed")}catch{}}return new Response(null,{status:204})}
    if(path==="/broadcast"&&request.method==="POST"){
      const event=await request.json(),x=event.message;
      if(event.type!=="message"||typeof x?.author!=="string"||!/^[0-9a-f]{64}$/.test(x.author))return new Response("Invalid",{status:400});
      const t=Math.floor(Date.now()/1000);
      this.sql.exec("DELETE FROM chat_rate_v2 WHERE t<=?",t-60);
      const recent=this.sql.exec("SELECT count(*) n,MAX(t) last FROM chat_rate_v2 WHERE author=?",x.author).one();
      if(recent.n>=10||(recent.last!==null&&recent.last>t-5))return new Response("Rate limited",{status:429});
      this.sql.exec("INSERT INTO chat_rate_v2(author,t) VALUES(?,?)",x.author,t);
      this.send(event,"v2");await this.ctx.storage.setAlarm(Date.now()+65000);return new Response(null,{status:204});
    }
    if(path==="/moderate"&&request.method==="POST"){const event=await request.json();if(event.type!=="moderation")return new Response("Invalid",{status:400});this.send(event,"v2");return new Response(null,{status:204})}
    return new Response("Not found",{status:404});
  }
  async alarm(){this.sql.exec("DELETE FROM chat_rate_v2 WHERE t<=?",Math.floor(Date.now()/1000)-60);if(this.sql.exec("SELECT count(*) n FROM chat_rate_v2").one().n)await this.ctx.storage.setAlarm(Date.now()+65000)}
  webSocketMessage(ws){ws.close(1008,"Read-only connection")}
  webSocketClose(ws,code){try{ws.close(code,"Closed")}catch{}}
  webSocketError(ws){try{ws.close(1011,"Reconnect")}catch{}}
}
export default {fetch(){return new Response("Not found",{status:404})}};
