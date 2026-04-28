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
- a persistent `/data` volume for `store.json`

Create `backend/.env` from `backend/.env.example` and set real values for:

- `MONGO_URI`
- `JWT_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
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
