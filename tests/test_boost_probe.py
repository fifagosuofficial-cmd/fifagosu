import requests
def test_probe():
    for grade in [1,8]:
        r=requests.get("https://fifagosu.com/api/boost",params={"spid":100004000,"grade":grade},timeout=40)
        print("LIVE",grade,r.status_code,r.text[:3000])
        if r.status_code in (403,429):break
    assert False,"research output only"
