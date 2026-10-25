<div align="center">

# 🏠 EstateHub

### A Full-Stack Real Estate Marketplace — TypeScript · MongoDB · PostgreSQL · Kafka

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
| Backend | Node.js, Express.js, **TypeScript ** |
| APIs | REST (primary) + GraphQL read-layer (Apollo Server 5) |
| Databases | MongoDB + Mongoose (primary store), **PostgreSQL** (outbox + preference scores) |
| Auth | JSON Web Tokens (JWT), bcrypt |
| File Uploads | Multer |
| Microservices | gRPC (Protocol Buffers) for inter-service calls, Apache Kafka for event streaming (typed contracts, DLQ, outbox) |
| Containerization | Docker, Docker Compose |
| Tooling | ESLint, dotenv, Git |

---

## 🏗️ Architecture

```
 client (React/nginx)
      │ REST + GraphQL
      ▼
 server (Express, TypeScript) ──gRPC──▶ duplicate-detector ──▶ MongoDB
      │  │
      │  └──HTTP (x-internal-token)──▶ recommendation-service ◀─────────────┐
      │                                   │  ▲                              │
      │ publishes typed events            │  │ consumes                     │
      ▼                                   ▼  │                              │
   Kafka  ── estatehub.inquiries ─────────────┘                              │
   topics ── estatehub.interactions ──▶ notification-consumer                │
          ── estatehub.properties (compacted)                                │
          ── *.dlq (dead letters)                                            │
                                                                             │
 server ──(broker down?)──▶ PostgreSQL outbox_events ──relay──▶ Kafka        │
                                                                             │
 recommendation-service ──▶ PostgreSQL  reco.user_preferences  ─────────────┘
                                         (preference scores)
```

MongoDB stays the **source of truth** for users, properties, inquiries and reviews. PostgreSQL is added for the two jobs it is better at: a transactional **outbox** (server) and the **preference-score store** (recommendation-service).

### Recommendation pipeline

```
Kafka → Recommendation Service → PostgreSQL → Preference score
```

1. The API emits events: `property.viewed`, `property.favorited/unfavorited`, `inquiry.created/reopened`, `search.performed`, and `property.upserted/removed` snapshots.
2. `recommendation-service` consumes them. Each event is applied in **one PostgreSQL transaction** that begins with an idempotency check, so redeliveries are harmless.
3. Each interaction updates `reco.user_preferences` — one row per `(user, feature)` for city, locality, property type, price band, bedrooms, furnishing and amenities:

   `score = old_score × 0.5^(elapsed / half-life) + interaction_weight`

   Weights: view 1 · favorite 4 · un-favorite −3 · inquiry 8 · site-visit inquiry 10 · search 0.5. Half-life is 14 days (`HALF_LIFE_DAYS`), so recent behaviour dominates.
4. At request time candidates are scored: **85 % preference match** (weighted, normalised per feature type, neighbouring price bands earn partial credit) + **15 % popularity**. Each result carries a 0–100 score and human-readable reasons ("You've been looking at Shimla"). Users with no history get popular listings (cold start).
5. `GET /api/recommendations` (server) hydrates the ranked ids from MongoDB. If the service is down it falls back to the latest listings.

Tunables live in `services/recommendation-service/src/scoring/weights.ts`.

### Kafka, made serious

| Concern | What changed |
|---|---|
| Contracts | Every message is a versioned envelope (`eventId`, `type`, `version`, `occurredAt`, `producer`, `correlationId`) validated with **zod** on both producer and consumer (`shared/schemas.ts`) |
| Topics | Provisioned explicitly (partitions, retention, `min.insync.replicas`); `estatehub.properties` is **log-compacted** so a new consumer can rebuild its read model; auto-create is disabled on the broker |
| Ordering | Deterministic partition keys: buyer/user id for inquiries & interactions, property id for property state |
| Producer | Idempotent, `acks=all`, headers for tracing, circuit breaker so a dead broker doesn't add latency to requests |
| Durability | **Transactional outbox** in PostgreSQL: if Kafka is unreachable the event is parked and a relay (`FOR UPDATE SKIP LOCKED`, ordered) delivers it later — events survive broker outages and restarts |
| Consumers | `ResilientConsumer`: at-least-once, exponential-backoff retries, **dead-letter topics** with diagnostic headers, poison messages never block a partition, unknown event types skipped (forward-compatible), never drops a message if the DLQ write fails |
| Idempotency | `reco.processed_events` ledger written in the same transaction as the state change |
| Tracing | `x-request-id` → `correlationId` on every event |
| Ops | `/api/health` exposes producer, outbox depth and Postgres status; optional Kafka UI (`--profile tools`) |

`shared/` is the single source of truth for topics/schemas/consumer runner; `npm run sync:shared` copies it into each independently deployable service and CI runs `check:shared` to catch drift.

