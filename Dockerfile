FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
# Os áudios e o banco ficam em /app/data — monte um volume persistente aqui.
VOLUME ["/app/data"]
EXPOSE 3000
USER node
CMD ["npm", "start"]
