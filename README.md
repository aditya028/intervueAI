# IntervueAI

A fully automated, voice-based AI interview platform. Practice technical interviews with an AI interviewer that adapts to your level, and get detailed performance reviews.

## Features

- **Voice-to-Voice Interview** -- Speak naturally and hear the AI respond in real-time
- **Adaptive Questioning** -- Starts with basics, goes deeper based on your answers
- **Smart Hints** -- Get a nudge when you're stuck, then move on
- **1-Hour Sessions** -- Realistic interview duration (up to 1hr 15min if needed)
- **Detailed Review** -- Per-topic scores, strengths, weaknesses, and actionable suggestions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python) |
| Voice/WebRTC | LiveKit + LiveKit Agents SDK |
| STT | Deepgram (free $200 credits) |
| LLM | Groq (free tier) - Llama 3.3 70B |
| TTS | Edge TTS (free) |
| Database | PostgreSQL |
| Cache | Redis |

**Total MVP cost: $0**

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd intervue-ai

# Frontend
cd frontend
npm install

# Backend
cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Set Up Environment

```bash
# Copy the example env file
cp backend/.env.example backend/.env

# Edit backend/.env and add your API keys:
# - GROQ_API_KEY (get from https://console.groq.com)
# - DEEPGRAM_API_KEY (get from https://console.deepgram.com)
```

### 3. Start Services

```bash
# Start PostgreSQL, Redis, and LiveKit
docker-compose up -d

# Start backend
cd backend
uvicorn app.main:app --reload --port 8000

# Start frontend (in another terminal)
cd frontend
npm run dev
```

### 4. Open the App

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
intervue-ai/
├── frontend/                  # Next.js app
│   ├── src/app/
│   │   ├── page.tsx           # Landing page
│   │   ├── setup/             # Interview setup form
│   │   ├── brief/[id]/        # Pre-interview brief
│   │   ├── interview/[id]/    # Interview room (voice)
│   │   └── review/[id]/       # Review dashboard
│   └── src/components/ui/     # shadcn/ui components
│
├── backend/                   # FastAPI Python backend
│   └── app/
│       ├── main.py            # App entry point
│       ├── api/               # API endpoints
│       ├── agents/            # AI agents
│       │   ├── question_generator.py  # Agent 1: Question Gen
│       │   ├── interview_agent.py     # Agent 2: Voice Interviewer
│       │   └── review_generator.py    # Agent 3: Review Gen
│       ├── models/            # SQLAlchemy models
│       ├── schemas/           # Pydantic schemas
│       └── core/              # Config, database
│
├── docker-compose.yml         # PostgreSQL, Redis, LiveKit
├── livekit.yaml               # LiveKit server config
└── README.md
```

## API Keys (All Free)

1. **Groq**: Sign up at [console.groq.com](https://console.groq.com) -- free tier with generous limits
2. **Deepgram**: Sign up at [console.deepgram.com](https://console.deepgram.com) -- $200 free credits
