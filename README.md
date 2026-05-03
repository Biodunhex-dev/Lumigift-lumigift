# Lumigift

> **Time-locked cash gifts on the Stellar blockchain.**  
> Send money that stays completely hidden until a surprise unlock date.

[![CI](https://github.com/JosephOnuh/Lumigift-lumigift/actions/workflows/ci.yml/badge.svg)](https://github.com/JosephOnuh/Lumigift-lumigift/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/JosephOnuh/Lumigift-lumigift/graph/badge.svg?token=CODECOV_TOKEN)](https://codecov.io/gh/JosephOnuh/Lumigift-lumigift)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-blue)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet)](https://developers.stellar.org/docs/build/smart-contracts)

---

## What is Lumigift?

Lumigift is a full-stack gifting platform that enables users to send cash gifts that remain completely hidden until a predetermined unlock date and time. By using the Stellar blockchain, Lumigift transforms digital money transfers into memorable experiences filled with mystery and anticipation.

**Who is it for?**
- Nigerians sending to Nigerians for birthdays, anniversaries, and holidays where surprise is key
- Valentine's Day, graduations, and surprise celebrations where the *timing* of the gift is as important as the gift itself

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Public Pages│  │  API Routes  │  │  Server Services │  │
│  │  /send       │  │  /api/gifts  │  │  gift.service    │  │
│  │  /dashboard  │  │  /api/auth   │  │  claim.service   │  │
│  │  /auth/login │  │  /api/cron   │  │  scheduler       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Paystack / Stripe    PostgreSQL DB         Stellar Network
   (NGN on-ramp)        (gift records)        (USDC + Soroban)
                                                    │
                                          ┌─────────────────┐
                                          │  Escrow Contract │
                                          │  (Soroban/Rust)  │
                                          │  Time-locked USDC│
                                          └─────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Vanilla CSS |
| Backend | Next.js Route Handlers, server services layer |
| Blockchain | Stellar, Soroban smart contracts (Rust) |
| Stablecoin | USDC on Stellar |
| Payments | Paystack (NGN), Stripe (international) |
| SMS/OTP | Termii |
| Database | PostgreSQL |
| Cache/Queue | Redis |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── send/               # Gift creation flow
│   ├── dashboard/          # Sender dashboard
│   ├── auth/login/         # Phone OTP login
│   └── api/                # Route handlers
│       ├── gifts/          # Gift CRUD + claim
│       ├── auth/           # OTP + NextAuth
│       ├── payments/       # Paystack callback
│       └── cron/           # Unlock scheduler
├── server/
│   ├── services/           # Core business logic
│   ├── middleware/         # Auth, rate limiting
│   └── config/             # Server configuration
├── components/
│   ├── ui/                 # Button, Input, Badge
│   ├── gift/               # GiftCard, CreateGiftForm
│   └── layout/             # Navbar
├── lib/                    # Stellar SDK, Paystack, SMS
├── types/                  # TypeScript types + Zod schemas
└── styles/                 # Vanilla CSS design system
contracts/
└── escrow/                 # Soroban escrow contract (Rust)
scripts/
└── deploy-contract.ts      # Contract deployment script
```

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** (recommended for quick setup)
  - [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows/Mac
  - Docker Engine + Docker Compose for Linux
- **OR** Manual setup:
  - Node.js ≥ 20
  - npm ≥ 10
  - PostgreSQL ≥ 14
  - Redis ≥ 7
- Rust + `wasm32-unknown-unknown` target (for contract work)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)

### Quick Start with Docker (Recommended)

The easiest way to get started is using Docker, which automatically sets up PostgreSQL, Redis, and the Next.js app:

```bash
# Clone the repository
git clone https://github.com/JosephOnuh/Lumigift-lumigift.git
cd lumigift

# Copy environment file and configure
cp .env.local.example .env.local
# Edit .env.local with your API keys and secrets

# Start all services (app, postgres, redis)
docker-compose up

# The app will be available at http://localhost:3000
```

**What's included:**
- ✅ Next.js app running on port 3000
- ✅ PostgreSQL database on port 5432 (auto-initialized with migrations)
- ✅ Redis cache/queue on port 6379
- ✅ Automatic health checks and service dependencies
- ✅ Hot reload for development (mount your code as volume)

**Useful Docker commands:**

```bash
# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up --build

# Reset everything (including data)
docker-compose down -v

# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up
```

**Production vs Development:**
- `docker-compose.yml` - Production build with multi-stage optimization
- `docker-compose.dev.yml` - Development mode with hot reload and volume mounts

### Manual Installation

If you prefer not to use Docker:

```bash
git clone https://github.com/JosephOnuh/Lumigift-lumigift.git
cd lumigift
npm install

# Set up PostgreSQL
createdb lumigift
psql lumigift < migrations/0001_add_stellar_tx_hash.sql
psql lumigift < migrations/0002_add_device_tracking.sql
psql lumigift < migrations/0002_normalize_phone_e164.sql
psql lumigift < migrations/0003_hash_recipient_phone.sql
psql lumigift < migrations/0004_gift_invitations.sql

# Set up Redis
redis-server

# Configure environment
cp .env.example .env.local
# Fill in your environment variables

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Smart Contract

```bash
# Build the WASM
npm run contract:build

# Run Rust tests
npm run contract:test

# Deploy to testnet
STELLAR_NETWORK=testnet npm run contract:deploy
```

---

## Benefits to the Stellar Ecosystem

- **Stablecoin Infrastructure** — USDC ensures gift value is preserved from creation to unlock
- **Soroban Smart Contracts** — Decentralized time-locking logic with no middleman
- **Low-Cost Transactions** — Stellar's near-zero fees mean more money reaches recipients
- **Real-World Utility** — Bridges blockchain to Nigerian bank accounts via Paystack
- **Financial Inclusion** — On/off-ramp experience connecting global stablecoin liquidity to local finance

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

- Bug reports → [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Feature requests → [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Security issues → **security@lumigift.com** (do not open public issues)

---

## License

[MIT](LICENSE) © 2024 Lumigift
