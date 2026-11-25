import time,requests
def test_probe():
    base="https://fconline.nexon.com"
    headers={"User-Agent":"Mozilla/5.0 (compatible; FIFAGOSU-DataBot/1.0)","X-Requested-With":"XMLHttpRequest","Origin":base,"Referer":base+"/DataCenter/PlayerGrow","Accept-Language":"ko-KR,ko;q=0.9"}
    for grade in [1,8,12]:
        r=requests.post(base+"/datacenter/RecommendOVRList",data={"n8SpId":100004000,"n1Strong":grade,"n4BoostPer":0},headers=headers,timeout=15)
        print("OVR",grade,r.status_code)
        if not r.ok:break
        j=r.json()
        if isinstance(j,list):print("ROWS",[(x.get("ovr"),x.get("stretc"),x.get("monthly_average_price")) for x in j])
        else:print("SHAPE",str(j)[:500])
        time.sleep(1.5)
    r=requests.post(base+"/datacenter/PlayerGrowCalApi",data={"idx":1,"n8SpId":"100004000","n1Strong":"1","strCalinfo":",124,124,","n4BoostPer":0},headers=headers,timeout=15)
    print("CAL",r.status_code, {k:r.json().get(k) for k in ["strBoostPer","strBoostPer2","n8TotalPrice"]} if r.ok else "")
    assert False,"research output only"
