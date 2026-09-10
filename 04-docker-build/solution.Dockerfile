# 4회차 참고용 Dockerfile (실습에서 직접 써볼 위치: 04-docker-build/app/Dockerfile)
# 실습.md 미션을 먼저 풀어본 뒤 비교하세요.

FROM node:20-slim

WORKDIR /app

# 1) 의존성 매니페스트만 먼저 복사 → 소스가 바뀌어도 이 레이어는 캐시 재사용
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2) 나머지 소스 복사
COPY . .

# 3) 컨테이너 시작 시 실행할 명령 (docker run <이미지> 30000 4 로 인자 덮어쓰기 가능)
CMD ["node", "src/index.js"]
