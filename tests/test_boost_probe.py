import requests
def test_probe():
    for host in ["fifagosu.pages.dev","fifagosu.com"]:
        try:
            r=requests.get("https://"+host+"/api/boost",params={"spid":100004000,"grade":1},timeout=40)
            print("LIVE",host,r.status_code,r.headers.get("content-type"),r.text[:1200])
        except Exception as e: print("ERROR",type(e).__name__,str(e)[:180])
    assert False,"diagnostic output only"
