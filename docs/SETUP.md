# Setup, deployment and phone installation

Total time: about 20 minutes, all free. Steps marked 🔑 need your own accounts — nobody else can
do them for you. Everything else is scripted.

The app works **without** step 3 (sync): progress then stays on each device (Settings → Export /
Import moves it). Do steps 1–2 first, try it, then add sync.

---

## 1. Run it on your laptop (5 min)

You need Node.js ≥ 20 (`node -v`) and Python ≥ 3.10 (`python3 --version`).

```bash
cd python-mcq-trainer
```

```bash
npm run setup
```

(creates `.venv` with NumPy/Pandas/Flask… to verify the questions, then installs the Node packages)

```bash
npm run dev
```

Open the printed `http://localhost:5173` address. Useful commands:

| Command | What it does |
|---|---|
| `npm run verify` | executes every question and reports wrong/ambiguous answer keys |
| `npm test` | unit tests (scoring, spaced repetition, mock blueprint, sync convergence) |
| `npm run e2e` | browser tests (answering, mock timer/resume, offline, two-device sync) |
| `npm run build` | strict verification + type-check + production build into `dist/` |

## 2. Publish it on the internet (GitHub Pages, 5 min)

GitHub Pages is free for **public** repositories (and for private ones with GitHub Pro, which
students get free with the GitHub Student Developer Pack). The repository contains no secret and
no slide text, only the questions and lessons written for this app.

🔑 Log in to the GitHub CLI once with permission to push workflows (`gh auth login`, then
`gh auth refresh -s workflow`), and from the project folder:

```bash
gh repo create python-mcq-trainer --public --source . --push
```

1. On github.com open the repository → **Settings → Pages** → *Build and deployment* →
   Source: **GitHub Actions**.
2. **Actions** tab → *Verify, build & deploy* → *Run workflow* (it also runs on every push).
   It executes all questions, runs the tests, builds and publishes.
3. Your app is at `https://<your-github-username>.github.io/python-mcq-trainer/`.

*Alternative without GitHub:* `npm run build`, then drag the `dist` folder onto
<https://app.netlify.com/drop> (free account). For sync, put the two variables of step 3.5 in a
`.env.local` file before building.

## 3. Turn on sync between laptop and phone (Supabase, 10 min)

1. 🔑 Create a free account at <https://supabase.com> → **New project** (any name, e.g. `pyquiz`;
   choose a strong DB password and keep it in your password manager; region: the closest one, e.g.
   *West EU (Paris)*). Wait ~2 minutes until it is ready.
2. **SQL Editor → New query**: paste the whole content of [`supabase/schema.sql`](../supabase/schema.sql)
   → **Run**. It creates the append-only `events` table with row-level security.
3. Nothing to change in **Authentication → Sign In / Providers → Email**: the Email provider and
   "Confirm email" are on by default. You sign in with **email + password**, which works inside the
   installed iPhone app and needs no custom email. (Supabase no longer lets free projects edit email
   templates without your own SMTP server, so the optional "email code" method only works if you
   add SMTP under *Authentication → Emails → SMTP Settings*.)
4. **Authentication → URL Configuration** (under *CONFIGURATION*): *Site URL* = your app URL from step 2
   (e.g. `https://<user>.github.io/python-mcq-trainer/`); add the same URL and
   `http://localhost:5173/` under *Redirect URLs*.
5. **Project Settings** (gear icon, bottom left) → **API Keys** / **Data API**: copy the **Project URL** and the **anon public** key (this key is
   meant to be public; your data is protected by row-level security).
   - GitHub repository → **Settings → Secrets and variables → Actions → Variables** →
     *New repository variable*: `SUPABASE_URL` = the URL, `SUPABASE_ANON_KEY` = the key.
     Re-run the *Verify, build & deploy* workflow.
   - For local development create `.env.local` (never committed):

     ```bash
     printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' 'https://xxxx.supabase.co' 'eyJ...' > .env.local
     ```

6. Open the app → ⚙︎ Settings → *Sync between devices* → your email + a password (8+ characters)
   → **Create account**. Click the link in the confirmation email once (any browser; check spam),
   then back in the app → **Sign in**. The pill at the top turns to **Synced**. On every other
   device: same email and password → **Sign in** (no email needed).
7. Optional, once all your devices are signed in: **Authentication → Sign In / Providers →**
   disable *Allow new users to sign up*, so nobody else can create an account on your project.

**Keep-alive.** Free Supabase projects pause after 7 days without any request. The workflow
`.github/workflows/keepalive.yml` pings the project every Monday and Thursday using the two
variables above, so this should never happen. If it ever does: Supabase dashboard → *Restore
project*. Nothing is lost meanwhile — the app keeps working offline and uploads afterwards.

## 4. Install on your phone

**iPhone (Safari):** open the app URL → Share button → **Add to Home Screen** → Add. Launch it
from the home screen (it runs full screen and offline), then sign in inside the app (Settings →
email + password). Note: the home-screen app has its own storage, separate from Safari tabs — sign
in there, not in Safari.

**Android (Chrome):** open the URL → ⋮ menu → **Install app** (or *Add to Home screen*).

**Laptop:** Chrome/Edge show an *Install* icon in the address bar; or just bookmark the URL.

First launch needs the network once; after that the whole app and all questions are cached.
New versions are downloaded in the background and used at the next launch.

## 5. Daily use

* Home → **Continue**, **Smart practice (10 min)**, **Mock exam**, **Due reviews**.
* Settings → *Exam scoring*: switch to negative marking or partial credit for "select all" once you
  know the real rules.
* Settings → *Export progress* now and then (JSON backup; Import merges it back without duplicates).

## Troubleshooting

| Problem | Fix |
|---|---|
| Pill says **Sign in to sync** | Settings → email + password → Sign in. |
| No confirmation email | Check spam. Supabase's built-in mailer sends only a few emails per hour: wait a bit. |
| "Email not confirmed" | Click the link in the confirmation email first, then Sign in again. |
| **Sync error** | Tap the pill → Settings shows the message. Usually the project is paused (restore it) or the SQL of step 3.2 was not run. |
| App shows old questions | Close and reopen the app (the update applies at the next launch). |
| `npm run build` fails on verification | A question's marked answer does not match real Python: run `npm run verify` and fix the JSON. |
