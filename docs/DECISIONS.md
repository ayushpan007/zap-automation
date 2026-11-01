# Decision log

Short records of the choices worth defending. Newest last.

---

## D1 — Two apps (`server/`, `client/`), one repo, no shared package
**Context:** MEAN stack, TypeScript everywhere, 4-hour budget.
**Decision:** Express API in `server/`, Angular SPA in `client/`. API types are mirrored in `client/src/app/core/api.types.ts` rather than shared through a workspace package.
**Why:** Simplest layout to run and explain. The contract is small (≈6 types).
**Trade-off:** Types can drift. Mitigated by server-side runtime validation (Zod) and API tests.
**Revisit when:** The contract grows, or a second client appears → extract a `shared/` package or generate types from an OpenAPI spec.

## D2 — Express 5 with feature modules
**Decision:** `src/modules/<feature>/` with `*.routes.ts` (wiring) → `*.controller.ts` (HTTP in/out) → `*.service.ts` (rules + DB) and pure helpers (`*.mapper.ts`, `*.schema.ts`, `lib/`). All routers are mounted in `app.ts`.
**Why:** You can find any endpoint from one file. Express 5 forwards rejected promises to the error handler, so there are no `try/catch` wrappers in controllers.
**Alternative:** NestJS. Rejected: more framework to learn and explain for a small API.

## D3 — Dependency injection by function parameters (`AppDeps`)
**Decision:** `createApp({ config, github })`. Services receive `deps` explicitly. Only `server.ts` reads `process.env`, connects to Mongo and listens.
**Why:** Side effects stay at the edges. Tests pass a fake GitHub client instead of mocking modules.
**Trade-off:** `deps` is threaded through some calls. That is acceptable at this size.

## D4 — GitHub OAuth App, hand-written flow, scope `repo`
**Decision:** A standard OAuth web flow written by hand (≈40 lines), with no Passport. `state` is stored in a short-lived httpOnly cookie and compared in constant time (CSRF protection). Scope is `repo read:user`.
**Why `repo`:** It is the narrowest classic OAuth scope that allows both creating repo webhooks and commenting. Comments are posted as the user, which matches the brief ("a repo they control").
**Alternative:** A GitHub App, which has fine-grained permissions, installation tokens, one org-level webhook and comments posted by a bot identity. That is the better production choice, but its setup (private key, installation flow) costs time and is harder to demo.
**Revisit when:** Multi-user or multi-org usage, or when a bot identity is wanted.

## D5 — Session: signed JWT in an httpOnly, SameSite=Lax cookie
**Why:** The browser sends it automatically, and JavaScript can't read it, which limits the damage from XSS. SameSite=Lax blocks cross-site POSTs (CSRF), and a JWT is stateless, so there's no session store.
**Trade-off:** It can't be revoked server-side before it expires (7 days). Logout clears the cookie.
**Revisit when:** Revocation is needed → server sessions (connect-mongo) or a token denylist.

## D6 — GitHub tokens encrypted at rest (AES-256-GCM)
**Why:** A token with `repo` scope can write to the user's repositories. If the database leaks without the key, no tokens leak. The field is `select: false`, so it is never loaded by accident.

## D7 — Same-origin in dev via the Angular proxy (no CORS)
**Decision:** `ng serve` proxies `/api` and `/auth` to `:3000`. The OAuth callback URL is `http://localhost:4200/auth/github/callback`.
**Why:** The cookie and the API share one origin, so there is no CORS configuration, no `withCredentials`, and no third-party-cookie issues.
**Production:** Serve the Angular build from the same domain (reverse proxy or Express static).

## D8 — Webhooks: one per repository, registered when a Zap is turned on
**Decision:** Turning a Zap on (1) verifies with GitHub that the user is an admin of the repo, (2) creates the webhook if the repo has none (adopting an existing one on 422), and (3) records it in `repohooks` (unique `repoId`). Turning off the last enabled Zap on a repo deletes the hook (best effort).
**Why one per repo:** Two Zaps on one repo would otherwise create two hooks and receive every event twice.
**Why the admin check:** Without it, a user could submit someone else's repo id, piggy-back on an existing hook, and read that repo's PR titles in their run log.
**Order:** The hook is created before the "enabled" Zap is saved, so a saved, enabled Zap always has a hook.

## D9 — Idempotent execution via a unique `(zapId, eventKey)` index on runs
**Decision:** Before commenting, insert a `Run` with `eventKey = pull_request:<pr id>:opened`. A duplicate-key error means "already handled", so the Zap is skipped.
**Why:** GitHub retries deliveries and users can redeliver manually. The database enforces "one comment per Zap per PR", even under concurrency, with no locks or transactions.

