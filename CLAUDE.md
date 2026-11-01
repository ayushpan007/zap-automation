# Zap Automation – Take-Home Project

## What we are building (simple words)
A small website where a user logs in with GitHub and creates a **rule** (a "Zap"):
**"When a pull request is opened on my repo → post a comment on it."**
When someone opens a real PR, our app automatically posts the comment.

- Inspired by Zapier, but tiny: one trigger + one action.
- Time box: **4 hours** (write start/stop time in README).
- Started: ____  Stopped: ____

## How Claude must work on this project
Follow these at all times (auto-loaded):
- @docs/ENGINEERING_GUIDELINES.md — architecture, FP, routing, MongoDB, security, testing, milestone report format
- @docs/UI_AND_NODE_GUIDELINES.md — Angular UI craft, design system, Node/Express quality bar
- Record significant decisions in `docs/DECISIONS.md`.

## Tech stack (required)
| Part | Tool | Job |
|---|---|---|
| Frontend | **Angular** (TypeScript) | The screens: login, Zap list, Zap editor, Copilot box |
| Backend | **Express on Node.js** (TypeScript) | Login, APIs, receiving GitHub webhooks, posting comments |
| Database | **MongoDB** (Mongoose) | Stores users, Zaps, run history |
| External | **GitHub** | OAuth login, webhooks, comments API |
| Dev tunnel | **smee.io / ngrok** | Lets GitHub reach our local server |

## Requirements checklist
### Must have
- [ ] Sign in with GitHub (OAuth)
- [ ] Zaps belong to the signed-in user
- [ ] List / create / edit a Zap: name, on/off, trigger, action, field mapping
- [ ] App picker with several dev tools (only GitHub works; others "coming soon")
- [ ] Real PR opened → comment appears on that PR
- [ ] Runnable repo + README for a teammate
- [ ] Real git habits: branches, small commits, PRs

### Bonus
- [ ] Copilot: plain English → draft Zap (OFF) → user reviews → turns ON

---

## Diagram 1 – Big picture (how the pieces connect)
```mermaid
flowchart LR
    U[User in browser] --> A[Angular frontend]
    A <-->|REST API| E[Express server on Node]
    E <--> M[(MongoDB)]
    E <-->|OAuth, API calls| G[GitHub]
    G -->|Webhook: PR opened| T[smee / ngrok tunnel]
    T --> E
    E -.->|Bonus| L[LLM for Copilot]
```

## Diagram 2 – Main flow (MUST HAVE)

### 2a. Login with GitHub
```mermaid
sequenceDiagram
    actor User
    participant App as Angular
    participant API as Express
    participant GH as GitHub
    participant DB as MongoDB
    User->>App: Click "Login with GitHub"
    App->>API: GET /auth/github
    API->>GH: Redirect to GitHub authorize page
    User->>GH: Click "Allow"
    GH->>API: Callback with code
    API->>GH: Exchange code for access token
    GH-->>API: Access token + user profile
    API->>DB: Save / update User (with token)
    API-->>App: Logged in (session cookie)
```

### 2b. Create and turn on a Zap
```mermaid
flowchart TD
    A[User opens Zap editor] --> B[Pick trigger app: GitHub]
    B --> C[Pick event: Pull request opened]
    C --> D[Pick repo from user's repos]
    D --> E[Pick action: Comment on PR]
    E --> F["Write comment with fields<br/>e.g. Thanks @{{pr.user}} for {{pr.title}}"]
    F --> G[Save Zap to MongoDB - linked to user]
    G --> H{Turn ON?}
    H -- Yes --> I[Server creates webhook on that repo via GitHub API]
    H -- No --> J[Zap saved but inactive]
    I --> K[Zap is live]
```

### 2c. PR opened → comment posted (the end-to-end magic)
```mermaid
sequenceDiagram
    actor Dev as Someone
    participant GH as GitHub
    participant API as Express
    participant DB as MongoDB
    Dev->>GH: Opens a pull request
    GH->>API: POST /webhooks/github (pull_request, action=opened)
    API->>API: Verify signature (webhook secret)
    API->>DB: Find enabled Zaps for this repo
    DB-->>API: Matching Zap(s) + owner's token
    API->>API: Fill template: {{pr.title}} → real title
    API->>GH: POST comment on that PR (using user's token)
    GH-->>Dev: Comment appears on the PR ✅
    API->>DB: Save run log (success / error)
```

## Diagram 3 – Optional flow (BONUS: Copilot)
```mermaid
flowchart TD
    A["User types:<br/>'When a PR is opened, comment thanks'"] --> B[Angular sends text to POST /api/copilot]
    B --> C[Express sends text + allowed triggers/actions to LLM]
    C --> D[LLM returns Zap as JSON]
    D --> E{Valid JSON & supported app?}
    E -- No --> F[Show error / ask user to rephrase]
    E -- Yes --> G[Save as draft Zap - OFF]
    G --> H[Open in normal Zap editor]
    H --> I[User reviews / edits]
    I --> J[User turns ON]
    J --> K[Same as main flow: webhook created, Zap is live]
```

---

## Data we store
- **User**: githubId, login, avatarUrl, accessToken
- **Zap**: userId, name, enabled, trigger {app, event, repo}, action {app, type, commentTemplate}, webhookId
- **ZapRun**: zapId, status, error, createdAt

## Build order (one branch + PR each)
1. `chore/scaffold` – Angular + Express + Mongo setup
2. `feat/github-auth` – login
3. `feat/zap-crud` – list/create/edit + app picker
4. `feat/webhook-engine` – webhook + post comment
5. `docs/readme` – setup steps, env vars, start/stop time
6. `feat/copilot` – bonus, only if time left

## How we test it
1. Start MongoDB, server, client, and tunnel
2. Log in with GitHub
3. Create a Zap on a test repo, turn it ON
4. Open a PR on that repo → comment appears
5. Turn Zap OFF → open another PR → no comment
