# Self-Hosting ANKR Interact

Everything you need to run ANKR Interact on your own server — forever free, fully private.

## Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 1 GB | 2 GB |
| CPU | 1 core | 2 cores |
| Disk | 10 GB | 50 GB |
| OS | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| Docker | 24+ | latest |
| Node.js | 20+ | 22 LTS |

---

## Option 1 — Docker Compose (Easiest)

```bash
# 1. Clone
git clone https://github.com/rocketlang/ankr-interact
cd ankr-interact

# 2. Configure
cp .env.example .env
# Edit .env — set SECRET_KEY and optionally AI_API_KEY

# 3. Start
docker compose up -d

# 4. Open
open http://localhost:3199
```

That's it. PostgreSQL, the server, and the client all start together.

### Docker Compose services

| Service | Port | Description |
|---------|------|-------------|
| `interact` | 3199 | Main application |
| `postgres` | 5432 | PostgreSQL database |
| `ai-proxy` | 4444 | Optional AI proxy (Ollama / OpenAI) |

---

## Option 2 — Manual Install

### 1. PostgreSQL
```bash
sudo apt install postgresql-15
sudo -u postgres psql -c "CREATE USER interact WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE interact OWNER interact;"
```

### 2. App
```bash
git clone https://github.com/rocketlang/ankr-interact
cd ankr-interact
pnpm install
cp .env.example .env
```

### 3. Environment Variables
```bash
# .env
PORT=3199
DATABASE_URL=postgresql://interact:yourpassword@localhost:5432/interact
SECRET_KEY=your-random-secret-key-min-32-chars

# Optional: AI features
AI_PROXY_URL=http://localhost:4444   # Ollama or AI proxy
AI_API_KEY=                          # OpenAI/Anthropic key (leave blank for Ollama)

# Optional: email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### 4. Database + Start
```bash
pnpm run db:push     # create tables
pnpm run build
pnpm start           # production server
```

---

## Reverse Proxy

### Nginx
```nginx
server {
    listen 80;
    server_name interact.yourdomain.com;

    location / {
        proxy_pass http://localhost:3199;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then add SSL with Certbot:
```bash
certbot --nginx -d interact.yourdomain.com
```

### Caddy (even simpler)
```
interact.yourdomain.com {
    reverse_proxy localhost:3199
}
```

---

## AI Features (Optional)

ANKR Interact works without AI. To enable AI tutoring and document Q&A:

### Option A — Ollama (free, local, private)
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2       # 2GB
ollama pull nomic-embed-text  # for embeddings
```
Set `AI_PROXY_URL=http://localhost:11434` in `.env`.

### Option B — OpenAI / Anthropic
Set `AI_API_KEY=sk-...` in `.env`. Uses pay-per-use pricing.

### Option C — ANKR Cloud AI (easiest)
Sign up at [interact.ankrlabs.in](https://interact.ankrlabs.in) for a managed AI key. Free tier included.

---

## Data & Backups

All data lives in PostgreSQL. Back up with:
```bash
pg_dump interact > backup-$(date +%Y%m%d).sql
```

Restore:
```bash
psql interact < backup-20260227.sql
```

User-uploaded files are stored in `./data/uploads/`. Back up this directory too.

---

## Upgrading

```bash
git pull
pnpm install
pnpm run db:push    # apply any new migrations
pnpm run build
pm2 restart interact  # or restart your process manager
```

---

## Process Management (pm2)

```bash
npm install -g pm2
pm2 start "pnpm start" --name interact
pm2 save
pm2 startup   # auto-start on reboot
```

---

## Troubleshooting

**App won't start**
```bash
pnpm run db:push    # ensure DB schema is up to date
node --version       # must be 20+
```

**Can't connect to PostgreSQL**
```bash
psql $DATABASE_URL   # test connection directly
```

**AI features not working**
```bash
curl http://localhost:4444/health   # test AI proxy
```

**Port already in use**
```bash
lsof -ti:3199 | xargs kill -9
```

---

For support, open an [issue](https://github.com/rocketlang/ankr-interact/issues) or join our [Discord](#).
