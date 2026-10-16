# AI Access Request Portal

A web portal for submitting and managing employee AI tool access requests.

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Migration

In the Supabase dashboard, go to **SQL Editor** and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, and seed data.

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your real values:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these values in your Supabase project under **Settings → API**.

### 4. Create First Admin User

1. In Supabase, go to **Authentication → Users** and create a new user.
2. Copy the user's UUID from the users list.
3. In the **SQL Editor**, run:

```sql
INSERT INTO profiles (user_id, display_name, role)
VALUES ('<your-user-uuid>', 'Admin', 'admin');
```

### 5. Deploy Edge Functions (optional for local dev)

If using Supabase CLI:

```bash
supabase functions deploy submit-batch
supabase functions deploy decide-batch
```

Set the `ALLOWED_ORIGIN` secret for CORS:

```bash
supabase secrets set ALLOWED_ORIGIN=https://your-frontend-domain.com
```

### 6. Run Locally

```bash
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

- Public form: `/`
- Admin login: `/admin/login`
- Admin dashboard: `/admin/dashboard`

## Deploy to Firebase Hosting

### Prerequisites
```bash
npm install -g firebase-tools
firebase login
```

### One-time setup
```bash
# Replace with your actual Firebase project ID in .firebaserc
firebase use your-firebase-project-id
```

### Deploy
```bash
npm run build
firebase deploy --only hosting
```

That's it. The `firebase.json` rewrites all routes to `index.html` so React Router works correctly on direct URL access and page refresh.

> **Note on the Edge Functions**: The Supabase edge functions (`submit-batch`, `decide-batch`) run on Supabase's infrastructure — not Firebase. You only deploy the frontend to Firebase. The edge functions are deployed separately via the Supabase CLI (`supabase functions deploy submit-batch`).

## Development

```bash
# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Edge Functions)
- **Key libraries**: React Query, React Router, Radix UI, XLSX

### Edge Functions

- `submit-batch` — public endpoint for submitting access requests (rate-limited)
- `decide-batch` — admin-only bulk approve/decline

### Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Admin user profiles |
| `departments` | Department list |
| `ai_tools` | AI tool catalog |
| `request_batches` | Batch submissions |
| `access_requests` | Individual employee requests |
| `audit_logs` | Decision audit trail |
| `rate_limits` | Submission rate limiting |
