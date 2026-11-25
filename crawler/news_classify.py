"""Football-only press classification shared by collection and site builds."""
import html
import re

VERSION = 2
LABELS = {"world": "해외축구", "korea": "국내축구", "fcgame": "FC온라인 기사"}
GAME_PATTERN = r"FC\s*온라인|피파\s*온라인|FIFA\s*Online|FC\s*Online"
def rx(s):
    return re.compile(s, re.I)

GAME = rx(GAME_PATTERN)
NONFOOT = rx(r"NBA|WNBA|KBL|WKBL|MLB|KBO|NPB|UFC|ATP|WTA|윔블던|테니스|배구|농구|야구|격투기|복싱|골프|F1\b|포뮬러|아이스하키|배드민턴|탁구|3점슛|홈런|타율|마이너리그|옥타곤|파이터|마카체프|김연경|야닉 시너|알카라스|영화|드라마|배우|연예|예능|스크린|종영|시청률|포스터 공개|Y현장|Y터뷰|신병 더 무비|결혼식|열애|이혼|레드카펫|흑백요리사|김새롬|블랙야크|스마트 체육관|스포츠·공연|겨울용")
CAT_EXCLUDE = rx(r"야구|농구|배구|테니스|격투|골프|모터스포츠|연예|방송|영화|드라마|라이프|생활|패션|문화|정치|경제|종합스포츠|기타스포츠|일반스포츠|스포츠일반|e스포츠|게임")
CAT_DOMESTIC = rx(r"국내\s*축구|한국\s*축구|K리그|K League|국가대표\s*축구|아마추어\s*축구|여자\s*축구")
CAT_WORLD = rx(r"해외\s*축구|외국\s*축구|유럽\s*축구|국제\s*축구|해외리그|프리미어리그|EPL|라리가|분데스리가|세리에\s*A|리그앙|MLS")
CAT_FOOT = rx(r"축구|football|soccer|K리그|K League|EPL|라리가|분데스리가|세리에\s*A|리그앙|MLS|UCL|UEL")
K_COMP = rx(r"K\s*리그\s*[1-7]?|K\s*League\s*[1-7]?|\bK[1-7]\b|W?코리아\s*컵|WK\s*리그|한국프로축구연맹|한국대학축구연맹|대한축구협회|\bKFA\b|케터뷰|디비전리그")
K_CLUB = rx(r"울산\s*(?:HD|현대)|전북\s*(?:현대|모터스)|포항\s*(?:스틸러스|스틸야드)|FC\s*서울|서울\s*이랜드|수원\s*(?:삼성|FC)|대구\s*FC|광주\s*FC|강원\s*FC|제주\s*(?:SK|유나이티드)|인천\s*유나이티드|대전\s*하나|김천\s*상무|경남\s*FC|부천\s*FC|안양\s*FC|충남\s*아산|충북\s*청주|천안\s*시티|성남\s*FC|부산\s*아이파크|용인\s*FC|화성\s*FC|파주\s*(?:FC|시민)|세종스포츠토토")
K_SHORT = rx(r"(?:^|[\s\[\(‘“\"'·…])(?:울산|전북|포항|수원|대구|광주|강원|제주|인천|대전|김천|경남|부천|안양|천안|성남|용인|화성|파주)(?=$|[\s,·:’”\"'!?\]\)]|전|은|는|이|가|의|서|에|과|도|을|를|으로|다운)")
K_LOCAL = rx(r"이정효|황선홍|정정용|차두리|이영민|김성재\s*(?:감독|대행)|김현준호|이근호\s*선수협|엄원상|이순민|주앙\s*빅토르|밥신|지소연|김혜리|윤덕여|박길영|팬\s*프렌들리")
K_NATIONAL = rx(r"(?:한국|대한민국|韓)\s*(?:남자\s*|여자\s*)?(?:축구\s*)?(?:U[- ]?(?:1[5-9]|2[0-3])|[12]\d세\s*이하)\s*(?:축구|대표|월드컵)|(?:한국|대한민국)\s*(?:남자\s*|여자\s*)?(?:축구\s*)?대표팀|모레노호|홍명보호|김현준호|대한축구협회|\bKFA\b")
K_NATIONAL_EVENT = rx(r"(?:한국|대한민국|韓).{0,35}(?:U[- ]?(?:1[5-9]|2[0-3])\s*월드컵|대표팀\s*(?:소집|명단|평가전|훈련|감독)|A매치\s*(?:명단|소집|평가전)|월드컵\s*예선)")
K_INTL = rx(r"\bACLE\b|\bACL2\b|아시아\s*챔피언스리그|AFC\s*챔피언스리그")
WORLD_LEAGUES = (
    ("UCL·UEL", rx(r"\bUCL\b|\bUEL\b|유럽\s*챔피언스리그|챔피언스리그|챔스|유로파\s*리그|컨퍼런스\s*리그")),
    ("MLS", rx(r"\bMLS\b|MLS컵|LAFC|인터\s*마이애미|LA\s*갤럭시|세인트루이스|신시내티")),
    ("EPL", rx(r"\bEPL\b|\bPL\b|프리미어리그|Premier League|맨체스터\s*(?:시티|유나이티드)|맨시티|맨유|토트넘|리버풀|첼시|아스널|아스날|뉴캐슬|애스턴\s*빌라|브라이턴|웨스트햄|풀럼|입스위치")),
    ("라리가", rx(r"라리가|La Liga|바르셀로나|레알(?:\s*마드리드)?|아틀레티코|\bATM\b|헤타페|세비야|비야레알|발렌시아")),
    ("분데스리가", rx(r"분데스리가|Bundesliga|뮌헨|도르트문트|레버쿠젠|라이프치히|프랑크푸르트|샬케|볼프스부르크|쾰른")),
    ("세리에A", rx(r"세리에\s*A|Serie A|유벤투스|인터\s*밀란|인테르|AC\s*밀란|나폴리|AS\s*로마|아탈란타")),
    ("리그앙", rx(r"리그\s*앙|Ligue\s*1|파리\s*생제르맹|\bPSG\b|마르세유|모나코|릴\s*OSC|스트라스부르")),
    ("J리그", rx(r"J\s*리그|\bJ[123]\s*리그|가시마|감바\s*오사카|우라와|요코하마\s*마리노스")),
    ("해외 국가대표", rx(r"월드컵|네이션스컵|네이션스리그|\bUNL\b|유로\s*20\d\d|아시안컵|코파\s*아메리카|A매치")),
)
OTHER_WORLD = rx(r"레인저스|셀틱|페예노르트|미트윌란|브뢴비|베식타스|트라브존스포르|스파르타크\s*모스크바|포르투|스완지|스토크|옥스퍼드|비킹|알\s*나스르|스코틀랜드\s*리그|덴마크\s*리그|손흥민|이강인|김민재|황희찬|황인범|정상빈|오현규|양민혁|조규성|이한범|김승규|설영우|배준호|양현준|엄지성|홍현석|전진우|카스트로프|포체티노|시메오네|무리뉴|벨링엄|비니시우스|호날두|홀란드|음바페|레반도프스키|그리즈만|더\s*브라위너|레니\s*요로|데\s*제르비|마레스카|쿠르투아|우파메카노|히샬리송|카세미루")
FOOT = rx(r"축구|football|soccer|골키퍼|센터백|풀백|윙백|미드필더|스트라이커|공격수|수비수|결승골|선제골|동점골|역전골|멀티골|자책골|데뷔골|원더골|슈퍼골|페널티킥|승점|오프사이드|키패스|킬패스|드리블|태클|슈팅|골문|후반\s*추가시간|득점왕|발롱도르|이적시장|이적설|강등권|유니폼|축구협회|FIFA|FIFPRO|UEFA|AFC|월드컵|\bU[- ]?1[5-9]\b|\bU[- ]?2[0-3]\b")
LOCAL_CONTEXT = rx(r"축구|구단|선수|감독|단장|홈경기|원정|득점|골|경기|승격|강등|은퇴식|재계약|플레이오프|클럽|유니폼|연맹|기부")
CLUB_CONTEXT = rx(r"소속팀|친정팀|클럽|구단|리그|입단|이적|재계약|벤치|선발|교체|경기|감독|훈련|골|득점")

