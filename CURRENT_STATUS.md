# Jotihunt V3 — Status & Build Tracker

> Living document. Update this whenever a phase moves. Last updated: **2026-08-31** (Phase 5).
> Detailed sub-plans: [FOX_PREDICTION_PLAN.md](./FOX_PREDICTION_PLAN.md) (predictor),
> [MOBILE_TODO.md](./MOBILE_TODO.md) (mobile parity).

## Deployment

- Push to `main` auto-deploys to EC2 via [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  (backup db+.env → `git reset --hard` → restore → build → migrate → `pm2 restart`).
- `backend/.env` is **gitignored** and lives only on the server; the deploy backs it
  up/restores it around the reset. Never commit it.
- Post-deploy smoke check:
  - `GET https://jotihunt-gog.nl/api/health` → `200`
  - `POST /api/auth/login` bad creds → `401`

## Security fixes (done)

- **JWT secret** — was the committed placeholder (forgeable admin tokens). Rotated on
  the server; `.env` untracked; app now refuses to boot without a real secret; env is
  loaded first via `src/loadEnv.ts` (explicit path, before route imports).
- **Socket auth** — the Socket.IO layer was fully unauthenticated (anyone could join
  any room + receive a global live-GPS firehose). Now JWT-verified on connect, rooms
  assigned server-side from membership, location broadcast scoped to the tenant room.

## Build plan — accounts / deelgebieden / chat / admin / navigation

Sequenced data model → enforcement → UI. Key calls: "deelgebied" is a NEW entity (not
the `areas`/fox table); multi-tenancy is frozen (prod is single-tenant — new work
ignores `tenant_id`); there is no session store (stateless JWT).

| Phase | Scope | Status |
|---|---|---|
| 0 | Security stop-the-bleed (JWT, scope location firehose) | ✅ done |
| 1 | Socket auth + per-user socket registry | ✅ done & deployed |
| 2 | Account states + public signup hardening | ✅ done (see below) |
| 3 | Approval enforcement in token middleware + socket connect; suspension force-disconnect | ✅ done & deployed |
| 4 | Deelgebieden table + user↔deelgebied memberships (joined_at/left_at) | ✅ done & deployed (groups + teams.area retirement deferred) |
| 5 | Membership-derived chat channels (per deelgebied) + send-time re-check | ✅ done & deployed (map filtering → Phase 8) |
| 6 | Mobile chat (channels API) + hunt-cooldown UI (see MOBILE_TODO.md) | ⬜ next |
| 7 | Admin panel: pending queue, approve+assign, reassignment roster | ⬜ |
| 8 | Map filtering default (own deelgebied + toggle) + chat unread markers | ⬜ |
| 9 | In-app navigation (routing polyline over Leaflet) — BLOCKED on Jotihunt rules check | ⬜ |

### Phase 2 — account states (done 2026-08-30)

- Migration `20260830000000_add_user_account_status.js`: adds `users.status`
  (pending/approved/rejected/suspended, default pending) + `users.scouting_group`;
  backfills all existing users to `approved`. `is_active` stays the hard kill switch.
- `POST /auth/register`: requires first name, last name, scouting group; forces
  `role=user` + `status=pending` (any role/status in the body is ignored); IP
  rate-limited (10/hr). Returns a "pending review" message.
- `POST /auth/login`: rate-limited (30 / 15 min); rejects non-approved accounts with a
  clear per-status message + `account_status`.
- `app.set('trust proxy', 1)` so per-IP limits see the real client behind nginx.
- Web signup form collects scouting group; success message says "pending approval".
### Phase 3 — approval enforcement (done 2026-08-30)

- `authenticateToken` (HTTP) and `authenticateSocket` (socket connect) now reject any
  account whose `status` isn't `approved` — enforcing mid-session, not just at login.
  Both fail open on null/unknown status so a legacy row is never wrongly locked out.
- `PATCH /api/users/:id/status` (admin, tenant-scoped): set approved/rejected/
  suspended/pending; any non-approved status calls `disconnectUser()` to close the
  target's live sockets immediately (suspension closes connections, not just blocks
  the next request).
