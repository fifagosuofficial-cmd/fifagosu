import requests
def test_probe():
    for host,path in [("fifagosu.com","/"),("fifagosu.com","/api/community/me"),("fifagosu.com","/api/boost?spid=100004000&grade=1"),("fifagosu.pages.dev","/api/boost?spid=100004000&grade=1")]:
        try:
            r=requests.get("https://"+host+path,timeout=25)
            print("LIVE",host,path,r.status_code,r.headers.get("content-type"),r.text[:450] if "json" in r.headers.get("content-type","") else r.text[:250])
        except Exception as e:print("ERROR",type(e).__name__,str(e)[:180])
    assert False,"research output only"