```
estatehub/
├── client/                         # React + Vite (new: "Recommended for you" tab)
├── server/                         # Express API — TypeScript
│   ├── src/{config,models,middleware,controllers,routes,graphql,grpcClients,events,services,utils}
│   ├── db/migrations/              # PostgreSQL (outbox)
│   └── proto/
├── services/
│   ├── recommendation-service/     # NEW — Kafka consumer + PostgreSQL + HTTP API
│   ├── notification-consumer/      # Kafka consumer (now with retries + DLQ)
│   └── duplicate-detector/         # gRPC microservice — TypeScript
├── shared/                         # Kafka contracts (source of truth)
├── scripts/sync-shared.sh
├── .github/workflows/ci.yml
└── docker-compose.yml              # mongo, postgres, kafka, 3 services, server, client
```

---

## 🚀 Getting Started

### Option A — Docker (recommended)

```bash
git clone https://github.com/Sunakshi8/EstateHub.git
cd EstateHub
docker compose up --build
docker compose exec server node dist/seed.js      # demo accounts + publishes property snapshots
```

- Frontend → http://localhost:5173
- API → http://localhost:5000 (health: `/api/health`) · GraphQL → `/graphql`
- Recommendation service → http://localhost:5100/health
- PostgreSQL → localhost:5432 (`estatehub` / `estatehub`)
- Kafka (host access) → localhost:9092 · Kafka UI: `docker compose --profile tools up -d kafka-ui` → http://localhost:8080

Watch it learn:
```bash
docker compose logs -f recommendation-service notification-consumer
# log in as buyer@estatehub.com, view/favorite listings, open Dashboard → "Recommended for you"
docker compose exec postgres psql -U estatehub -c \
  "SELECT feature_type, feature_value, round(score::numeric,2) FROM reco.user_preferences ORDER BY score DESC LIMIT 10;"
```

### Option B — Manual

Prerequisites: Node 20+, MongoDB, PostgreSQL 16, Kafka (the compose file can run just the infra: `docker compose up mongo postgres kafka`).

```bash
npm run install:all
cp server/.env.example server/.env                       # set JWT_SECRET
cp services/recommendation-service/.env.example services/recommendation-service/.env
cp services/notification-consumer/.env.example services/notification-consumer/.env
npm run seed
npm run dev
```

Everything degrades gracefully: without PostgreSQL the API still serves (no outbox / recommendations); without Kafka events queue in the outbox; without the recommendation service the endpoint falls back to latest listings.

### Scripts

```bash
npm run typecheck     # tsc --noEmit in all four TypeScript projects
npm run build         # compile all
npm test              # unit tests (+ PostgreSQL integration tests if TEST_DATABASE_URL is set)
npm run backfill:events --prefix server   # re-publish property snapshots to rebuild the reco read model
```

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
| GET | `/api/recommendations` | Personalised, scored recommendations | Authenticated |
| GET | `/api/recommendations/preferences` | Your learned preference scores | Authenticated |
| GET | `/api/admin/properties/pending` | View moderation queue | Admin |
| PUT | `/api/admin/properties/:id/moderate` | Approve/reject listing | Admin |

Full route definitions live in `server/src/routes/`.

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

The REST controller and the GraphQL resolver both call the same `buildPropertyQuery()` helper (`server/src/utils/buildPropertyQuery.ts`), so filtering logic can't drift between the two APIs.

### gRPC — duplicate-listing detection as a separate service

`services/duplicate-detector` is a standalone Node process exposing one RPC, `CheckDuplicate`, defined in `services/duplicate-detector/proto/duplicate.proto`. When a new property is created, the main API calls this service over gRPC (`server/src/grpcClients/duplicateDetectorClient.ts`) with a 2-second deadline instead of running the check in-process. If the service doesn't respond in time — including when it's simply not running — the API logs a warning and falls back to the original in-process implementation (`server/src/utils/duplicateCheck.ts`) so listing creation never breaks because of it.

```bash
# Run it standalone against a local MongoDB, outside Docker:
cd services/duplicate-detector
cp .env.example .env
npm install
npm start
# → duplicate-detector: gRPC service listening on port 50051
```

### Kafka consumers

`services/notification-consumer` subscribes to `estatehub.inquiries` and logs what a real notification service would do (email/push), de-duplicating redelivered events. `services/recommendation-service` subscribes to all three topics. Both use the shared `ResilientConsumer` (retries → DLQ). To inspect dead letters: `docker compose --profile tools up -d kafka-ui` and open the `*.dlq` topics — headers show the reason, error, attempts and source offset.

---

## 🗺️ Roadmap

- [ ] Real-time chat via Socket.io
- [ ] Property comparison tool (side-by-side, up to 3)
- [ ] Recently viewed properties
- [ ] Price history chart on listing page
- [ ] Booking-token payments (Razorpay/Stripe)
- [ ] AI-assisted price prediction
- [x] Outbox fallback for Kafka publishing (PostgreSQL)
- [ ] Full transactional outbox (write the event atomically with the Mongo change — needs Mongo transactions / change streams)
- [x] TypeScript on the server and all services
- [ ] TypeScript on the client
- [ ] Collaborative filtering ("buyers like you") on top of preference scores
- [ ] Kafka authentication/TLS + multi-broker replication for production

---

## 👩‍💻 Author

**Sunakshi Rana**
Full-Stack Developer | MERN · Flutter · AI Applications

[GitHub](https://github.com/Sunakshi8) · sunakshirana264@gmail.com

---

<div align="center">

If this project helped you, consider giving it a ⭐

</div>
