# Jotihunt V3 — Status & Build Tracker

> Living document. Update this whenever a phase moves. Last updated: **2026-09-09** (global cooldown, APK v15).
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
| 7 | Admin panel (approvals + deelgebied assignment in User Management); role-gated routes; simplified signup | ✅ done & deployed |
| 7b | Full team→deelgebied replacement in hunt cooldown + area points | ✅ done & deployed |
| 7c | Hunt cooldown is now **GLOBAL per fox** — any approved hunt starts a 60-min cooldown everyone sees/obeys (own-area bonus points still deelgebied-based) | ✅ done & deployed (APK v15) |
| 6 | Mobile chat (deelgebied channels) + hunt-cooldown UI | ✅ code done — needs APK rebuild |
| 8 | Map filtering by deelgebied | ❌ scrapped (not needed, user 2026-09-08) |
| 9 | Navigation to a fox → opens Google Maps directions | ✅ web + mobile (APK v13); VERIFY Jotihunt nav-aid rules before event |

## Oct-2026 feature backlog (Nikai + Chris notes, scope clarified 2026-10-09)

Build + deploy in batches, **bugs first**. Full detail in memory `feature-backlog-oct2026`.

| Epic | Scope | Status |
|---|---|---|
| A1 | Mobile GPS stops updating at speed → High accuracy (GPS) + send newest batched fix | ✅ code done, APK **v16** built — needs moving-device test |
| A2 | Fox trail line fix: confirmed positions only (approved hunts), robust time-window | ✅ code done — deploying |
| A3 | "API updates draaien" — verify prod auto-sync (`ENABLE_AUTO_SYNC`) | ✅ confirmed `ENABLE_AUTO_SYNC=true` in prod `.env` (seen 2026-10-09) |
| F | 4 new chat channels: Creatief, Foto's, Puzzels, Aankondiging (Aankondiging = admin-post-only). Notifications only fire for deelgebied + Aankondiging (general & open topics stay silent to avoid spam) | ✅ done (backend+web+mobile v17) |
| B | Fox-team active/onderweg/inactief + popup on status change | ✅ DONE — backend (areas.api_status), web (3-state overlay + toast + admin test buttons), mobile (map marker ring + popup label + live update, v20), FCM push on change. Beamer shows it too. |
| C | Hunt photo download button (admin hunt-review) | ✅ done — deploying |
| D | Chat popup/toast on new message | ✅ DONE & LIVE. Web in-app ToastHost; mobile REAL PUSH via FCM (firebase-admin, Firebase project jotihunt-a7229, APK v18) — screen-off push confirmed 2026-10-09. Fires only for deelgebied + Announcement. |
| E | Admin-authored updates + popup | ⬜ planned |
| H | Beamer/projector full-screen big map — `/beamer` route (no navbar), reuses live Map + 3-state fox-status overlay; admin link opens it in a new tab; hunter-only controls hidden via `beamer` prop | ✅ done (bigger markers = optional future polish) |
| J | User registration on MOBILE — LoginScreen now has a login/registreer toggle; signup takes voornaam+achternaam+wachtwoord, posts /auth/register (derived login, pending approval). Ships in APK v19 | ✅ done (v19) |
| I | **Live planning board — NEXT UP (resume 2026-10-11)** — see detailed spec + open questions below | ⬜ planned |

### Epic I — Live planning board (detailed spec — NEXT UP, resume 2026-10-11)

The next build. Epic G ("send hunters back") is folded in here. All other epics
(A–H, J) are done & deployed; Epic E (admin-authored updates + popup) is the only
*other* still-open item and is lower priority.

**What the user wants (2026-10-09):**
- A board with **columns = activities: Creatief, Hunt, Foto's, Puzzels.**
- Shows all **active users** as cards; the admin can also **manually add names**
  (ad-hoc entries, not necessarily linked to an account).
- **Drag** people between columns to log who is doing what.
- In the **Hunt** column, each person shows **time-on-the-road**:
  - Admin presses a **leave ("vertrokken")** button when they leave → starts that
    person's timer.
  - When the timer passes a **threshold**, the **admin** gets a notification that
    their time is up.
  - Admin can then press a button to send the hunter a **notification WITH SOUND**
    to return — reuse the FCM push already built (mobile `alerts` channel = MAX
    importance + sound; `sendPushToUsers([userId], { channelId: 'alerts', ... })`).
  - A **return ("terug")** button can be pressed at any time (before/after the
    threshold) — stops/clears that timer.
  - Admin can **stop** the timer at any time.
  - Timer is **admin-button-driven, NOT GPS-based.**

**Open design questions to ask before building:**
1. Audience — web admin-only (likely, HQ tool) or visible to all?
2. Persistence/sync — must board state + running timers persist across reloads and
   sync live across devices/HQ screens? (Almost certainly yes → backend table +
   socket broadcast, not just client state.)