- Verified locally: 10/10 — pending blocked; approve→login works; approved token works
  on HTTP + socket; suspend→same token gets 403 (HTTP) and refused (socket); invalid
  status 400; non-admin forbidden.
- **Not yet:** admin UI to drive the status endpoint (Phase 7). The endpoint exists and
  is tested; the pending-queue / approve-and-assign UI is Phase 7.

### Phase 4 — deelgebieden + assignment (done 2026-08-30)

- Migration `20260830000001_create_deelgebieden.js`: `deelgebieden` (name, is_active,
  archived_at) seeded Alpha–Foxtrot; `user_deelgebied_memberships` (user_id,
  deelgebied_id, joined_at, left_at) — left_at NULL = current member; ended rows kept
  for movement history. No tenant_id (multi-tenancy frozen — decision taken 2026-08-30).
- `/api/deelgebieden` routes: list (active; admins `?all=true`), `GET /mine` (current
  user's memberships — empty array when unassigned), admin create, admin
  `PATCH /:id/archive` (soft, never delete), admin `GET/POST/DELETE /:id/members`
  (assign / list / end). Assignment is admin-only (no self-service); a hunter may
  belong to several deelgebieden but not twice to the same one (409).
- Verified locally: 15/15 (seed, unassigned=empty, admin-only, multi-membership,
  duplicate 409, member list, leave-preserves-history, create/archive/hide).
- **Deferred to a later pass (were listed under Phase 4 in the plan):** "groups belong
  to a deelgebied", and retiring the `teams.area` enum / repurposing teams→groups.
  Not needed for Phase 5 (channels are per-deelgebied, driven by memberships) and the
  teams retirement is a risky tear-out (existing chat uses team channels) — do it
  deliberately when Phase 5/6 touch chat.

### Phase 5 — chat channels tied to deelgebieden (done 2026-08-31)

- Migration `20260831000000_add_deelgebied_chat_channels.js`: adds
  `chat_channels.deelgebied_id`, creates one `type='deelgebied'` channel per
  deelgebied, and renames the global general channel to "Hunters algemeen".
- `chat.ts`: `GET /channels` now returns the general channel + the caller's
  deelgebied channels (admins see all); an unassigned hunter sees only general
  (valid). Read/send access is derived server-side via `canAccessChannel()` from
  `user_deelgebied_memberships` and **re-checked at send time** — a reassigned
  hunter can't post to a channel they've left. Messages/reactions emit to the
  channel's room via `channelRoom()`.
- `socketAuth.ts`: on connect, joins `tenant-{t}-deelgebied-{id}` rooms from
  membership (admins join every active deelgebied room).
- Web `ModernChat` renders deelgebied channels by name (no UI change needed beyond
  the type union). Mobile still uses the broken team endpoint — Phase 6.
- Verified locally: 10/10 (channels created; unassigned=general only; assigned sees
  own not others; post to non-member channel 403; socket delivery to deelgebied room).
- Note: **map** filtering by deelgebied is Phase 8, not here (this phase is chat).

## Known issues / tech debt

- **Prod `.env` runs dev values** (`ENABLE_AUTO_SYNC=false`, `NODE_ENV=development`) —
  must flip to prod values before an event (auto-sync MUST be on). CORS uses
  `origin:true` so `FRONTEND_URL` doesn't matter.
- **Mobile chat is broken** (calls a non-existent `/chat/team/:id/messages`) and hunt
  cooldowns are unwired — Phase 6 / MOBILE_TODO.md.
- Several game-state socket broadcasts are still global `io.emit` (fox status/location) —
  fine single-tenant; scope when multi-deelgebied lands.
- Pre-existing dead-room emits (hunt-reviewed `team-${id}`, user-notifications
  `user-${id}`) never reach clients — revisit in the hunt/admin phases.
- Fox predictor trust/decay weights need a real-data calibration pass; play boundary is
  a placeholder; OSRM not built (straight-line reachability) — FOX_PREDICTION_PLAN.md.
- Frontend has ~90 non-blocking TS errors (vite/esbuild strips types); the `User` type
  is missing the flat `role` the API returns — a one-line type gap, not a runtime bug.
