# 피파고수 인수인계 메모 (2026-11-22 오후 갱신)

새 대화에서는 이 파일과 CLAUDE.md만 먼저 읽고 시작하세요.

## 작업 방식 (토큰 절약)
- 작업 폴더: `C:\Users\hanky\OneDrive\Desktop\FIFAGOSU\fifagosu` (GitHub Desktop으로 받은 git 폴더). 예전 `fifagosu-repo_1`은 쓰지 않음.
- AI는 이 폴더 파일만 고친다 → 대표가 GitHub Desktop에서 Commit → Push → GitHub Actions가 Cloudflare Pages에 자동 배포(1~2분).
- GitHub 웹 편집기에 코드 붙여넣기 금지(토큰 폭증). 스크린샷·실사이트 확인은 배포 직후 1번만.
- 요청은 묶어서 받고, 작업 전 예상 시간을 먼저 말한다.

## 구조 요약
- 사이트: https://fifagosu.pages.dev (저장소 fifagosuofficial-cmd/fifagosu, 브랜치 main)
- `site/build.py` + `site/templates/*.html` → 정적 사이트. SPA 뷰: home·diag·cards·calc·guide·sim·trade (`site/templates/index.html`, `site/assets/js/app.js`, 시뮬은 `sim.js`, 선수장터는 `trade.js`)
- 별도 페이지: `/news/`(소식), `/patch/`(패치노트, `patch.html`), `/guide/*`(게임 가이드)
- `functions/api/[[path]].js`: 넥슨 Open API 중계 + `/api/prob`(넥슨 확률 공개 iteminfo) + `/api/shop`(웹 상점 `/Shop/List` 탭1·3) + `/api/shop?pid=`(상품 상세 구성품), 6시간 캐시
- `functions/api/trade.js`: 선수장터 API (Cloudflare D1, 바인딩 이름 `TRADE_DB`, 표 자동 생성)
- 수집: `.github/workflows/crawl.yml` (매일 03:17 KST, 저장소 변수 CRAWL_MINUTES=300), `crawler/fgcrawl.py`(데이터센터) → `crawler/derive.py`(시장 요약 `market/summary.json`, 시세 풀 `market/pool.json`, 팀컬러 등) → data 브랜치 → 배포
- 소식 수집: `news.yml` 하루 4번
- 테마: 흰 배경 + 민트(`--accent:#00C775`), 로고 배경 없음

## 최근 완료
- (11-22) 시뮬 개편: 판매 조건 바 공통 + 4탭(강화 효율 · 강화 시뮬 · 팩 오픈 · 현질 효율). FC INFO 효율/계산기 벤치마킹, 보고서 `docs/reports/2026-11-22-시뮬개편-선수장터.md`
- (11-22) 패키지 구성품 해결: 상점 상세 페이지(로그인 불필요)의 구성품 → 확률표 연결. 교환권(크리스탈 참여권·삼지선다 펜)만 제외
- (11-22) 선수장터 `/trade/` 신설: 선수 검색·선택, 판매/구매희망가, 시세 대비 %, 비번으로 완료·삭제. D1 `fifagosu-trade` 만들고 Pages 바인딩 `TRADE_DB`(Production) 연결 완료
- (11-22 저녁) 강화 시뮬 '이번 강화 손익'을 누적(시작 카드값+재료비 누적)으로, 재료비는 BP 숫자 입력+한글 단위 표시, 시뮬 상단에 '추정값' 안내 문구
- (11-22 밤) 전적 진단 개편: 상단 요약(경기별 득실 막대·승패 점·핵심 수치) + '피파고수의 한마디'(약점·흐름·랭커 비교 자동 조언) + 컴팩트 약점 카드, 전체 경기 기록은 접기. 감독모드는 선수별 기록이 첫 화면, 선수별 승률 추가. 넥슨 `/fconline/v1/ranker-stats`(TOP 10,000 랭커가 같은 선수·포지션으로 뛴 20경기 평균, 감독모드도 지원)를 API 중계에 열고, 경기당 기록이 랭커 평균 70% 미만이면 빨간 숫자+! (마우스 올리면 설명)
- (11-22) 이번엔 GitHub 웹 업로드로 커밋함 → 로컬 GitHub Desktop에 변경이 보이면 'Fetch origin → Pull' 하면 같아짐
- 홈 = 오늘의 시장 브리핑(급등·급락·인기, 시장지수, 신규 카드) + 공지·해외축구 뉴스
- 선수 정보창: 데이터센터식 배치, 강화 1~13 버튼, 소속 팀컬러·강화 물결(동→은→금→백금)·관계 팀컬러, 적응도, OVR 탭 = 전 포지션 경기장(선호 포지션 외는 추정값)
- 전적 진단: 닉네임 옆 역대 최고 등급 아이콘(ico_rank0~20, DIVISION 순서와 같음)
- 시뮬 탭: 강화(선수 검색·능력치·시세 반영, 2,000회 통계) / 팩 오픈(상점 진열, 카드 뒤집기, BP·선수 가치, TOP CLASS·PC방·쿠폰 수익 계산)
- 패치노트 게시판 신설, 패치 가이드 → 게임 가이드로 이름 변경
- 능력치 수집 가속: 시세는 상한(인기 20분·전체 45분), 남는 시간 능력치. 10일 정도 지나 다 차면 CRAWL_MINUTES를 50으로 되돌리기

## 남은 일 / 확인할 것
1. 11-23 새벽 수집 후 확인: `market/summary.json`·`pool.json` 생성 → 홈 급등·급락, 팩 오픈 선수 이름, 강화 효율 TOP, 현질 효율 선수 가치가 채워지는지 (11-22 수집은 market 단계 추가 전 코드로 돌아서 비어 있었음)
2. 배포 후 실사이트에서 새 시뮬 4탭 + 선수장터 한 번씩 눌러 보기 (로컬 Playwright로만 확인함)
3. 현질 효율 정확도(11-22 저녁 개선): 확률표 행 이름의 클래스 목록 + (선수×강화) 조합 순위 + 1강 OVR 조건으로 바꿔 FC INFO와 비교 시 ±5% 안(예: 26UP·UC 310 → 8.85억 vs 8.77억, 26UP 1435 → 934만 vs 959만). 시세 풀이 상위 8천 장뿐이라 저강 대형 팩 6종(26PL 5500, SPT 6530 등)은 부족했는데, derive.py를 '시세 있는 카드 전부'로 바꿔서 **11-23 새벽 수집 후** 맞춰짐 → 확인 필요. 교환권(크리스탈 참여권·삼지선다 펜) BP 환산은 아직
4. 능력치 수집 완료 후 CRAWL_MINUTES 50으로 복귀
5. 마스터플랜 잔여: 넥슨 서비스 단계 키 신청, 데이터 이용 문의, 광고 준비
