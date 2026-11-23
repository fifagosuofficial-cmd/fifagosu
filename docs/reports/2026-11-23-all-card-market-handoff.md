# 피파고수 전체 카드 시장 집계 인계

작성일: 2026-11-23 (한국 시간)

## 현재 상태

- 급등·급락 목록과 시장지수를 랭커 표본에서 **전체 수집 선수카드의 날짜별 시세 이력** 기준으로 변경했어요. 시장지수는 1강 유효 카드의 7일 변화율 중앙값이며, 3만 BP 미만은 제외하고 표본 30장 이상일 때 표시해요.
- 인기 카드 시세만 공식 1:1 상위 랭커 사용량 표본을 계속 사용해요. 랭커 시세 그래프를 카드마다 다시 요청하던 작업은 중지했어요.
- 전체 카드 이력은 기존 hist를 초기 자료로 옮긴 뒤 market/all_card_history/에 날짜별로 저장해요. 기존 부분 수집 보호 규칙은 유지하고, 별도 이력에는 실제 갱신된 카드만 기록해요.
- 현재 수집 카탈로그는 약 74,351장입니다. 다만 실제 7일 변화를 계산하려면 각 카드에 유효한 시작일과 종료일 가격이 있어야 해요.

## 데이터 누적 현황

- 저장된 일자는 2026-11-21, 2026-11-22, 2026-11-23으로 **3/8일**이에요.
- 날짜별 갱신 카드 수는 각각 28,358장, 48,073장, 35,060장이에요. 마지막 정기 크롤 작업은 성공했어요.
- 현재 시장지수 유효 표본은 0/30장이며, 7일 비교 기간이 아직 채워지지 않아 급등·급락 목록도 비어 있어요. 홈에는 전체 카드 이력 누적 상태가 표시됩니다. 현재 빈 목록은 오류가 아니라 이력 수집 중 상태예요.
- 7일 비교에는 최소 8개 날짜 기록이 필요해요. 매일 수집이 정상 완료되면 **빠르면 11월 28일 새벽 정기 수집 이후** 첫 전체 카드 주간 집계가 가능해요. 카드별 최신 이력이 충분하지 않으면 일부 카드나 지수가 더 늦게 채워질 수 있어요.
- 매일 새벽 03:17 KST에 crawl-and-deploy가 예정되어 있고, Actions 대기열에 따라 실제 시작은 늦어질 수 있어요.

## 배포 및 저장소

- main 최신 커밋: a0a118f — Keep partial all-card history separately
- data 최신 커밋(확인 시점): 1ffabc9
- Cloudflare Pages 배포와 자동 점검 모두 성공했어요. [배포 기록](https://github.com/fifagosuofficial-cmd/fifagosu/actions/runs/45043718316) · [자동 점검](https://github.com/fifagosuofficial-cmd/fifagosu/actions/runs/45043718315)
- main 푸시는 사이트 빌드·Cloudflare Pages 배포를 시작해요. 일일 크롤러는 data 브랜치에 이력을 저장한 다음 새 데이터로 사이트를 배포해요.

## 다음 작업

1. 일일 crawl-and-deploy 성공 여부와 data/market/all_card_history_dates.json의 날짜·갱신량을 확인해요.
2. 8개 날짜 기록이 쌓인 뒤 data/market/summary.json에서 indexSample, index, 1·5·8강 급등·급락 목록을 확인해요.
3. 표본 30장 이상이 되면 시장지수 표시와 전체 카드 급등·급락 집계가 정상인지 확인해요. 인기 카드 목록은 랭커 기준으로 별도 확인해요.
4. 일일 수집이 계속 성공하는데도 유효 표본이 부족하면 카드별 시작·종료일 가격, 3만 BP 기준, 전체 선수 목록 갱신 범위를 살펴봐요.

## 작업 시 주의

- 작업 중인 저장소는 C:\Users\hanky\Documents\Codex\2026-11-22\referenced-chatgpt-conversation-this-is-an\work\relation-teamcolor-deploy, 브랜치는 codex/market-history-ranker-popularity예요.
- 지정된 Desktop 저장소 C:\Users\hanky\OneDrive\Desktop\FIFAGOSU\fifagosu는 현재 origin/main보다 19개 커밋 뒤이며, 사용자 변경사항이 있어요: crawler/derive.py, docs/HANDOFF.md, site/assets/css/main.css, site/assets/js/app.js. 이 변경을 덮어쓰거나 무심코 병합하지 마세요.
- .github/workflows/*.yml은 보호 파일이에요. 기존 docs/HANDOFF.md도 덮어쓰지 마세요. 이 인계 문서는 별도 보고서로 작성됐고 아직 커밋하지 않았어요.
- 변경을 main에 올릴 때는 기존 배포 흐름을 따르고, data 브랜치의 수집 이력도 보존하세요.
