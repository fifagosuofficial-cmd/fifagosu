"""Add one Durable Object binding; never print secrets or other settings."""
import json, os, urllib.request
base="https://api.cloudflare.com/client/v4/accounts/"+os.environ["CLOUDFLARE_ACCOUNT_ID"]
def call(path, method="GET", payload=None):
    request=urllib.request.Request(base+path,method=method,headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],"Content-Type":"application/json"},data=json.dumps(payload).encode() if payload is not None else None)
    with urllib.request.urlopen(request,timeout=30) as response:
        body=json.load(response)
    if not body.get("success"):
        raise RuntimeError("Cloudflare API request failed")
    return body["result"]
names=call("/workers/durable_objects/namespaces?per_page=1000")
matches=[x["id"] for x in names if x.get("script")=="fifagosu-chat-hub" and x.get("class")=="ChatHub"]
if len(matches)!=1:
    raise RuntimeError("Expected exactly one ChatHub namespace")
path="/pages/projects/fifagosu"
config=call(path)["deployment_configs"]["production"]
bindings=dict(config.get("durable_object_namespaces") or {})
if "CHAT_HUB" in bindings and bindings["CHAT_HUB"]["namespace_id"]!=matches[0]:
    raise RuntimeError("Existing CHAT_HUB binding differs; refusing to replace")
bindings["CHAT_HUB"]={"namespace_id":matches[0]}
call(path,"PATCH",{"deployment_configs":{"production":{"durable_object_namespaces":bindings}}})
verified=call(path)["deployment_configs"]["production"]
assert verified["durable_object_namespaces"]["CHAT_HUB"]["namespace_id"]==matches[0]
assert verified.get("d1_databases")==config.get("d1_databases"),"D1 bindings changed unexpectedly"
assert set(verified.get("env_vars") or {})==set(config.get("env_vars") or {}),"Environment keys changed unexpectedly"
print("Production CHAT_HUB binding verified")
