# 피파고수

FC온라인 전적 진단 + 전체 카드 검색(OVR·세부 능력치·강화별 시세) 사이트예요.

- **전적·카드 목록·시즌 배지·선수 이미지**: 넥슨 Open API
- **OVR·능력치·강화별 시세**: FC온라인 데이터센터를 매일 수집 (GitHub Actions)

## 폴더 구조
```
site/                         사이트 소스 → python site/build.py --data data --out dist 로 빌드
  config.json                 SITE_URL(주소) 한 곳 관리
index.html                    (옛 단일 파일, 이제 안 씀 — 백업)
crawler/rules/                강화·팀컬러 규칙표(사람이 관리, 출처·확인일 기록)
crawler/verify_grade.py       강화 능력치 검증·감시
functions/api/[[path]].js     넥슨 Open API 중계 (API 키 숨김 + 캐시)
crawler/fgcrawl.py            데이터센터 수집기
tests/                        수집기 테스트 (실제 응답 형식 기준)
.github/workflows/crawl.yml   매일 수집 → data 브랜치 저장 → Cloudflare Pages 배포
```
수집 결과는 `main`이 아니라 **`data` 브랜치**에 최신본 1개만 저장돼요(시세가 매일 바뀌어서 기록을 쌓으면 저장소가 금방 커지기 때문).

## 데이터가 쌓이는 방식
| 종류 | 출처 요청 | 갱신 주기 |
|---|---|---|
| OVR·포지션·급여·주발·강화 1~13 시세·평점 | `/datacenter/PlayerList` (한 번에 최대 200장, OVR·급여·출생연도 범위로 쪼개서 전부 받음) | 인기 시즌은 매일, 전체 시즌은 주 1회(여러 날에 나눠 진행) |
| 세부 능력치 34개·특성·신체·클럽 경력 | `/datacenter/PlayerPreView` (카드 1장씩) | 아직 없는 카드만, 많이 쓰이는 카드부터 |

- 요청 사이에 **1.5초 이상** 쉬어요(`FG_DELAY`). 403·429가 3번 연속 오면 받은 것만 저장하고 멈춰요.
- 하루 50분 기준으로 세부 능력치는 하루 수백~천여 장씩 늘어요. 처음 한 번은 수동 실행으로 300분 정도 돌려 두면 인기 카드가 빨리 채워져요.
- 파일: `data/index.json`(검색용 요약), `data/list/{spid%200}.json`, `data/detail/{spid%200}.json`

## 처음 설정 (약 20분)
1. **GitHub 저장소 만들기** — 공개 저장소를 권장해요(Actions 무료·무제한). 비공개면 월 2,000분 한도라 하루 50분 정도가 적당해요.
2. 이 폴더 전체를 `main` 브랜치에 올려요.
3. **넥슨 API 키**: https://openapi.nexon.com → 내 애플리케이션에서 발급. 공개 전에는 서비스 단계 키를 신청하세요.
4. **Cloudflare**
   - Workers & Pages → Pages → **직접 업로드**로 `fifagosu` 프로젝트를 만들어요(빈 폴더 하나 올려도 됨).
   - 프로젝트 설정 → 환경 변수에 `NEXON_API_KEY`를 **암호화**로 추가해요.
   - 내 프로필 → API 토큰 → "Cloudflare Pages 편집" 권한 토큰을 만들고, 계정 ID를 복사해요.
5. **GitHub 저장소 → Settings → Secrets and variables → Actions**
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - (선택) Variables: `CRAWL_MINUTES` = 전체 카드 일일 수집 시간(분, 기본 300)
6. **Actions → crawl-and-deploy → Run workflow**, minutes에 `300`을 넣고 처음 실행해요.
7. 끝나면 `https://fifagosu.pages.dev`에서 카드 검색 → 카드 클릭 → 능력치·시세가 나오는지 확인해요.

이후에는 매일 03:17(한국 시간)에 자동으로 돌아요. 사이트 코드(`index.html` 등)를 고쳐서 `main`에 올리면 수집 없이 배포만 돼요.

## 넥슨이 해외 IP를 막는 경우
GitHub Actions 서버는 해외에 있어요. 수집 단계 로그에 "차단 신호"나 연결 오류가 계속 나오면 **내 PC를 실행기로** 쓰면 돼요.
1. PC에 Python 3.12와 Git 설치
2. GitHub 저장소 → Settings → Actions → Runners → **New self-hosted runner** (Windows) 안내대로 설치
3. `crawl.yml`의 `runs-on: ubuntu-latest`를 `runs-on: self-hosted`로 바꾸기
PC가 켜져 있을 때만 수집돼요. `actions/setup-python` 단계는 PC에 Python이 있으면 지워도 돼요.

## 직접 실행
```
pip install -r crawler/requirements.txt
python crawler/fgcrawl.py list --mode hot --minutes 10   # 인기 시즌 시세
python crawler/fgcrawl.py detail --max 200               # 세부 능력치 200장
python crawler/fgcrawl.py index                          # 검색용 인덱스
pytest -q tests                                          # 파서 테스트
```

## 주의
- 데이터센터 수집은 넥슨 Open API 약관이 허용하는 범위 밖이에요. 넥슨이 중단을 요청하거나 차단하면 바로 멈추고, 공개·광고 전에 넥슨 1:1 문의로 허가를 받아 두는 걸 권해요.
- 데이터센터 화면 구조가 바뀌면 수집이 0장이 될 수 있어요. 그럴 땐 `tests/`가 실패하는지 보고 `parse_list`·`parse_preview`를 고치면 돼요.
- 미리보기용 데이터(`FG_SNAP_RAW`, `FG_PREVIEW_CARDS`, `FG_PREVIEW_DATA`)는 배포 사이트에서 쓰이지 않아요.
