import requests,time
def test_probe():
    for spid,grade in [(100004000,1),(100004000,8),(100004000,12),(840004000,5)]:
        try:
            r=requests.get("https://fifagosu.com/api/boost",params={"spid":spid,"grade":grade},timeout=35)
            d=r.json()
            p=d.get("plan")
            print("LIVE",spid,grade,r.status_code,"PLAN",p,"REASON",d.get("reason"),"CODE",d.get("code"))
            assert r.status_code==200
            if p:
                assert p["gauge"]==100 and p["official"] and len(p["cards"])<=5
                assert p["cost"]==sum(c["price"] for c in p["cards"])
            else: assert d.get("reason") in ("no_full_combo","not_verified")
            time.sleep(2)
        except Exception as e:
            print("ERROR",type(e).__name__,str(e)[:180]);raise
