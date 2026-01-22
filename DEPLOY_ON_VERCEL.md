# Deploying to Vercel

This project handles Frontend and Backend as separate Vercel projects.

## 1. Backend Deployment

1.  Go to Vercel Dashboard and **Add New Project**.
2.  Import this repository.
3.  **Project Name**: e.g., `my-project-backend`.
4.  **Root Directory**: Click "Edit" and select `backend`.
5.  **Environment Variables**: Add the following (see `backend/.env.example`):
    *   `ODOO_URL`: URL of your Odoo instance (e.g. `https://my-odoo.com`).
    *   `ODOO_DB`: The Odoo database name.
    *   `ODOO_USER`: Odoo username (service account).
    *   `ODOO_PASS`: Odoo password.
    *   `CORS_ORIGINS`: Comma-separated list of allowed frontend URLs.
        *   Initial deploy: You might not know the frontend URL yet. You can set it to `*` temporarily or update it after deploying the frontend.
6.  Click **Deploy**.
7.  **Copy the assigned Domain** (e.g., `https://my-project-backend.vercel.app`). You will need this for the frontend.

## 2. Frontend Deployment

1.  Go to Vercel Dashboard and **Add New Project**.
2.  Import this repository (again).
3.  **Project Name**: e.g., `my-project-frontend`.
4.  **Root Directory**: Click "Edit" and select `frontend`.
5.  **Framework Preset**: Select **Vite** (it should auto-detect).
6.  **Environment Variables**:
    *   `VITE_API_URL`: Paste the Backend URL from step 1 (e.g., `https://my-project-backend.vercel.app`).
7.  Click **Deploy**.

## 3. Final Configuration

1.  Go back to your **Backend Project** in Vercel.
2.  Go to **Settings > Environment Variables**.
3.  Update `CORS_ORIGINS` to include your new Frontend URL (e.g., `https://my-project-frontend.vercel.app`).
4.  Redeploy the Backend (or go to Deployments -> Redeploy) for changes to take effect.

## Local Development

**Backend:**
1.  `cd backend`
2.  `npm install`
3.  Create `.env` based on `.env.example`.
4.  Run `node server.cjs` (Runs on port 3001).

**Frontend:**
1.  `cd frontend`
2.  `npm install`
3.  Create `.env.local` based on `.env.local.example`.
4.  Ensure `VITE_API_URL=http://localhost:3001`.
5.  Run `npm run dev`.