3. Timer threshold — fixed default (e.g. 3h) or per-person/configurable?
4. Admin overrun alert — in-app only, or also push to the admin's phone?
5. Manually-added names — label only, or also timer-eligible (no account = no push)?
6. Should the board also show on the beamer view?

**Likely build shape:** backend `planning_entries` table (user ref or free name,
column, timer_started_at, threshold, left_at/returned_at) + CRUD + socket events;
threshold-overrun check (server cron/interval or client poll) → notify admin;
"send back" action → `sendPushToUsers([hunterUserId], { channelId: 'alerts', … })`.
Web: drag-and-drop board (dnd-kit or HTML5 DnD) in the admin area. Mobile: not
needed for v1 — admins drive it from the web; hunters only receive the return push.

### Phase 9 — navigation to a fox (2026-09-09: now hands off to Google Maps)

**Current behavior:** the "🧭 Navigate here" button in a fox popup opens **Google Maps**
directions (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`;
origin = the device/browser location). Web: `window.open` new tab. Mobile: `Linking.openURL`
via a WebView→RN postMessage. This replaced the earlier in-app OSRM polyline (removed
services/routing.ts on both, plus the mobile WebView-reload bug that came with it). No
OSRM dependency anymore; verify Jotihunt nav-aid rules before an event still applies.

--- earlier in-app-routing notes (historical) ---

### Phase 9 — in-app navigation to a fox (web done 2026-08-31)

- `services/routing.ts`: `getDrivingRoute(from,to)` hits an OSRM-compatible API
  (default: OSRM public demo; override with `VITE_OSRM_URL`). Returns Leaflet
  coords + distance/duration; returns null on failure (no throw).
- `Map.tsx`: each fox popup has a **🧭 Navigate here** button (disabled until the
  browser has the user's GPS). It routes from `userPosition` → the fox, draws a blue
  polyline, and shows a distance/ETA panel with a clear (✕).
- **Before an event:** (1) VERIFY Jotihunt's rules permit navigation aids; (2) point
  `VITE_OSRM_URL` at a self-hosted OSRM (NL extract) or a keyed provider — the public
  demo is rate-limited/not for production.
- **Mobile port (done 2026-09-08):** `mobile/services/routing.ts` + `MapScreen.tsx` —
  fox popups get a green **🧭 Navigate here** button that postMessages RN; RN fetches
  the route and injects `drawNavRoute()` into the WebView (blue polyline, fitBounds) and
  shows a distance/ETA banner with a clear (✕). Ships in **APK v11** (needs rebuild).
- **Still not done:** turn-by-turn (v1 is route + distance/ETA only); point the OSRM URL
  at a reliable endpoint before an event (web: VITE_OSRM_URL; mobile: OSRM_URL const in
  services/routing.ts).

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

### Fox dot on hunt approval + cooldown auto-refresh (2026-09-09)

- **Fox location on approval:** approving a hunt now moves the fox's `areas.lat/lng`
  to the hunt coords, sets `last_seen`, emits `fox-location-update` (web + mobile maps
  move the dot live), and re-triggers the predictor. The old submit-time update was
  removed — a pending/unverified hunt no longer moves the official fox marker. Mobile
  MapScreen now listens for `fox-location-update` (previously only a dead `area-update`).
- **Cooldown timer visibility:** the hunt screen's 30s tick now also re-fetches
  `/hunts/cooldowns` (web + mobile), so a cooldown that starts when an admin *approves*
  a hunt appears within 30s without reloading. (Backend cooldown was already correct;
  it's deelgebied-scoped, so an unassigned hunter still gets none — that's by design.)
- Ships in APK **v14**.

### Admin: delete accounts (2026-09-08)

- User Management: the per-row **Deactivate** button is replaced by **Delete** (admins
  are hidden from it). Deactivation is still possible via the Edit modal's status field.
- `DELETE /api/users/:id`: no longer requires deactivating first — deletes active users
  directly, in a transaction that also clears `user_deelgebied_memberships` + `user_roles`.
  Guards: can't delete yourself (400); can't delete a super admin (400, via user_roles).
  Verified end-to-end.
- Frontend `User` type gained the flat `role`/`status`/`scouting_group`/`deelgebieden`
  fields the API returns (closes the long-standing type gap).

### Phase 7 — admin panel + role-gating + simplified signup (done 2026-08-31)

- **Simplified signup:** `POST /auth/register` now needs only first name, last name,
  password. Username + email are derived server-side (`first.last@jotihunt-gog.nl`,
  with a numeric suffix on collision). No scouting group / manual email/username.
  Web signup form updated to match; `login.signupNote` explains the derived login.
- **Role-gated routes:** new `AdminRoute` guard in App.tsx redirects non-admins away
  from `/admin` and `/admin/routes` (the Navbar already hid the links). A hunter's UI
  is exactly Map, Chat, Hunt, Routes, Updates, Rules (+ profile/location settings).
- **Admin Approvals tab** (`AdminApprovals.tsx`): pending queue (newest first) with a
  deelgebied dropdown → Approve (+ assign in one action) / Reject, and a **deelgebied
  roster** (per-deelgebied member list with add-hunter / remove, live counts). Reads
  `GET /users` (now returns `status`) + the `/deelgebieden` endpoints.
- Verified: 8/8 signup integration checks; backend tsc clean; frontend builds.
- **Reworked 2026-08-31 per user feedback:** team == deelgebied. The separate
  Approvals tab + deelgebieden roster were removed. In **User Management**: the table's
  Deelgebieden column shows each user's memberships (read-only chips) + approval status,
  with inline Approve/Reject for pending rows. **Assignment happens in the existing
  Edit modal** — its old "Team/Area" single-select is now a **deelgebied multi-select
  (checkboxes)**; Save syncs `user_deelgebied_memberships` (add checked / remove
  unchecked). `GET /users` returns each user's active `deelgebieden`. Assigning →
  the user gets that deelgebied's chat channel (Phase 5). Multiple deelgebieden per user.
### Phase 7b — hunt logic full replacement (done 2026-08-31)

- `hunts.ts`: **cooldown + area points now key off deelgebied**, not the old team.
  - Own-area bonus (6 pts vs 3) if the hunted fox is one of the hunter's deelgebieden.
  - Cooldown: locked out of fox X if any hunter sharing one of your **current
    deelgebieden** has an approved hunt for X within 60 min ("your deelgebied already
    hunted this fox"). Computed via `hunts.hunter_user_id` → memberships, anchored on
    `approved_at`. Unassigned hunters aren't gated. `/hunts/cooldowns` re-keyed the same
    way (same response shape, so the web HuntRegistration UI works unchanged).
  - `hunts.hunter_team_id` is still written (legacy views) but no longer drives logic.
- Also fixed a latent bug: `PUT /users/:id` selected the dropped `users.role` column
  → 500 on every admin user edit; now selects real columns (b21a8b1).
- Legacy team dropdown removed from the Add User modal (assign deelgebieden via Edit).
- Verified: 8/8 hunt-logic checks (own vs other area points; deelgebied cooldown locks
  same-deelgebied hunters, spares others).

### Phase 6 — mobile chat + hunt cooldowns (code done 2026-08-31; needs APK rebuild)

- **Mobile chat rewritten to the deelgebied channels API.** Was calling a
  non-existent `/chat/team/:id/messages` (404, never worked). Now uses
  `getChatChannels / getChannelMessages / sendChannelMessage`, a channel switcher
  (general + the hunter's deelgebieden), listens for the `new-message` socket event
  filtered by channel, optimistic send. Removed the "No Team" gate. Server assigns
  rooms from membership. (Attachment send dropped for now — text only on mobile.)
- **Hunt cooldowns wired into HuntScreen**: loads `/hunts/cooldowns`, shows `🔒 N min`
  per fox in the picker + a warning, disables Submit while the selected fox cools down,
  30s countdown tick, handles the 429. Dropped the old `fox_team_name` picker suffix.
- `FoxRoutePoint.id` widened to `string | number`; added `ChatChannel` type. Mobile has
  no signup screen (hunters sign up on web).
- **Deploy note:** the EC2 pipeline builds only backend + web. Mobile reaches phones
  only via an **EAS APK rebuild** (`cd mobile && npm run build:apk`) + reinstall.

## Known issues / tech debt

- **Prod `.env` runs dev values** (`ENABLE_AUTO_SYNC=false`, `NODE_ENV=development`) —
  must flip to prod values before an event (auto-sync MUST be on). CORS uses
  `origin:true` so `FRONTEND_URL` doesn't matter.
- ~~Mobile chat broken / hunt cooldowns unwired~~ — **fixed** (Phase 6 shipped; cooldown
  is now global per fox, 7c).
- Several game-state socket broadcasts are still global `io.emit` (fox status/location) —
  fine single-tenant; scope when multi-deelgebied lands.
- Pre-existing dead-room emits (hunt-reviewed `team-${id}`, user-notifications
  `user-${id}`) never reach clients — revisit in the hunt/admin phases.
- Fox predictor trust/decay weights need a real-data calibration pass; play boundary is
  a placeholder; OSRM not built (straight-line reachability) — FOX_PREDICTION_PLAN.md.
- Frontend has ~90 non-blocking TS errors (vite/esbuild strips types); the `User` type
  is missing the flat `role` the API returns — a one-line type gap, not a runtime bug.
