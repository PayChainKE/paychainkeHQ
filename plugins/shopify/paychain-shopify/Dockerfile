FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY bin ./bin
USER node
ENV PORT=8788
EXPOSE 8788
CMD ["node", "src/server.js"]
