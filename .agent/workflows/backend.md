---
description: How to set up and run the IntervueAI backend (FastAPI + Python)
---

# IntervueAI Backend Workflow

## Prerequisites

- Python 3.11+
- Docker & Docker Compose (for PostgreSQL, Redis, LiveKit)
- API keys for Groq and Deepgram

---

## 1. Start Infrastructure Services

Start PostgreSQL, Redis, and LiveKit using Docker Compose:

```bash
cd /Users/adityanandan/projects/intervue-ai
docker-compose up -d
```

Verify services are running:
```bash
docker-compose ps
```

Expected services:
- `intervueai-postgres` - PostgreSQL 16 on port 5432
- `intervueai-redis` - Redis 7 on port 6379
- `intervueai-livekit` - LiveKit server on ports 7880, 7881

---

## 2. Set Up Python Virtual Environment

```bash
cd /Users/adityanandan/projects/intervue-ai/backend
python -m venv .venv
source .venv/bin/activate
```

---

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

Key dependencies:
- **fastapi** - Web framework
- **uvicorn** - ASGI server
- **sqlalchemy + asyncpg** - Async database ORM
- **pydantic-settings** - Configuration management
- **groq** - LLM API client (Llama 3.3 70B)
- **edge-tts** - Text-to-speech
- **redis** - Caching

---

## 4. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `GROQ_API_KEY` | LLM API key | [console.groq.com](https://console.groq.com) |
| `DEEPGRAM_API_KEY` | Speech-to-text API key | [console.deepgram.com](https://console.deepgram.com) |

Default configuration (already set):
- `DATABASE_URL` - `postgresql+asyncpg://postgres:postgres@localhost:5432/intervue_ai`
- `REDIS_URL` - `redis://localhost:6379/0`
- `LIVEKIT_URL` - `ws://localhost:7880`
- `LIVEKIT_API_KEY` - `devkey`
- `LIVEKIT_API_SECRET` - `secret`
- `CORS_ORIGINS` - `["http://localhost:3000"]`

---

## 5. Run the Backend Server

// turbo
```bash
cd /Users/adityanandan/projects/intervue-ai/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The server will:
- Start on `http://localhost:8000`
- Auto-create database tables on startup
- Enable hot-reload for development

---

## 6. Verify Backend is Running

// turbo
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "app": "IntervueAI"}
```

---

## API Endpoints

Base URL: `http://localhost:8000/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/interviews` | Create new interview session |
| GET | `/interviews/{id}` | Get interview details |
| GET | `/interviews/{id}/brief` | Get pre-interview brief |
| POST | `/interviews/{id}/start` | Start interview |
| POST | `/interviews/{id}/end` | End interview |
| GET | `/interviews/{id}/review` | Get interview review |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py            # FastAPI app entry point
│   ├── api/
│   │   └── interviews.py  # Interview API routes
│   ├── agents/
│   │   ├── question_generator.py  # AI question generation
│   │   ├── interview_agent.py     # Voice interview agent
│   │   └── review_generator.py    # Review generation
│   ├── core/
│   │   ├── config.py      # Settings from env vars
│   │   └── database.py    # SQLAlchemy async engine
│   ├── models/            # SQLAlchemy ORM models
│   ├── schemas/           # Pydantic request/response schemas
│   └── services/          # Business logic
├── requirements.txt
├── .env.example
└── .env                   # Your local config (gitignored)
```

---

## Troubleshooting

### Database connection fails
1. Ensure Docker containers are running: `docker-compose ps`
2. Check PostgreSQL logs: `docker-compose logs postgres`
3. Verify DATABASE_URL in `.env`

### API key errors
1. Verify GROQ_API_KEY is set correctly (no extra spaces)
2. Check Groq console for API key validity
3. Ensure you have Deepgram credits remaining

### LiveKit connection issues
1. Check LiveKit is running: `docker-compose logs livekit`
2. Verify LIVEKIT_URL, API_KEY, and API_SECRET match `livekit.yaml`

### Port conflicts
If ports 5432, 6379, 7880, or 8000 are in use:
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>
```

---

## Stopping Services

Stop the backend:
- Press `Ctrl+C` in the terminal running uvicorn

Stop Docker services:
```bash
docker-compose down
```

Stop and remove volumes (⚠️ deletes data):
```bash
docker-compose down -v
```
