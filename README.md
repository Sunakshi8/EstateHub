<div align="center">

# 🏠 EstateHub

### A Full-Stack MERN Real Estate Marketplace

Centralized property discovery with trust-first features — verified listings, spam-proof inquiries, and resident-backed reviews.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Tailwind](https://img.shields.io/badge/Styling-TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[Live Demo](#) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 📌 About The Project

Property discovery platforms like 99acres and MagicBricks are flooded with **duplicate listings, spam inquiries, and zero verification** — buyers waste hours filtering junk before finding a real lead. EstateHub was built to solve that trust gap directly, not just replicate another listings site.

Every core feature maps to a specific real-world complaint:

| Problem | EstateHub's Fix |
|---|---|
| Same property listed 5–10 times by different brokers | Automated duplicate detection (address + price + contact match) flags listings for admin review |
| Buyers flooded with spam calls the moment they inquire | In-app messaging only — phone/email revealed after both sides reply |
| No way to verify if a listing is trustworthy | Reviews only from users with a prior inquiry on that property, auto-tagged "Verified" |
| Stale listings stay live for months | Visible "last updated" date + live view count on every listing |
| One-size-fits-all buyer/seller permissions | Full role-based access: Buyer, Agent/Owner, Admin |

---

## ✨ Features

**🔐 Authentication & Roles**
- JWT-based auth with bcrypt password hashing
- Three roles: Buyer, Agent/Owner, Admin — each with a dedicated dashboard

**🏘️ Property Listings**
- Full CRUD with multi-image upload
- Rich filtering: price range, bedrooms, bathrooms, furnishing, property type, city
- Sort by latest / price (asc/desc), paginated results
- Price history tracked on every edit

**🗺️ Location & Maps**
- Interactive map view per listing (Leaflet + OpenStreetMap)
- One-click address → coordinates geocoding on the add/edit form (Nominatim API)

**🛡️ Trust & Safety**
- Duplicate-listing detection (same address + city + price within ±5% + contact number)
- Admin moderation queue — new listings are reviewed before going live
- Privacy-safe contact reveal: numbers/emails stay hidden until both parties reply
- 24-hour inquiry cooldown per buyer–property pair to block spam

**⭐ Reviews**
- Overall rating + 6 category sub-ratings (cleanliness, maintenance, safety, water supply, noise, management)
- Auto-verified badge for reviewers who previously inquired about the property
- Helpful-vote and report mechanisms

**📊 Dashboards**
- **Buyer:** saved favorites, sent inquiries with live reply threads
- **Agent:** listing management with moderation status, leads inbox
- **Admin:** platform stats, pending-listing approval queue, user directory, reported-review moderation

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Redux Toolkit, React Router, Tailwind CSS |
| Maps | Leaflet.js, OpenStreetMap, Nominatim Geocoding API |
| Backend | Node.js, Express.js |
| APIs | REST (primary) + GraphQL read-layer (Apollo Server 5) |
| Database | MongoDB, Mongoose |
| Auth | JSON Web Tokens (JWT), bcrypt |
| File Uploads | Multer |
| Microservices | gRPC (Protocol Buffers) for inter-service calls, Apache Kafka for event streaming |
| Containerization | Docker, Docker Compose |
| Tooling | ESLint, dotenv, Git |

---

## 🏗️ Architecture

EstateHub runs as six containers under Docker Compose: the React frontend, the main Express API, MongoDB, a Kafka broker, and two standalone microservices that the main API talks to over the network rather than calling in-process.

```
                    ┌─────────────┐
                    │   client    │  React (nginx)
                    └──────┬──────┘
                           │ REST + GraphQL
                    ┌──────▼──────┐        gRPC         ┌───────────────────────┐
                    │   server    │ ──────────────────▶ │ duplicate-detector     │
                    │ (Express)   │                      │ (gRPC microservice)    │
                    └──────┬──────┘                      └───────────┬───────────┘
                           │ publishes                               │ reads
                           │ "inquiry.created"                       ▼
                    ┌──────▼──────┐                            ┌──────────┐
                    │    kafka    │                            │  mongo   │
                    └──────┬──────┘                            └──────────┘
                           │ consumes
                    ┌──────▼──────────────┐
                    │ notification-        │
                    │ consumer (Kafka)     │
                    └───────────────────────┘
```

**Why split these two out as separate services instead of just functions in the monolith?** Both demonstrate patterns used in real distributed backends — gRPC for low-latency synchronous inter-service calls, Kafka for decoupled asynchronous event handling — without needing to rewrite the whole app as microservices. Both also degrade gracefully: if `duplicate-detector` or `kafka` aren't running, the main app logs a warning and falls back to local behavior rather than failing the request (see `server/grpcClients/duplicateDetectorClient.js` and `server/events/kafkaProducer.js`).

```
estatehub/
├── client/                      # React + Vite frontend
│   └── src/
│       ├── api/                 # Axios instance with auth interceptor
│       ├── components/          # Navbar, PropertyCard, MapView, StarRating...
│       ├── pages/                # Home, PropertyDetail, dashboards, auth
│       └── store/                # Redux Toolkit auth slice
│
├── server/                      # Express + MongoDB backend (main API)
│   ├── controllers/             # Business logic (auth, property, inquiry, review, admin)
│   ├── models/                  # Mongoose schemas
│   ├── routes/                  # REST API endpoints
│   ├── graphql/                 # Apollo Server typeDefs + resolvers
│   ├── grpcClients/             # gRPC client for duplicate-detector, with fallback
│   ├── events/                  # Kafka producer + topic names
│   ├── middleware/              # JWT auth guard, role authorization, image upload
│   └── utils/                   # Shared filter builder, duplicate-check fallback, tokens
│
├── services/
│   ├── duplicate-detector/      # Standalone gRPC microservice (Protocol Buffers)
│   └── notification-consumer/   # Standalone Kafka consumer
│
├── docker-compose.yml           # Wires all 6 containers together
└── README.md
```

---

## 🚀 Getting Started

There are two ways to run EstateHub — with Docker (fastest, everything included) or manually with Node.js.

### Option A — Docker (recommended)

**Prerequisites:** [Docker](https://www.docker.com/) + Docker Compose installed.

```bash
git clone https://github.com/Sunakshi8/EstateHub.git
cd EstateHub
docker compose up --build
```

This spins up six containers on one bridge network — MongoDB, Kafka, the `duplicate-detector` gRPC service, the `notification-consumer` Kafka consumer, the Express API, and the React app (built and served via nginx) — with sensible defaults baked into `docker-compose.yml` for local use. Override `JWT_SECRET` as an environment variable for anything beyond local testing.

- Frontend → http://localhost:5173
- Backend API → http://localhost:5000
- GraphQL endpoint → http://localhost:5000/graphql
- Kafka broker → localhost:9092 (internal; the API and consumer reach it via the `kafka` service name)
- gRPC duplicate-detector → localhost:50051 (internal only, not published to the host)

To seed demo accounts into the Dockerized database:
```bash
docker compose exec server node seed.js
```

To watch the Kafka event flow live, send an inquiry through the app, then:
```bash
docker compose logs -f notification-consumer
```

### Option B — Manual (Node.js)

**Prerequisites:**
- Node.js 18+
- A MongoDB database — [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) or local MongoDB

**Installation**

```bash
git clone https://github.com/Sunakshi8/EstateHub.git
cd EstateHub
npm run install:all
```

**Configuration**

```bash
cd server
cp .env.example .env
```

Fill in `server/.env`:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

The `DUPLICATE_SERVICE_URL` and `KAFKA_BROKER` lines in `.env.example` are optional — the app runs fine without `services/duplicate-detector` or a Kafka broker up; it just falls back to in-process behavior and skips publishing events (see the "gRPC" and "Kafka" sections below). Run them yourself per-service if you want the full microservices demo without Docker — see each service's own `npm start` instructions further down — or just use Option A (Docker) to get everything at once.

**Seed demo data (optional)**

```bash
npm run seed
```

| Role | Email | Password |
|---|---|---|
| Admin | admin@estatehub.com | admin123 |
| Agent | agent@estatehub.com | agent123 |
| Buyer | buyer@estatehub.com | buyer123 |

**Run**

```bash
npm run dev
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:5000
- GraphQL endpoint → http://localhost:5000/graphql

---

## 🔑 API Overview

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Create a new account | Public |
| POST | `/api/auth/login` | Authenticate & get JWT | Public |
| GET | `/api/properties` | Search/filter listings | Public |
| POST | `/api/properties` | Create a listing | Agent, Admin |
| PUT | `/api/properties/:id/favorite` | Toggle favorite | Authenticated |
| POST | `/api/inquiries` | Send an inquiry | Authenticated |
| PUT | `/api/inquiries/:id/respond` | Reply to inquiry thread | Authenticated |
| POST | `/api/reviews` | Submit a review | Authenticated |
| GET | `/api/admin/properties/pending` | View moderation queue | Admin |
| PUT | `/api/admin/properties/:id/moderate` | Approve/reject listing | Admin |

Full route definitions live in `server/routes/`.

### GraphQL (read-only search layer)

Mounted at `/graphql` alongside the REST API, built with **Apollo Server 5**. It mirrors the REST search/filter capability through a typed schema — useful for clients that want to request exactly the fields they need in one round trip. All writes (create/update/delete, auth, inquiries, reviews) stay on REST; GraphQL is intentionally read-only here to avoid duplicating every auth-protected mutation path.

```graphql
query {
  properties(filter: { city: "Shimla", minPrice: 5000000, sort: "price_asc" }) {
    total
    properties {
      id
      title
      price
      avgRating
      location { city locality }
    }
  }
}
```

The REST controller and the GraphQL resolver both call the same `buildPropertyQuery()` helper (`server/utils/buildPropertyQuery.js`), so filtering logic can't drift between the two APIs.

### gRPC — duplicate-listing detection as a separate service

`services/duplicate-detector` is a standalone Node process exposing one RPC, `CheckDuplicate`, defined in `services/duplicate-detector/proto/duplicate.proto`. When a new property is created, the main API calls this service over gRPC (`server/grpcClients/duplicateDetectorClient.js`) with a 2-second deadline instead of running the check in-process. If the service doesn't respond in time — including when it's simply not running — the API logs a warning and falls back to the original in-process implementation (`server/utils/duplicateCheck.js`) so listing creation never breaks because of it.

```bash
# Run it standalone against a local MongoDB, outside Docker:
cd services/duplicate-detector
cp .env.example .env
npm install
npm start
# → duplicate-detector: gRPC service listening on port 50051
```

### Kafka — event-driven inquiry notifications

When a buyer sends (or re-opens) an inquiry, the API publishes an `inquiry.created` / `inquiry.reopened` event to the `estatehub.inquiries` topic (`server/events/kafkaProducer.js`) — fire-and-forget, never blocking or failing the HTTP response. `services/notification-consumer` is a separate process that subscribes to that topic and logs what a real notification service would do with the event (send an email, push a mobile alert, etc.) — demonstrating the producer → broker → consumer wiring without standing up a real email provider for a portfolio project.

```bash
# Watch events arrive, outside Docker (requires a local Kafka broker on :9092):
cd services/notification-consumer
cp .env.example .env
npm install
npm start
# → notification-consumer: subscribed to "estatehub.inquiries"
```

Both the publisher and consumer skip silently (with a logged warning) if no broker is reachable — the core app works with zero Kafka setup; running it just adds the live event-streaming demo on top.

---

## 🗺️ Roadmap

- [ ] Real-time chat via Socket.io
- [ ] Property comparison tool (side-by-side, up to 3)
- [ ] Recently viewed properties
- [ ] Price history chart on listing page
- [ ] Booking-token payments (Razorpay/Stripe)
- [ ] AI-assisted price prediction
- [ ] Transactional outbox pattern for the Kafka producer (currently fire-and-forget; an outbox table would guarantee the event is eventually published even if the process crashes right after the DB write)
- [ ] TypeScript on the server (currently JS with JSDoc-style clarity; schemas and controllers are structured to make this a mechanical conversion later)

---

## 👩‍💻 Author

**Sunakshi Rana**
Full-Stack Developer | MERN · Flutter · AI Applications

[GitHub](https://github.com/Sunakshi8) · sunakshirana264@gmail.com

---

<div align="center">

If this project helped you, consider giving it a ⭐

</div>
