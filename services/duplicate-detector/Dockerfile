# --- Duplicate-Detector gRPC microservice ---
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 50051

CMD ["node", "server.js"]
