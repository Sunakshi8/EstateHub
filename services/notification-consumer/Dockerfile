# --- Notification-Consumer (Kafka consumer microservice) ---
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "consumer.js"]
