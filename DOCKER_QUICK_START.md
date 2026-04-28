# 🐳 Docker Quick Start

Get Lumigift running in 3 minutes!

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Setup Steps

### 1️⃣ Clone & Configure

```bash
git clone https://github.com/JosephOnuh/Lumigift-lumigift.git
cd lumigift
cp .env.local.example .env.local
```

### 2️⃣ Generate Secrets

**Linux/Mac:**
```bash
./scripts/generate-secrets.sh
```

**Windows PowerShell:**
```powershell
.\scripts\generate-secrets.ps1
```

**Or manually:**
```bash
openssl rand -base64 32
```

Copy the generated secrets to `.env.local`:
```env
NEXTAUTH_SECRET=<paste_generated_secret>
CRON_SECRET=<paste_generated_secret>
```

### 3️⃣ Start Services

**Production mode:**
```bash
docker-compose up
```

**Development mode (with hot reload):**
```bash
docker-compose -f docker-compose.dev.yml up
```

### 4️⃣ Access Application

- **App:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/health
- **Database:** localhost:5432 (user: `lumigift`, password: `lumigift_dev_password`)
- **Redis:** localhost:6379

## Common Commands

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up --build

# Reset everything (deletes data!)
docker-compose down -v

# Check service status
docker-compose ps

# Access database
docker-compose exec postgres psql -U lumigift -d lumigift

# Access Redis CLI
docker-compose exec redis redis-cli
```

## NPM Shortcuts

```bash
npm run docker:up          # Start production
npm run docker:up:dev      # Start development
npm run docker:down        # Stop services
npm run docker:build       # Rebuild images
npm run docker:logs        # View logs
```

## Troubleshooting

### Port Already in Use

Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Nuclear option (rebuild everything)
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Database Connection Failed

```bash
# Check postgres health
docker-compose ps postgres

# View postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

## What's Running?

```
┌─────────────────────────────────────┐
│  Next.js App (localhost:3000)       │
│  ├─ API Routes                      │
│  ├─ Server Components               │
│  └─ Static Assets                   │
└─────────────────────────────────────┘
              │
              ├──────────────┬─────────────┐
              ▼              ▼             ▼
    ┌──────────────┐  ┌──────────┐  ┌──────────┐
    │  PostgreSQL  │  │  Redis   │  │ External │
    │  :5432       │  │  :6379   │  │ APIs     │
    └──────────────┘  └──────────┘  └──────────┘
```

## Next Steps

1. ✅ Services running? Check http://localhost:3000
2. 📝 Configure external APIs in `.env.local`:
   - Stellar keys (for blockchain)
   - Paystack/Stripe (for payments)
   - Termii (for SMS/OTP)
   - Cloudinary (for uploads)
3. 🧪 Run tests: `docker-compose exec app npm test`
4. 📚 Read full docs: `docs/docker-setup.md`

## Need Help?

- **Full Documentation:** [docs/docker-setup.md](docs/docker-setup.md)
- **Project README:** [README.md](README.md)
- **Issues:** [GitHub Issues](https://github.com/JosephOnuh/Lumigift-lumigift/issues)

---

**Happy coding! 🚀**
