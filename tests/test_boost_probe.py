import time,requests
def test_probe():
    s=requests.Session();base="https://fconline.nexon.com"
    s.headers.update({"User-Agent":"Mozilla/5.0 (compatible; FIFAGOSU-DataBot/1.0)","X-Requested-With":"XMLHttpRequest","Referer":base+"/DataCenter/PlayerGrow","Accept-Language":"ko-KR,ko;q=0.9"})
    r=s.get(base+"/DataCenter/PlayerGrow",timeout=20);print("PAGE",r.status_code);r.raise_for_status()
    for endpoint,data in [
        ("PlayerGrowInit",{"spid":100004000,"n1Strong":1}),
        ("PlayerGrowCalApi",{"idx":1,"n8SpId":"100004000","n1Strong":"1","strCalinfo":",124,","n4BoostPer":0}),
        ("PlayerGrowCalApi",{"idx":1,"n8SpId":"100004000","n1Strong":"1","strCalinfo":",124,124,124,124,124,","n4BoostPer":0}),
        ("RecommendOVRList",{"n8SpId":100004000,"n1Strong":1,"n4BoostPer":0}),
        ("RecommendGrowUnionList",{"n8SpId":100004000,"n1Strong":1,"n4BoostPer":0}),
        ("PlayerGrowCalApi",{"idx":1,"n8SpId":"100004000","n1Strong":"4","strCalinfo":",128,","n4BoostPer":0})]:
        time.sleep(1.5);r=s.post(base+"/datacenter/"+endpoint,data=data,timeout=20);print("RESPONSE",endpoint,data,r.status_code,r.text[:12000])
        if r.status_code in (403,429):break
    assert False,"research output only"
