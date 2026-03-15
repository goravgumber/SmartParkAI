# SmartPark AI — System Architecture

## 1. Architectural Overview

SmartPark AI is a monorepo full-stack system with secure APIs, realtime eventing, and simulated IoT ingestion.

- **Client**: React + Vite dashboard
- **Server**: Express APIs + Socket.IO + validation/RBAC middleware
- **Data**: PostgreSQL via Prisma
- **Realtime**: Socket rooms per facility
- **IoT simulation**: MQTT and REST simulation endpoints

## 2. High-Level Components

```mermaid
flowchart LR
  FE[React Frontend]
  API[Express Backend]
  WS[Socket.IO]
  DB[(PostgreSQL)]
  MQTT[MQTT Broker]
  SIM[Raspberry Pi Simulation]

  FE -->|HTTPS /api| API
  FE <-->|WSS| WS
  API --> DB
  MQTT --> API
  SIM --> API
  API --> WS
```

## 3. Backend Module Breakdown

```mermaid
flowchart TD
  subgraph Backend[Express Server]
    A[Auth Routes]
    P[Parking Routes]
    R[Reservation Routes]
    AN[Analytics Routes]
    AL[Alerts Routes]
    D[Devices Routes]
    V[Voice Routes]
    S[Simulation Routes]
    M1[Auth Middleware]
    M2[Validation Middleware]
    M3[Rate Limiter]
    M4[Error Handler]
  end

  A --> M1
  P --> M2
  R --> M1
  R --> M2
  AN --> M1
  AL --> M1
  D --> M1
  S --> M1
```

## 4. Realtime Flow (WebSocket)

```mermaid
sequenceDiagram
  autonumber
  participant UI as Frontend (Map)
  participant WS as Socket.IO
  participant API as Express
  participant DB as PostgreSQL

  UI->>WS: connect(auth token)
  UI->>WS: join:facility(facilityId)

  API->>DB: update slot/device/reservation
  API->>WS: emit slot:updated (facility room)
  API->>WS: emit occupancy:live
  WS-->>UI: push realtime events
  UI->>UI: patch state + refresh KPIs
```

## 5. IoT Simulation Flow

```mermaid
sequenceDiagram
  autonumber
  participant Panel as SimulationPanel
  participant API as /api/simulation/*
  participant DB as Prisma + PostgreSQL
  participant WS as Socket.IO Room
  participant Map as MapOverviewPage

  Panel->>API: POST /simulation/start
  loop every interval
    API->>DB: toggle random slot statuses
    API->>WS: slot:updated
    API->>WS: occupancy:live
    WS-->>Map: realtime updates
  end
  Panel->>API: GET /simulation/status
  Panel->>API: POST /simulation/stop
```

## 6. Reservation + Integrity Model

- Reservation creation checks slot availability and conflicting windows.
- Slot status transitions are persisted in DB before event emission.
- Critical updates run in transactions to reduce double-booking risk.
- Role checks enforce who can check-in/check-out/cancel.

## 7. Security Controls in Current Build

- JWT auth middleware for protected routes
- RBAC for OWNER/ADMIN actions
- Input validation middleware for API payloads
- Rate limiting for abuse reduction
- CORS restricted via `FRONTEND_URL`
- Socket handshake token verification

## 8. Deployment Topology (Render)

```mermaid
flowchart TD
  GitHub[GitHub Repo]
  Render[Render Blueprint]
  FE[Static Site: smartpark-client]
  BE[Web Service: smartpark-server]
  PG[(Render Postgres)]

  GitHub --> Render
  Render --> FE
  Render --> BE
  BE --> PG
  FE -->|HTTPS API| BE
  FE -->|WSS| BE
```

## 9. Operational Notes

- Frontend API and websocket URLs are env-driven (`VITE_API_URL`, `VITE_WS_URL`).
- Backend trust proxy and CORS are env-driven for Render.
- Seed script is idempotent and safe for repeat deploys.
