# Zaps

A small workflow-automation app in the spirit of Zapier's Zaps: **a trigger plus an action**.
Users sign in with GitHub and create a Zap such as _"when a pull request is opened in `owner/repo`, comment on it"_.
Opening a real PR makes the comment appear.

TypeScript throughout, on the MEAN stack: **MongoDB · Express 5 · Angular 22 · Node 22**.

> **Timebox:** started 2026-11-01 11:11 IST · stopped:

---

## Run it locally

### Prerequisites

- Node **22.12+** (`nvm use 22`)
- MongoDB running locally (`mongodb://127.0.0.1:27017`), or a MongoDB Atlas URL
- [ngrok](https://ngrok.com) (or smee.io) so GitHub can reach your machine

### 1. Create a GitHub OAuth App

GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App

- Homepage URL: `http://localhost:4200`
- Authorization callback URL: `http://localhost:4200/auth/github/callback`

Copy the **Client ID**, then generate a **Client secret**.

### 2. Start a tunnel for webhooks

```bash
ngrok http 3000
```

Copy the `https://….ngrok-free.app` URL.

### 3. Configure the server

```bash
cd server
cp .env.example .env
```

Fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `PUBLIC_URL` (the ngrok URL). Generate the other secrets as described in `.env.example`.

### 4. Install and run (two terminals)

```bash
cd server && npm install && npm run dev     # http://localhost:3000
cd client && npm install && npm start       # http://localhost:4200
```

### 5. Try the Zap

1. Open http://localhost:4200 and click **Continue with GitHub**.
2. **New Zap** → pick a repository you administer → edit the comment → turn it on → **Create and turn on**.
   - This adds a webhook to that repository. You'll see it under the repo's Settings → Webhooks.
3. Open a pull request in that repository. Within a few seconds the comment appears, and the run shows up under **Recent runs**.

> If ngrok restarts with a new URL, update `PUBLIC_URL`, then turn the Zap off and on again so the webhook points at the new URL.

---

## Tests

```bash
cd server && npm test        # unit + API tests (needs local MongoDB; uses the `zaps_test` database)
cd client && npx ng test --watch=false
cd server && npm run typecheck
cd client && npx ng build
```

---

## How it works

```
Browser (Angular) ──/api, /auth──▶ Angular dev proxy ──▶ Express :3000 ──▶ MongoDB
                                                         ▲   │
GitHub ──POST /webhooks/github (via ngrok, HMAC-signed)──┘   └──▶ GitHub REST API (comment, hooks)
```

1. **Sign in:** `/auth/github` redirects to GitHub. On callback, the code is exchanged for a token, the user is upserted (token encrypted at rest), and a session cookie is set (httpOnly JWT).
2. **Turn a Zap on:** the server checks that the user is an admin of the repo, then creates one webhook per repo.
3. **PR opened:** GitHub posts to `/webhooks/github`. The server verifies the signature, finds enabled Zaps for that repo, records a run (a unique index makes redeliveries no-ops), renders the template, and posts the comment with the Zap owner's token.

Diagrams are in [`CLAUDE.md`](CLAUDE.md). The reasons behind each choice are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

### API

| Method               | Path                    | Auth            | Purpose                                        |
| -------------------- | ----------------------- | --------------- | ---------------------------------------------- |
| GET                  | `/auth/github`          | –               | Start OAuth (sets `state` cookie)              |
| GET                  | `/auth/github/callback` | `state`         | Finish OAuth, set session, redirect to `/zaps` |
| POST                 | `/auth/logout`          | –               | Clear session                                  |
| GET                  | `/api/me`               | session         | Current user                                   |
| GET                  | `/api/apps`             | session         | App catalog for the picker                     |
| GET                  | `/api/github/repos`     | session         | Repos the user administers                     |
| GET / POST           | `/api/zaps`             | session         | List / create own Zaps                         |
| GET / PATCH / DELETE | `/api/zaps/:id`         | session + owner | Read / edit (incl. on/off) / delete            |
| GET                  | `/api/zaps/:id/runs`    | session + owner | Last 20 runs                                   |
| POST                 | `/webhooks/github`      | HMAC signature  | GitHub deliveries                              |

Errors are always `{ "error": { "code", "message", "details?" } }`.

### Client routes

| URL         | Page                                         | Guard                                     |
| ----------- | -------------------------------------------- | ----------------------------------------- |
| `/login`    | Sign in (`?error=` shows the failure reason) | guest only                                |
| `/zaps`     | Zap list with on/off switches                | signed in                                 |
| `/zaps/new` | Builder                                      | signed in                                 |
| `/zaps/:id` | Builder + recent runs                        | signed in (the server enforces ownership) |
| `**`        | Not found                                    | –                                         |

### Layout

```
server/src/
  app.ts, server.ts          wiring (every route is mounted in app.ts) / process entry
  config/env.ts              env validation (Zod)
  modules/
    auth/                    OAuth flow, session cookie
    zaps/                    CRUD: routes → controller → service, schema (Zod), mapper (DTOs)
    webhooks/                receiver, signature check, PR event parsing, repo-hook lifecycle
    github/                  REST client (the GitHub side-effect boundary)
    catalog/                 app picker data
    runs/, users/            models
  lib/                       pure helpers: template rendering, crypto
client/src/app/
  core/                      API service, auth state, guard, interceptor, types
  features/                  login, zaps (list, editor, picker, comment editor, run history)
  shared/                    toggle, pure helpers
```

## Known limitations

- Only the "PR opened → comment" pair runs. Other apps are shown as "coming soon".
- Comments are posted as the signed-in user (OAuth App). A GitHub App with a bot identity is the production path (see D4).
- Changing `PUBLIC_URL` doesn't move existing webhooks automatically.
- Sessions can't be revoked server-side before they expire (7 days).
- A failed comment isn't retried. Each PR event is recorded once per Zap to stop duplicate comments (D9), so a GitHub redelivery of a failed event is skipped.
- If two users toggle Zaps on the same repo at the same instant (one turns the last Zap off while another turns one on), the shared webhook can be removed under the new Zap. Toggling that Zap off and on again restores it. A per-repo lock or refcount would close this.
- A webhook deleted by hand on GitHub isn't recreated automatically. Toggle the Zap off and on to add it back.
- The repository picker shows the first 100 repos you admin (no pagination).
- `trust proxy` is set to one hop for running behind a tunnel or load balancer. Without a proxy in front, the rate limiter could be bypassed with a spoofed `X-Forwarded-For`.
- The bonus Copilot (natural language → draft Zap) was not built.
