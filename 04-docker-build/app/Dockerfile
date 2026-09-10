FROM node:20-slim

WORKDIR /app

# 의존성 매니페스트만 먼저 복사 (레이어 캐시용)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 나머지 소스 복사
COPY . .

# 항상 실행되는 부분(ENTRYPOINT) + 기본 인자(CMD) 분리
ENTRYPOINT ["node", "src/index.js"]
CMD ["30000", "4"]
