# Campus Lost & Found Platform

Full-stack coursework prototype for structured lost/found reports, explainable score-based matching, and transaction-safe claim verification.

## Run locally

1. Create a PostgreSQL database named `campus_lost_found`, copy `.env.example` to `.env`, and set `DATABASE_URL`.
2. Start MySQL with `docker compose up -d mysql` (it is exposed on port 3307).
3. Run `npm install` from this folder.
4. Run `npm run db:seed` to create the schema and sample data.
5. Run `npm run dev`, then open `http://localhost:5173`.

The API assumes a demo user from the `x-user-id` header. The UI sends user `1` for student actions and admin `3` for final approval.

## Important endpoints

- `GET /api/items?kind=lost|found`
- `POST /api/items`
- `GET /api/matches/:lostId`
- `POST /api/claims`
- `POST /api/claims/:id/approve` (admin only; locks the found item)
