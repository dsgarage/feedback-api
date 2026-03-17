# --- ビルドステージ ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# --- 実行ステージ ---
FROM node:20-alpine AS runner

WORKDIR /app

# 本番依存のみインストール
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ビルド成果物をコピー
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
