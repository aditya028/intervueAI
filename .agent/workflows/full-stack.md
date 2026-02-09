---
description: Complete setup and run guide for the full IntervueAI application (Docker + Backend + Frontend)
---

# IntervueAI Full Stack Workflow

This workflow covers setting up and running the complete IntervueAI application.

---

## Quick Start (TL;DR)

```bash
# 1. Start infrastructure
cd /Users/adityanandan/projects/intervue-ai
docker-compose up -d

# 2. Start backend (Terminal 1)
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 3. Start frontend (Terminal 2)
cd frontend
npm run dev

# 4. Open http://localhost:3000
```

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Frontend runtime |
| Python | 3.11+ | Backend runtime |
| Docker | Latest | Infrastructure services |
| Docker Compose | Latest | Container orchestration |

---

## Step 1: Clone & Initial Setup

```bash
cd /Users/adityanandan/projects/intervue-ai
```

---

## Step 2: Get API Keys (Free)

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Groq** | LLM (Llama 3.3 70B) | [console.groq.com](https://console.groq.com) |
| **Deepgram** | Speech-to-Text | [console.deepgram.com](https://console.deepgram.com) - $200 free credits |

---

## Step 3: Start Infrastructure Services

// turbo
```bash
cd /Users/adityanandan/projects/intervue-ai
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **LiveKit** (ports 7880, 7881) - WebRTC server

Verify all services are running:
// turbo
```bash
docker-compose ps
```

---

## Step 4: Set Up Backend

### 4a. Create virtual environment
```bash
cd /Users/adityanandan/projects/intervue-ai/backend
python -m venv .venv
source .venv/bin/activate
```

### 4b. Install dependencies
```bash
pip install -r requirements.txt
```

### 4c. Configure environment
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### 4d. Start backend server
// turbo
```bash
uvicorn app.main:app --reload --port 8000
```

---

## Step 5: Set Up Frontend

### 5a. Install dependencies
```bash
cd /Users/adityanandan/projects/intervue-ai/frontend
npm install
```

### 5b. Start development server
// turbo
```bash
npm run dev
```

---

## Step 6: Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs (Swagger UI)

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User's Browser                        │
│                      http://localhost:3000                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│                    (Port 3000)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Landing  │ │  Setup   │ │Interview │ │  Review  │       │
│  │  Page    │ │  Form    │ │   Room   │ │Dashboard │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└───────────────────┬─────────────────┬───────────────────────┘
                    │ REST API        │ WebRTC
                    ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│                    (Port 8000)                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │                    AI Agents                      │       │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │       │
│  │  │  Question  │ │ Interview  │ │   Review   │   │       │
│  │  │ Generator  │ │   Agent    │ │ Generator  │   │       │
│  │  └────────────┘ └────────────┘ └────────────┘   │       │
│  └──────────────────────────────────────────────────┘       │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  PostgreSQL   │ │     Redis     │ │   LiveKit     │
│  (Port 5432)  │ │  (Port 6379)  │ │ (Port 7880)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## External Services

```
┌──────────────────────────────────────────────────────────┐
│                     Internet Services                     │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │      Groq      │  │   Deepgram     │                  │
│  │ (LLM - Free)   │  │ (STT - $200    │                  │
│  │ Llama 3.3 70B  │  │  free credits) │                  │
│  └────────────────┘  └────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

---

## Port Reference

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Frontend | Next.js development server |
| 8000 | Backend | FastAPI server |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache |
| 7880 | LiveKit | WebRTC HTTP |
| 7881 | LiveKit | WebRTC TCP |
| 50000-50100 | LiveKit | WebRTC UDP |

---

## Stopping Everything

```bash
# Stop frontend: Ctrl+C in frontend terminal
# Stop backend: Ctrl+C in backend terminal

# Stop Docker services
cd /Users/adityanandan/projects/intervue-ai
docker-compose down
```

---

## Common Issues & Solutions

### All services not starting?
```bash
# Check Docker is running
docker info

# Restart Docker services
docker-compose down
docker-compose up -d
```

### Backend can't connect to database?
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Verify connection
docker exec -it intervueai-postgres psql -U postgres -d intervue_ai -c "SELECT 1;"
```

### Frontend can't reach backend?
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
3. Check browser console for CORS errors

### Voice features not working?
1. Check LiveKit is running: `docker-compose logs livekit`
2. Ensure microphone permissions are granted
3. Verify WebRTC connection in browser dev tools

---

## Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload
2. **API Docs**: Visit `http://localhost:8000/docs` for interactive API documentation
3. **Database**: Use pgAdmin or TablePlus to inspect PostgreSQL
4. **Redis**: Use Redis CLI: `docker exec -it intervueai-redis redis-cli`
5. **Logs**: Check Docker logs: `docker-compose logs -f`