## D10 — Webhook signature over the raw body
**Decision:** The `/webhooks` router uses `express.raw()` and is mounted before `express.json()`. The HMAC SHA-256 is compared with `timingSafeEqual`.
**Why:** Re-serialized JSON is not byte-identical to what GitHub signed. The endpoint is public, so the signature is its authentication.

## D11 — Data model
- `users` — unique `githubId` (stable; logins can be renamed). Login is an atomic upsert.
- `zaps` — trigger and action **embedded**: they are always read with the Zap and have no lifecycle of their own. Indexes: `{userId, updatedAt}` for the list page, and `{trigger.repo.id, trigger.event, enabled}` for webhook matching.
- `runs` — **separate collection**: unbounded growth. Indexes: unique `{zapId, eventKey}` (D9) and `{zapId, createdAt}` (history).
- `repohooks` — unique `repoId` (D8).
- Ownership is enforced in queries (`findOne({ _id, userId })`), so another user's Zap is indistinguishable from a missing one (404, not 403).

## D12 — Field mapping as `{{path}}` templates with an allow-list
**Decision:** The catalog declares each trigger's fields. Saving rejects unknown tokens on the server, and rendering is a pure function. The client keeps a small copy for instant feedback and the live preview.
**Why:** Easy to explain and test. Users can't reach arbitrary payload data.
**Trade-off:** The token rule is duplicated on the client. The server stays authoritative.

## D13 — App picker: GitHub runnable, others visible but disabled
**Decision:** The catalog lists GitLab, Jira, Linear, Slack, Sentry and Vercel with `available: false`. In the UI they are disabled and labelled "Coming soon", and the server rejects them in validation.
**Why:** Shows the product's shape without any button pretending to work.

## D14 — Angular: standalone components, Signals for UI state, RxJS for HTTP
- **Signals** (`signal`, `computed`) hold synchronous UI state: the list, the load state, pending toggles, the current user.
- **Observables** come from `HttpClient` (cancellable, composable). They complete after one response, so the one-shot `subscribe()` calls cannot leak. Long-lived streams (`valueChanges`) are converted with `toSignal`, which unsubscribes on destroy.
- **No NgRx**: state is page-local, except "current user", which one service holds.
- **OnPush everywhere**: components re-render only when inputs or signals change.
- **Reactive Forms** for the builder (typed controls, a custom token validator).

## D15 — Controlled toggle, pessimistic update
**Decision:** The switch always reflects server state. Turning a Zap on waits for the API.
**Why:** Turning on can legitimately fail (no admin rights, webhook creation fails). An optimistic switch would lie.

## D16 — Testing
- Both apps use Vitest (Angular 22's default runner), so there is one framework.
- Server: pure unit tests plus API tests via supertest against a real local MongoDB test database (`zaps_test`), with GitHub faked. This tests indexes and duplicate-key behaviour for real.
- Client: pure helpers, list states and toggle failure, and the guard.

## D17 — Copilot: Claude drafts, the server validates, the user saves
**Decision:** `POST /api/copilot/draft` sends the user's text plus their admin repo names to Claude (`claude-opus-5-5`, low effort) with a structured-output schema (`supported`, `explanation`, `name`, `commentBody`, `repoFullName`). The server then treats the answer as untrusted input: unsupported requests become a 400 with the model's explanation, unknown `{{tokens}}` are rejected by the same rule as the Zap API (D12), and the repo is kept only if it is in the user's admin list. The draft is **not saved**. The client passes it to the builder in router navigation state, switched off.
**Why:**
- Structured output means no JSON parsing of free text. Validation after it means a confused or manipulated model can't produce a Zap the API would reject or point at someone else's repo.
- Not saving keeps the "review, then turn it on" step real and avoids half-finished drafts in the database.
- `CopilotModel` is injected like the GitHub client (D3), so tests use a fake and never call the paid API.
- Optional by config: without `ANTHROPIC_API_KEY` the route answers 503 and the rest of the app is unaffected.
- `fallbacks: "default"` lets the API retry a safety-classifier refusal on a recommended model instead of failing.
**Alternatives:** Save drafts as disabled Zaps (simpler hand-off, but leaves clutter and needs a repo up front). Tool use instead of structured output (more moving parts for a one-shot extraction). Calling Claude from the browser (would expose the API key).
**Trade-offs:** A draft is lost on page reload. Each call costs money, so it has its own rate limit (10/min). The model can still misread intent; the review step is the safeguard.
