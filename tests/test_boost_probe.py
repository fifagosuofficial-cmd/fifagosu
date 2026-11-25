"""Temporary public helper probe, not for production."""
import re
import requests

def test_public_boost_helper_probe():
    u="https://ssl.nexon.com/s1/fc/online/obt/buildUpSimulator/app.js"
    r=requests.get(u,timeout=25);print("JS",r.status_code,len(r.content));r.raise_for_status()
    t=r.text
    # Print only bounded contexts, public endpoints and arithmetic-related symbols.
    for pat in [r"/[Dd]ata[Cc]enter/[^'\x22\s,;]+",r"(?i)growpoint|boostpoint|boostrate|boostgauge|buildup|materialovr|n1Strong|n4Ovr|\.ajax\(",r"(?i)gauge|percentage|Math\.pow|Math\.round|Math\.ceil"]:
        hits=list(re.finditer(pat,t))
        print("PAT",pat,len(hits))
        seen=set()
        for m in hits:
            chunk=t[max(0,m.start()-110):m.end()+160].replace("\n"," ")
            if chunk in seen:continue
            seen.add(chunk)
            if len(seen)>45:break
            print("MATCH",chunk)
    assert False,"RESEARCH OUTPUT ONLY"
