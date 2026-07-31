# SIGDI — Système Intelligent de Gestion des Demandes Internes

A full-stack internal request management system built for WIFI Maroc. Employees submit support tickets, support agents manage the queue, technicians handle field interventions, and admins oversee everything from a unified dashboard.

---

## Tech Stack

| Layer     | Technology                             |
|-----------|----------------------------------------|
| Frontend  | Next.js 16 · React 19 · Tailwind CSS v4 |
| Backend   | Express.js · TypeScript                |
| Database  | MySQL 8.0                              |
| Auth      | JWT (jsonwebtoken) + bcrypt            |
| Charts    | Recharts                               |
| Icons     | Lucide React                           |

---

## Project Structure

```
.
├── app/                         # Next.js App Router (frontend)
│   ├── (dashboard)/             # Protected dashboard routes
│   │   ├── dashboard/           # Role-based home page
│   │   ├── tickets/             # Ticket list, detail, create
│   │   ├── interventions/       # Field intervention tracking
│   │   ├── analytics/           # KPI charts (admin & agent)
│   │   ├── users/               # User management (admin)
│   │   ├── zones/               # Zone management
│   │   ├── notifications/       # User notifications
│   │   └── profile/             # User profile & settings
│   └── login/                   # Login page
├── components/                  # Shared UI components
│   ├── sidebar.tsx              # Navigation sidebar
│   ├── topbar.tsx               # Top header bar
│   ├── stat-card.tsx            # KPI metric card
│   └── status-badge.tsx         # Status/priority/role badges
├── lib/                         # Frontend utilities & data
│   ├── types.ts                 # Shared TypeScript types
│   ├── auth-context.tsx         # React auth context
│   ├── mock-data.ts             # Demo data (frontend dev mode)
│   └── helpers.ts               # Label/color maps & formatters
├── backend/                     # Express.js REST API
│   ├── src/
│   │   ├── server.ts            # Express app entry point
│   │   ├── config/
│   │   │   ├── database.ts      # MySQL connection pool
│   │   │   └── jwt.ts           # Token sign/verify
│   │   ├── middleware/
│   │   │   ├── authenticate.ts  # JWT auth guard
│   │   │   ├── authorize.ts     # Role-based access guard
│   │   │   └── errorHandler.ts  # Global error handler
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── tickets.controller.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── interventions.controller.ts
│   │   │   ├── zones.controller.ts
│   │   │   └── analytics.controller.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── tickets.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── interventions.routes.ts
│   │   │   ├── zones.routes.ts
│   │   │   └── analytics.routes.ts
│   │   └── types/
│   │       └── index.ts         # Backend TypeScript types
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── database/
    ├── schema.sql               # Full DB schema (MySQL)
    └── seed.sql                 # Demo seed data
```

---

## User Roles

| Role            | Email                    | Capabilities                                      |
|-----------------|--------------------------|---------------------------------------------------|
| `admin`         | admin@wifimaroc.ma       | Full access — users, zones, all tickets, analytics |
| `support_agent` | agent1@wifimaroc.ma      | Manage tickets, assign technicians, analytics     |
| `technician`    | tech1@wifimaroc.ma       | View & update own interventions                   |
| `employee`      | emp1@wifimaroc.ma        | Submit and track own tickets                      |

**Demo password for all accounts:** `Password123!`

---

## Getting Started

### 1. Frontend (Next.js)

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend runs on **http://localhost:3000** and uses mock data by default — no backend required for the UI demo.

### 2. Database (MySQL)

```bash
# Create schema
mysql -u root -p < database/schema.sql

# Load seed data
mysql -u root -p < database/seed.sql
```

### 3. Backend (Express)

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret

# Start development server (with hot-reload)
npm run dev

# Build for production
npm run build
npm start
```

The API runs on **http://localhost:4000**.

---

## API Reference

### Authentication
| Method | Endpoint         | Auth | Description           |
|--------|-----------------|------|-----------------------|
| POST   | /api/auth/login  | No   | Sign in, returns JWT  |
| GET    | /api/auth/me     | JWT  | Get current user      |

### Tickets
| Method | Endpoint                   | Auth         | Description               |
|--------|---------------------------|--------------|---------------------------|
| GET    | /api/tickets               | JWT          | List tickets (role-scoped)|
| POST   | /api/tickets               | agent/admin/employee | Create ticket    |
| GET    | /api/tickets/:id           | JWT          | Get ticket detail         |
| PATCH  | /api/tickets/:id           | agent/admin/tech | Update status/assign  |
| POST   | /api/tickets/:id/comments  | JWT          | Add comment               |

### Interventions
| Method | Endpoint               | Auth         | Description              |
|--------|------------------------|--------------|--------------------------|
| GET    | /api/interventions     | JWT          | List (role-scoped)       |
| POST   | /api/interventions     | agent/admin  | Create & assign tech     |
| PATCH  | /api/interventions/:id | JWT          | Update status/notes      |

### Users *(admin only)*
| Method | Endpoint        | Auth  | Description       |
|--------|----------------|-------|-------------------|
| GET    | /api/users      | admin | List all users    |
| POST   | /api/users      | admin | Create user       |
| GET    | /api/users/:id  | admin | Get user          |
| PATCH  | /api/users/:id  | admin | Update user       |

### Zones
| Method | Endpoint       | Auth         | Description    |
|--------|---------------|--------------|----------------|
| GET    | /api/zones     | JWT          | List zones     |
| POST   | /api/zones     | admin        | Create zone    |
| PATCH  | /api/zones/:id | admin        | Update zone    |

### Analytics
| Method | Endpoint          | Auth         | Description    |
|--------|------------------|--------------|----------------|
| GET    | /api/analytics/kpi | admin/agent | KPI stats      |

---

## Ticket Lifecycle

```
created → assigned → in_progress → resolved → closed
```

- **created** — Submitted by employee, awaiting assignment
- **assigned** — Support agent assigned a technician
- **in_progress** — Technician is actively working
- **resolved** — Issue fixed, pending employee confirmation
- **closed** — Fully closed

---

## SLA Policy

| Priority | Response Target | Resolution Target |
|----------|----------------|-------------------|
| Critical | 1 hour         | 4 hours           |
| High     | 4 hours        | 24 hours          |
| Medium   | 8 hours        | 72 hours          |
| Low      | 24 hours       | 7 days            |

---

## Environment Variables

### Frontend (`/`)
No environment variables are required for the demo (uses mock data).

### Backend (`/backend/.env`)
```env
PORT=4000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sigdi
JWT_SECRET=long_random_secret_here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```
"# internal-ticket-management-system" 
"# internal-ticket-management-system" 
