# 회원 개인정보 보완 및 운영 확인 사항

2026-11-26 KST. 코드 개선은 법적 적합성 인증이 아니다.

- 가입 시 수집·이용 목적/항목/기간/거부권과 불이익 표시. 선택 구단주명 별도 확인. 기존 회원 v1을 허위로 소급 기록하지 않고 실제 재동의 시 v2와 시각을 기록. 탈퇴 시 동의 기록 cascade. 이전 환경 변수 v1도 기존 운영 활성화 설정으로 호환하며 신규 동의는 v2만 허용.
- D1 정리는 인증 완료/재동의/관리자 조회 때 실행. 별도 Cron Trigger 또는 권한 검증된 스케줄러를 연결해야 유휴 기간에도 파기할 수 있다. Time Travel 7/30일 및 별도 백업, 복구 시 삭제 재반영 절차 확인.
- 운영자가 Cloudflare D1 대시보드에서 실제 jurisdiction/region/replica 설정과 계약/위탁·재위탁 내용, 처리 국가, 보유기간, 개인정보 보호책임자 실제 성명 또는 직책/연락처를 확인해야 한다. Google OAuth 처리 주체와 국가, 계약상 역할 및 적용되는 이전 근거 확인. 개인정보 보호법 제28조의8에 따른 근거 및 필수 고지를 확정하기 전 국외이전 동의 완료라고 표시하지 않는다. 동의를 근거로 한다면 별도 동의가 필요하며 거부 방법·효과 등 실제 내용을 명시한다.
- 광고 관련 Google 스크립트의 국외 처리/쿠키, 맞춤 광고, 대상 국가 동의 및 넥슨 데이터 수익화 허용은 별도 확인. 현재 수동 광고 단위 ID 미등록.
- 참고: https://www.law.go.kr/lsInfoP.do?ancYnChk=0&lsId=011357 ; https://pipc.go.kr/np/default/page.do?mCode=D060040000 ; https://developers.cloudflare.com/d1/configuration/data-location/ ; https://developers.cloudflare.com/d1/reference/time-travel/ ; https://www.cloudflare.com/cloudflare-customer-dpa/ ; https://policies.google.com/privacy?hl=ko
