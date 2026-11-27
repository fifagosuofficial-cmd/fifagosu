import { DurableObject } from "cloudflare:workers";
// No messages or identities stored here: this object broadcasts invalidations only.
// Only a same-origin Pages function with the namespace binding can call it.
export class ChatHub extends DurableObject {
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if(path==="/socket"&&request.headers.get("Upgrade")?.toLowerCase()==="websocket"){
      if(this.ctx.getWebSockets().length>=1000)return new Response("Room full",{status:503});
      const pair=new WebSocketPair(),client=pair[0],server=pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null,{status:101,webSocket:client});
    }
    if(path==="/notify"&&request.method==="POST"){
      for(const ws of this.ctx.getWebSockets()){try{ws.send("changed")}catch{try{ws.close(1011,"Reconnect")}catch{}}}
      return new Response(null,{status:204});
    }
    return new Response("Not found",{status:404});
  }
  webSocketMessage(ws){ws.close(1008,"Read-only connection")}
  webSocketClose(ws,code){try{ws.close(code,"Closed")}catch{}}
  webSocketError(ws){try{ws.close(1011,"Reconnect")}catch{}}
}
export default {fetch(){return new Response("Not found",{status:404})}};
