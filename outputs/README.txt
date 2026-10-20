CAMPUS LOST & FOUND PLATFORM

Full-stack coursework prototype for structured lost/found reports, explainable score-based matching, and transaction-safe claim verification.

FEATURES

- Student login and separate admin login.
- Lost/found report creation with category, location, date, description, image URL, and reward fields.
- Weighted match scoring using category, location, date proximity, and keyword similarity.
- Claim request workflow with administrator verification and item locking.
- Admin dashboard showing site visits, report totals, open reports, approved claims, and report categories.
- Admin-only delete controls for reports and pending claim requests.

TECH STACK

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL 8.4
- Local database runtime: Docker Compose (port 3307)

RUN LOCALLY

1. Start Docker Desktop.
2. From the project folder, run: docker compose up -d mysql
3. Copy .env.example to .env and set DATABASE_URL if required.
4. Run: npm install
5. Run: npm run db:seed
   This creates the schema and adds demo data without deleting existing records.
6. Run: npm run dev
7. Open: http://127.0.0.1:5173

DEMO ACCOUNTS

- Student: aarav@campus.edu
- Administrator: admin@campus.edu
- Demo password: foundly

IMPORTANT API ENDPOINTS

- POST /api/auth/login
- POST /api/traffic
- GET /api/items?kind=lost|found
- POST /api/items
- GET /api/matches/:lostId
- POST /api/claims
- POST /api/claims/:id/approve (administrator only)
- GET /api/admin/analytics (administrator only)
- GET /api/admin/claims (administrator only)
- DELETE /api/admin/items/:itemId (administrator only)
- DELETE /api/admin/claims/:claimId (administrator only)
