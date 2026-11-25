"""Temporary isolated probe; never merge this research branch."""
import re
from urllib.parse import urljoin,urlparse
import requests
from bs4 import BeautifulSoup

def test_public_boost_helper_probe():
    url="https://fconline.nexon.com/DataCenter/PlayerGrow?n1Strong=1&spid=240020801"
    s=requests.Session()
    s.headers.update({"User-Agent":"Mozilla/5.0 (compatible; FIFAGOSU-DataBot/1.0)","Accept-Language":"ko-KR,ko;q=0.9"})
    r=s.get(url,timeout=25)
    print("PAGE",r.status_code,len(r.content))
    r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    for x in soup.select("script[src]"):
        print("SCRIPT",urljoin(url,x["src"]))
    for x in soup.select("script:not([src])"):
        t=x.get_text()
        if re.search(r"grow|boost|material",t,re.I):
            for line in t.splitlines():
                if re.search(r"grow|boost|material|\.ajax|\.post",line,re.I):
                    print("INLINE",line.strip()[:500])
    candidates=[]
    for x in soup.select("script[src]"):
        u=urljoin(url,x["src"])
        if re.search(r"datacenter|playergrow|boost",u,re.I) and urlparse(u).hostname in {"fconline.nexon.com","ssl.nexon.com","fco.vod.nexoncdn.co.kr","s.nx.com","static.nexon.com"}:
            candidates.append(u)
    for u in candidates[:4]:
        a=s.get(u,timeout=20);print("JS",u,a.status_code,len(a.content))
        if a.status_code in (403,429): break
        if not a.ok: continue
        for m in list(re.finditer(r"PlayerGrow|GrowMaterial|BoostGauge|GrowPoint|growPoint|boostRate|\.ajax\(",a.text,re.I))[:35]:
            print("MATCH",a.text[max(0,m.start()-100):m.end()+220].replace("\n"," ")[:340])
    assert False,"RESEARCH OUTPUT ONLY — not a production test"
