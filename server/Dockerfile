# --- EstateHub API (TypeScript: Express + MongoDB + PostgreSQL + Kafka) ---

# Stage 1: compile TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: lean runtime image (prod deps + compiled JS only)
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY proto ./proto
COPY db ./db
RUN mkdir -p uploads

EXPOSE 5000
CMD ["node", "dist/server.js"]
