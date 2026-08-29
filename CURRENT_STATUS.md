# Jotihunt V3 — Status & Build Tracker

> Living document. Update this whenever a phase moves. Last updated: **2026-08-30**.
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
| 3 | Approval enforcement in token middleware + socket connect; suspension force-disconnect | ⬜ next |
| 4 | Deelgebieden table + user↔deelgebied memberships (joined_at/left_at); retire teams.area enum | ⬜ |
| 5 | Membership-derived channel/map access; send-time re-check | ⬜ |
| 6 | Mobile chat (channels API) + hunt-cooldown UI (see MOBILE_TODO.md) | ⬜ |
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
- **Not yet:** mid-session enforcement (a user approved→suspended while logged in is
  only blocked at next login until Phase 3 adds token-middleware + socket checks).

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
