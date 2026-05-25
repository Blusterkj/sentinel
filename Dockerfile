FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY proxy.mjs ./
EXPOSE 3333
CMD ["node", "proxy.mjs"]
