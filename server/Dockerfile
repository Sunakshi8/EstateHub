# --- EstateHub API (Express + MongoDB) ---
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the source
COPY . .

# Uploaded images are written here at runtime; keep the folder present
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
