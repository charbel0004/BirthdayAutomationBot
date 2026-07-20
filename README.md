# BirthdayAutomationBot Deployment

## Frontend

The frontend is prepared for GitHub Pages with the custom domain `youth.lrcy-jbeil.online`.

- Create `frontend/.env` from `frontend/.env.example`.
- Set `VITE_API_BASE_URL=https://backend-hidden-fog-2243.fly.dev`.
- Build from `frontend` with `npm run build`.
- Push the repository to GitHub. The workflow in `.github/workflows/deploy-pages.yml` builds `frontend/` and deploys `frontend/dist/` to GitHub Pages automatically.

The app now uses hash-based navigation (`#/blood-drive`, `#/presentations`, etc.), so refreshing on GitHub Pages stays on the current screen without relying on server-side route rewrites.

## Local Development

You can still run the project locally in two modes.

### Option 1: normal local development

- Start the backend from `backend`.
- Start the frontend from `frontend`.
- Do not set `VITE_API_BASE_URL` for local Vite dev.

```bash
cd backend
cp .env.example .env
npm install
npm run start
```

```bash
cd frontend
npm install
npm run dev
```

In this mode, Vite proxies `/api` to `http://127.0.0.1:4000`, so the frontend keeps working locally without any production URL.

### Option 2: local frontend against deployed Fly backend

If you want to test the frontend locally while still using the deployed API, create `frontend/.env` with:

```bash
VITE_API_BASE_URL=https://backend-hidden-fog-2243.fly.dev
```

Then run:

```bash
cd frontend
npm run dev
```

### Option 3: production build tested locally

If you want to test the built frontend locally against a local backend, set:

```bash
VITE_API_BASE_URL=http://127.0.0.1:4000
```

then build and preview:

```bash
cd frontend
npm run build
npm run preview
```

The backend CORS defaults now allow `localhost` and `127.0.0.1` on both Vite dev (`5173`) and Vite preview (`4173`).

## Backend

The backend is prepared for Fly.io with:

- `fly.toml` targeting `backend-hidden-fog-2243`
- a `/api/health` health check
- explicit CORS allow-list support
- a persistent `/data` volume for legacy bootstrap data
- Telegram birthday settings persisted in MongoDB
- one Fly machine kept running so the midnight scheduler can execute

Create `backend/.env` from `backend/.env.example` and set real values for:

- `MONGO_URI`
- `JWT_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
- `TELEGRAM_BOT_TOKEN` (optional fallback if not already stored in MongoDB)
- `CORS_ALLOWED_ORIGINS`

### Fly commands

```bash
fly volumes create backend_data --size 1 -a backend-hidden-fog-2243
fly secrets set \
  MONGO_URI="..." \
  JWT_SECRET="..." \
  DEFAULT_ADMIN_PASSWORD="..." \
  CORS_ALLOWED_ORIGINS="https://youth.lrcy-jbeil.online,https://lrcy-jbeil.online,https://www.lrcy-jbeil.online" \
  -a backend-hidden-fog-2243
fly deploy -a backend-hidden-fog-2243
```

If you also want the default GitHub Pages domain to work during setup, add it to `CORS_ALLOWED_ORIGINS` as well.

## Birthday Scheduler Notes

- The birthday check already reads active birthdays from MongoDB.
- Telegram settings and the `lastRunDate` guard are now stored in MongoDB as well.
- The same bot token can use separate `birthdayChatId` and `logisticsChatId` destinations.
- Logistics inventory is stored in MongoDB and items at or below their reorder point are shown on the website.
- Inventory supports a base unit plus optional packaging (for example, pieces with 24 pieces per box), including mixed stock such as full boxes plus loose pieces.
- The Add Item workflow opens in a responsive overlay, while mobile inventory records switch from a wide table to editable cards.
- Logistics is always enabled for admins. Admins can grant or remove Logistics Inventory access for each member or recruit from Users & Roles.
- The scheduler sends one consolidated logistics reorder reminder per day when low-stock items exist. Admins can also send it immediately from the Logistics page.
- The birthday and logistics scheduler still runs in the backend process, not inside MongoDB itself.
- If Fly scales to zero, a midnight timer cannot fire, so `min_machines_running = 1` is required.
