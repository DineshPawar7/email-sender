# Member import (Next.js + BullMQ + Neon)

Flow: Excel upload -> validate -> batches -> BullMQ (Redis) -> worker -> Neon Postgres (Prisma)

## Setup
1. `npm install`
2. `cp .env.example .env` and fill in the Neon URLs
3. Redis: `docker compose up -d` (or use Upstash)
4. `npx prisma db push`
5. Terminal 1: `npm run dev`
6. Terminal 2: `npm run worker`
7. Open http://localhost:3000 and upload an .xlsx with columns: name, email, phone

Deploy note: Next.js (Vercel) and the worker are separate processes.
The worker needs a long-running host (Railway, Render, Fly.io, a VPS).
