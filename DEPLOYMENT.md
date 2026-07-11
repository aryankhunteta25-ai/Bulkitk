# Deploying Bulk It Backend — GitHub + Railway

This walks through getting this backend from your machine to a live URL: push to GitHub,
provision MongoDB, deploy on Railway, and configure environment variables.

## 0. Before you start

Confirm these two things are already true (they are, in this project):
- `package.json` has a `"start": "node server.js"` script — Railway runs this to boot your app.
- `server.js` listens on `process.env.PORT`, not a hardcoded port — Railway assigns the port
  dynamically, and the deploy will crash-loop if you hardcode `5000`.

```js
const PORT = process.env.PORT || 5000;
server.listen(PORT, ...)
```

---

## 1. Push the code to GitHub

```bash
cd bulkit-backend
git init
git add .
git commit -m "Initial commit — Bulk It backend"
```

Create an empty repo on GitHub (via the website: **New repository**, don't initialize with a
README since you already have one), then:

```bash
git remote add origin https://github.com/<your-username>/bulkit-backend.git
git branch -M main
git push -u origin main
```

`.gitignore` already excludes `node_modules/` and `.env` — **never commit your real `.env`**.
Only `.env.example` should be in the repo.

---

## 2. Get a MongoDB connection string

Pick one:

**Option A — MongoDB Atlas (recommended, free tier available)**
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with a password.
3. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) so Railway can reach it —
   or restrict to Railway's egress IPs if you want tighter security later.
4. Under **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/bulkit`

**Option B — Railway's own MongoDB plugin**
1. In your Railway project, click **New → Database → Add MongoDB**.
2. Railway provisions it and gives you a `MONGO_URL` (or similar) variable automatically —
   you'll reference it from your app service instead of pasting a connection string by hand.

Either works. Atlas is more portable if you ever move off Railway; Railway's own plugin is one
click and lives in the same dashboard as your app.

---

## 3. Create the Railway project

1. Go to [railway.com](https://railway.com) and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo**.
3. Authorize Railway to access your GitHub account if prompted, then select `bulkit-backend`.
4. Railway detects it's a Node.js app from `package.json` and starts a build automatically —
   you don't need a Dockerfile for this project.

---

## 4. Add environment variables

In your new Railway service, open the **Variables** tab and add everything from `.env.example`
with real values:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Your Atlas connection string (or reference Railway's Mongo plugin variable) |
| `JWT_SECRET` | A long random string — generate one with `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | `30d` |
| `CLIENT_ORIGIN` | The URL of your deployed frontend (see step 7) — or `*` while testing |
| `GOOGLE_MAPS_API_KEY` | From Google Cloud Console (Geocoding, Directions, Distance Matrix enabled) |
| `WAREHOUSE_LAT` / `WAREHOUSE_LNG` | Your dispatch hub's coordinates |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_CALLER_ID` | From your Twilio console |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `900000` / `300` (or your own values) |

Do **not** set `PORT` yourself — Railway injects it automatically, and `server.js` already reads
it via `process.env.PORT`.

---

## 5. Generate a public domain

In the service's **Settings → Networking** section, click **Generate Domain**. Railway gives you
a URL like `https://bulkit-backend-production.up.railway.app`.

---

## 6. Verify the deploy

Once the build finishes (watch the **Deployments** tab for logs), hit the health check:

```bash
curl https://<your-railway-domain>/api/health
# {"success":true,"message":"Bulk It API is running."}
```

If it fails, check **Deployments → View Logs** first — the two most common causes are a missing
`MONGO_URI` (connection hangs/crashes) or an invalid `JWT_SECRET` (missing entirely).

This project includes a `railway.json` that points Railway's health check at `/api/health` and
sets a restart-on-failure policy, so a bad deploy won't silently stay down.

---

## 7. Seed initial data (optional, once)

Railway's CLI lets you run one-off commands against your deployed environment:

```bash
npm i -g @railway/cli
railway login
railway link          # select your project when prompted
railway run npm run seed
railway run npm run seed:marketplace
```

This loads the sample products/shop and the demo admin + vendor account, same as running it
locally. **Change the demo admin password afterward if this is a real deployment.**

---

## 8. Connect your frontend

Whichever frontend you deploy (the app prototype, the marketing site, or the admin/vendor
portal), point its API calls at your Railway domain, e.g.:

```js
const API_BASE = 'https://<your-railway-domain>/api';
```

Then set `CLIENT_ORIGIN` in Railway's variables to that frontend's real domain (not `*`) once
it's live, so CORS is locked down properly.

For hosting the static frontend files themselves (the `.html` prototypes), GitHub Pages is the
simplest zero-cost option:
1. Push the `.html` file(s) to a repo (or a `docs/` folder in an existing one).
2. In that repo's **Settings → Pages**, set the source branch/folder.
3. GitHub gives you a `https://<username>.github.io/<repo>/` URL.

---

## 9. Ongoing deploys

Every `git push` to your connected branch (default `main`) triggers a new Railway build and
deploy automatically — no extra steps needed after this initial setup.
