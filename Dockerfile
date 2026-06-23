FROM node:20-alpine AS build

WORKDIR /app

# 先复制 package.json 利用缓存
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/

RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# 复制源码并构建前端
COPY . .
RUN npm run build

# --- 生产镜像 ---
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/package.json ./

RUN cd server && npm install --omit=dev

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
