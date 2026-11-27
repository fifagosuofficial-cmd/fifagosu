# 실시간 채팅 배포
1. Cloudflare 계정에서 Worker Scripts Edit 권한이 있는 API 토큰을 사용해 `npx wrangler deploy --config workers/chat-hub/wrangler.toml` 실행.
2. Cloudflare Dashboard → Workers & Pages → fifagosu (Pages) → Settings → Bindings → Durable Object 추가: CHAT_HUB, Worker fifagosu-chat-hub, class ChatHub, Production 환경. 기존 DB와 환경 변수 유지.
3. 운영 main 배포 후 브라우저 두 개로 채팅 송수신 확인. /api/community/live-chat/socket WebSocket 업그레이드 HTTP 101 확인. 로그인 사용자만 작성하며 D1에 저장된 공개 채팅만 조회. 소켓 연결은 변경 신호만 보내고 내용은 권한 확인 후 API로 읽음.
4. 연결 실패 시 5초 간격 재연결. 주기적 메시지 폴링 없음. 브라우저가 숨겨지거나 채팅이 화면 밖이면 연결을 닫음. 
