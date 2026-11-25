import re,time,requests
from urllib.parse import urljoin
def test_probe():
    base="https://ssl.nexon.com/s1/fc/online/obt/buildUpSimulator/"
    r=requests.get(base+"app.js",timeout=20);r.raise_for_status();print("LOADER",r.text)
    names=set(re.findall(r'["\']([\w./-]+\.js)(?:\?[^"\']*)?["\']',r.text))
    for name in sorted(names)[:4]:
        if name.endswith("app.js"):continue
        u=urljoin(base,name);time.sleep(1.5)
        a=requests.get(u,timeout=20);print("BUNDLE",u,a.status_code,len(a.content))
        if not a.ok:continue
        t=a.text
        for pat in [r'(?i)(?:/api/|/datacenter/)[\w/.-]+',r'(?i)boost(?:point|rate|gauge)|growpoint|materialovr|n1Strong|n4Ovr|buildup',r'(?i)gauge|percentage|Math\.pow|Math\.round|Math\.ceil|소모 선수|강화 확률']:
            hits=list(re.finditer(pat,t));print("PAT",pat,len(hits))
            seen=set()
            for m in hits:
                chunk=t[max(0,m.start()-180):m.end()+250].replace("\n"," ")
                if chunk in seen:continue
                seen.add(chunk)
                if len(seen)>30:break
                print("MATCH",chunk)
    assert False,"research output only"
