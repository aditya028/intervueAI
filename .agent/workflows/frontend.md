---
description: How to set up and run the IntervueAI frontend (Next.js 16 + Tailwind CSS)
---

# IntervueAI Frontend Workflow

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend server running on `http://localhost:8000`
- LiveKit server running on `ws://localhost:7880`

---

## 1. Install Dependencies

```bash
cd /Users/adityanandan/projects/intervue-ai/frontend
npm install
```

Key dependencies:
- **next** (v16.1.6) - React framework with App Router
- **react** (v19.2.3) - UI library
- **tailwindcss** (v4) - Utility-first CSS
- **shadcn** - UI component library
- **lucide-react** - Icon library
- **radix-ui** - Headless UI primitives
- **class-variance-authority** - Component variant management

---

## 2. Configure Environment Variables

Create or update `.env.local`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# LiveKit WebRTC server URL
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

---

## 3. Run Development Server

// turbo
```bash
cd /Users/adityanandan/projects/intervue-ai/frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

---

## 4. Verify Frontend is Running

// turbo
Open in browser: http://localhost:3000

You should see the IntervueAI landing page.

---

## Application Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page - Start here |
| `/setup` | Interview setup form - Select topic, level, duration |
| `/brief/[id]` | Pre-interview briefing - Review questions before starting |
| `/interview/[id]` | Interview room - Voice-based interview with AI |
| `/review/[id]` | Review dashboard - Performance analysis and feedback |

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Landing page
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── setup/
│   │   │   └── page.tsx        # Interview setup form
│   │   ├── brief/
│   │   │   └── [id]/page.tsx   # Pre-interview brief
│   │   ├── interview/
│   │   │   └── [id]/page.tsx   # Interview room (voice)
│   │   └── review/
│   │       └── [id]/page.tsx   # Review dashboard
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       └── utils.ts            # Utility functions
├── public/                     # Static assets
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
└── .env.local                  # Environment variables
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Adding shadcn/ui Components

To add new UI components:

```bash
npx shadcn@latest add <component-name>
```

Example:
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Configuration is in `components.json`.

---

## Styling Guidelines

1. **Tailwind CSS v4** - Use utility classes for styling
2. **shadcn/ui** - Pre-built, customizable components in `src/components/ui/`
3. **Global styles** - Defined in `src/app/globals.css`
4. **Dark mode** - Supported via CSS variables

---

## Connecting to Backend

The frontend communicates with the backend via:

1. **REST API** - For interview CRUD operations
   - Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`)

2. **WebRTC (LiveKit)** - For real-time voice communication
   - URL: `NEXT_PUBLIC_LIVEKIT_URL` (default: `ws://localhost:7880`)

Example API call:
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/interviews`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic: 'React', level: 'intermediate' }),
});
```

---

## Troubleshooting

### "Cannot connect to backend"
1. Ensure backend is running on port 8000
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Verify CORS is configured correctly in backend

### "Module not found" errors
```bash
rm -rf node_modules .next
npm install
npm run dev
```

### TypeScript errors
```bash
npm run lint
```

### Port 3000 already in use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use a different port
npm run dev -- -p 3001
```

### Styling issues
1. Ensure Tailwind is properly configured
2. Check `postcss.config.mjs` for PostCSS settings
3. Clear `.next` cache: `rm -rf .next`

---

## Building for Production

```bash
npm run build
npm run start
```

The production build will be optimized and served on `http://localhost:3000`.
