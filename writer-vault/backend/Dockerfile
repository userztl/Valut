FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# 先拷贝依赖清单，利用层缓存
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 3000

CMD ["node", "src/index.js"]
