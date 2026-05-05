# Jarvo ATS

Phase 1 starter for a portfolio-ready Applicant Tracking System using:

- Next.js + Bootstrap (`apps/web`)
- Node.js + Express + MongoDB (`apps/api`)
- Shared DTO/contracts (`packages/common`)

## Quick start

1. Copy `.env.example` to `.env` and adjust values.
   - Ensure `NEXT_PUBLIC_API_BASE_URL` points to your running API URL.
2. Install dependencies:
   - `npm install`
3. Start backend:
   - `npm run dev:api`
4. Start frontend (new terminal):
   - `npm run dev:web`

## Current features

- Mock login endpoint with role token (`/auth/mock-login`)
- RBAC middleware
- Jobs and candidates APIs (tenant-aware)
- Responsive Bootstrap ATS dashboard
- Create/list jobs and candidates backed by MongoDB
