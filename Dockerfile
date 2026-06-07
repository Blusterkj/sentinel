FROM node:22-slim
WORKDIR /app

# Copy only the proxy-specific package file (8 deps, not 451)
COPY proxy.package.json ./package.json

# Install proxy deps only — no frontend packages, no peer dep conflicts
RUN npm install --omit=dev --no-package-lock

# Copy the proxy entrypoint
COPY proxy.mjs ./

EXPOSE 3333
CMD ["node", "proxy.mjs"]