def plain(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()

def classify_league(title, category):
    if category == "korea":
        if K_INTL.search(title):
            return "ACLE·ACL2"
        if rx(r"W?코리아\s*컵").search(title):
            return "코리아컵"
        if rx(r"K\s*리그\s*1|K\s*League\s*1|\bK1\b").search(title):
            return "K리그1"
        if rx(r"K\s*리그\s*2|K\s*League\s*2|\bK2\b").search(title):
            return "K리그2"
        if K_NATIONAL.search(title) or K_NATIONAL_EVENT.search(title) or rx(r"국가대표|대표팀|KFA|축구협회|U[- ]?\d{2}\s*월드컵").search(title):
            return "국가대표"
        if K_COMP.search(title) or K_CLUB.search(title) or K_SHORT.search(title) or K_LOCAL.search(title):
            return "K리그"
    elif category == "world":
        for label, pattern in WORLD_LEAGUES:
            if pattern.search(title):
                return label
    return "기타"

def classify_article(title, categories=(), description="", base="football"):
    """Return (category, league), or None. RSS descriptions are transient evidence."""
    title = plain(title)
    sections = " ".join(plain(x) for x in categories if x)
    desc = plain(description)[:500]
    if not title or title.startswith(("[포토]", "[영상]")):
        return None
    if GAME.search(title):
        return ("fcgame", "기타")
    if base == "fcgame":
        return None
    domestic_section = CAT_DOMESTIC.search(sections)
    world_section = CAT_WORLD.search(sections)
    football_section = CAT_FOOT.search(sections)
    if CAT_EXCLUDE.search(sections) and not football_section:
        return None
    domestic_strong = bool(K_COMP.search(title) or K_CLUB.search(title))
    domestic_weak = bool(K_LOCAL.search(title) or (K_SHORT.search(title) and LOCAL_CONTEXT.search(title)))
    world_club = any(p.search(title) for label, p in WORLD_LEAGUES if label != "해외 국가대표")
    world_player = OTHER_WORLD.search(title)
    football = bool(domestic_strong or domestic_weak or world_club or world_player or FOOT.search(title)
                    or K_INTL.search(title) or K_NATIONAL.search(title) or K_NATIONAL_EVENT.search(title))
    if NONFOOT.search(title) and not (domestic_strong or (world_club and FOOT.search(title))
                                     or (world_player and CLUB_CONTEXT.search(title) and FOOT.search(title))
                                     or (FOOT.search(title) and rx(r"축구|U[- ]?\d{2}|FIFA|UEFA|AFC").search(title))):
        return None
    if domestic_strong or (K_INTL.search(title) and domestic_weak):
        cat = "korea"
    elif world_club:
        cat = "world"
    elif K_NATIONAL.search(title) or K_NATIONAL_EVENT.search(title):
        cat = "world" if world_player and rx(r"소속팀|현지|독일|잉글랜드|유럽|스페인|일본\s*리그").search(title) else "korea"
    elif domestic_section or domestic_weak:
        cat = "korea"
    elif world_section:
        cat = "world"
    elif football:
        if K_INTL.search(title) and K_LOCAL.search(desc):
            cat = "korea"
        elif not world_player and (K_COMP.search(desc) or K_CLUB.search(desc)):
            cat = "korea"
        else:
            cat = "world"
    elif football_section or FOOT.search(desc) or K_COMP.search(desc) or K_CLUB.search(desc) or any(p.search(desc) for _, p in WORLD_LEAGUES):
        if NONFOOT.search(title):
            return None
        cat = "korea" if K_COMP.search(desc) or K_CLUB.search(desc) or K_NATIONAL.search(desc) else "world"
    else:
        return None
    league = classify_league(title, cat)
    if league == "기타" and desc:
        league = classify_league(desc, cat)
    return cat, league

def clean_news_items(items):
    """Reclassify legacy press records; preserve official items and validated RSS records."""
    result, seen = [], set()
    for original in items:
        item = dict(original)
        if item.get("kind") != "press" and item.get("cat") not in LABELS:
            result.append(item)
            continue
        if item.get("topicVersion") == VERSION and item.get("cat") in LABELS:
            classified = item["cat"], item.get("league") or "기타"
        else:
            classified = classify_article(item.get("title", ""), base="fcgame" if item.get("cat") == "fcgame" else "football")
        if not classified:
            continue
        cat, league = classified
        key = re.sub(r"[\W_]+", "", plain(item.get("title", "")).casefold())
        if key in seen:
            continue
        seen.add(key)
        item.update(cat=cat, league=league, label=LABELS[cat], summary=[], topicVersion=VERSION)
        result.append(item)
    return result
