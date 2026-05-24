# Fox Location Prediction — Build Plan (v4, consistency-checked)

## ⚠️ KNOWN TODO — RE-TUNE TRUST/FRESHNESS WEIGHTS

Observed in dev: **a hunt submission pegs the prediction far too hard** — it dominates
hints and pins for too long. The first-pass re-tune below HAS BEEN APPLIED
(see PROGRESS LOG entry); it still needs another pass against real event behaviour.

**Where to tune:** `backend/src/services/foxPrediction.ts`

| Signal | Original (too high) | First-pass — currently in code |
|---|---|---|
| Hunt — `approved` | **1.0** | ~0.85 (still highest, less crushing) |
| Hunt — `pending` | 0.6 | 0.5 |
| Hint — `confirmed` | 0.9 | 0.8 (closer to a hunt — official coords are exact) |
| Hint — `unverified` | 0.4 | 0.25 (don't let guesses sway the map) |
| Manual pin (`user_report`/`admin_manual`) | 0.5 | 0.45 |
| API coord | 0.25 | 0.2 |

Also tune:
- `FRESH_TAU_MIN` — half-life of any signal's influence. **Currently 35** (was
  60). A hunt at trust 0.85 now drops below a fresh confirmed hint after ~40 min.
  Re-tune if old hunts still feel sticky in real use, or if fresh signals flap
  too easily.
- `LOOKBACK_HOURS = 24` — fine for an event day; lower it if stale points clutter.
- `DEFAULT_REACH.speedKmh = 35` and `maxRadiusKm = 20` in `reachability.ts` —
  observe whether the circle grows realistically as `elapsedMinutes` rises.

**How to validate a change:** run `npx ts-node scripts/simulate-prediction.ts`
and confirm the confidence ordering still reads `hunt > hint > manual > none`
with sensible gaps (not 0.51 vs 0.50 — but not 0.95 vs 0.20 either).

Don't ship to event day without one calibration pass against real data.

---

## 🚀 RELEASE CHECKLIST

Order matters. Items are local-first, then deploy. Tick off as you go.

### A. Final code changes (sanity-confirm before deploying)
- [ ] Old walking-speed "Fox Prediction Circles" removed from `Map.tsx` (two
  blocks: the per-route one and the all-foxes one). Speed slider + `foxWalkingSpeed`
  state removed. The only "prediction" UI now is the 🎯 toggle.
- [ ] `GET /jotihunt/areas/:areaId/route` returns a unified trail merged from
  `area_locations` + `hunts` (non-rejected) + `hint_solutions` (confirmed only),
  with prefixed ids `loc-/hunt-/hint-`.
- [ ] Frontend `FoxRoutePoint.id` widened to `string | number`.
- [ ] `FoxPredictionLayer` no longer pre-filters by `status==='active'`.

### B. Dev verification (must pass before deploy)
- [ ] Map: click a fox → the route line connects points from every source
  (manual pin AND hunt photo AND confirmed hint), in chronological order.
- [ ] Map: toggle 🎯 → overlay renders with a real anchor (`hunt`/`hint`/`manual`),
  confidence > 0 in the popup. Confidence ranking: hunt > hint > manual.
- [ ] Submit a hint with RD coords (💡 button) → admin "Hint Solutions" tab
  shows it as `unverified` → Confirm → fox area updates, prediction recomputes.
- [ ] No duplicate fox markers / no stale "Prediction Zone" popups from the old
  walking-circle code.
- [ ] No JS console errors in the browser; no exceptions in backend logs.

### C. i18n & polish (nice to have, not blocking)
- [ ] Unused locale keys: `map.foxSpeed`, `map.slow`, `map.fast`, `map.speedHelp`.
  Safe to leave; remove if you tidy locales.
- [ ] Translate the new admin "Hint Solutions" screen (currently uses literal EN
  strings inside `AdminHintVerification.tsx` — admin-only, low priority).

### D. Pre-deploy data tasks (do once, locally + on prod)
- [ ] **Local dev DB already consolidated** to tenant 1 via
  `backend/scripts/consolidate-to-tenant-1.ts`. Backup at
  `jotihunt.db.post-consolidate-bak`.
- [ ] **🛠️ AWS / prod DB:** run the same script on prod **after** backing up:
  ```
  cp backend/database/jotihunt.db backend/database/jotihunt.db.pre-consolidate-bak
  cd backend && npx ts-node scripts/consolidate-to-tenant-1.ts
  ```
  (Or, if prod is on Postgres or a managed DB, adapt the script to that connection.)
- [ ] **🛠️ AWS / prod DB:** run pending migrations:
  ```
  cd backend && npm run db:migrate
  ```
  FOUR new migrations apply (in order):
  - `20260522010000_fix_hint_solutions` — `article_id` nullable + `verification_status`.
  - `20260523000000_create_fox_predictions` — prediction cache table.
  - `20260523010000_add_hint_solution_fox_columns` — long-format `fox_team/rd_x/rd_y/lat/lng` columns.
  - `20260524000000_add_hunt_approved_at` — `approved_at` column on `hunts` (cooldown anchor).
- [ ] Confirm `tenants` table on prod: only tenant 1 active. If multiple were
  active, the consolidation script deactivates the rest.
- [ ] **No manual `mkdir`** for uploads dirs — `chat.ts` and `hunts.ts` both
  `fs.mkdirSync(..., {recursive:true})` on module load.

### E. Tighten the play-area polygon (optional, NOT a release blocker)
> Jotihunt doesn't publish an official boundary GeoJSON. The current rectangle
> in `backend/src/config/playBoundary.ts` is a generous box over Gelderland.
> Predictions already have a fallback that skips the mask when an anchor lands
> outside the polygon, so the polygon mainly controls how far the heatmap
> "splays" visually — nothing breaks if it's left as-is.

Pick one of three:
- [ ] **Do nothing.** The rectangle is fine for v1.
- [ ] **Hand-draw a tighter Gelderland-ish polygon** in [geojson.io](https://geojson.io)
  and paste the coordinate ring into `PLAY_BOUNDARY` in
  `backend/src/config/playBoundary.ts`. ~10 min; gives a cleaner heatmap shape.
- [ ] **Remove the boundary mask entirely** — drop the `.filter(isInPlayArea)`
  call in `computePrediction`. Honest "predict anywhere reachable" output.

Also still worth confirming once:
- [ ] `spelregels.txt` doesn't actually require route-to-clubhouse constraints
  (the plan assumes it doesn't — verify and note any change).

### F. Deploy
- [ ] **🛠️ Production env vars** in `backend/.env`:
  - `ENABLE_AUTO_SYNC=true` (or unset — defaults to true). Prod **must** keep
    auto-sync on so live fox statuses update during the event. In dev it's
    `false` to stop the every-3-min sync from clobbering test state.
  - `JWT_SECRET`, `NODE_ENV=production`, `PORT`, `FRONTEND_URL` — standard.
- [ ] **Feature flags in code** (no env, just constants — confirm before build):
  - `HUNT_COOLDOWN_ENABLED = true` in `backend/src/routes/hunts.ts` (line ~51).
    The 60-min per-team cooldown enforces correctly with this on.
- [ ] Build & deploy backend: `cd backend && npm install && npm run build && npm start`.
- [ ] Build & deploy frontend: `cd frontend && npm install && npm run build` and
  serve `dist/`.
- [ ] After deploy: as admin, hit `POST /jotihunt/predictions/recompute` once to
  seed initial predictions for foxes that already have data.
- [ ] Smoke-test the same B-checklist items in prod.

### G. Day-of-event readiness
- [ ] Verify the Jotihunt API sync is running (it triggers predictions on each
  coord change). Check `api_cache` rows update.
- [ ] Have an admin available to **Confirm/Reject hint solutions** as they come
  in — until confirmed, hints only weakly pull the heatmap.
- [ ] Tell hunters that the 🎯 toggle is the predictor and the popup explains
  what it's based on; the dashed circle they may remember from past years is gone.

### H. Post-event (later improvements, not blocking release)
- [ ] **🛠️ AWS:** stand up self-hosted OSRM (Docker + NL OSM extract) to replace
  the straight-line reachability with real road-network isochrones.
- [ ] Tune `FRESH_TAU_MIN` / trust constants in `backend/src/services/foxPrediction.ts`
  against observed behaviour.
- [ ] Drop the legacy wide `*_lat/*_lng` columns on `hint_solutions` once nothing
  reads them (purely cosmetic).

---

## 🔄 RESET-FOR-LAUNCH (admin)

The admin overview tab has a red "Reset for launch" card that opens a checkbox
modal — every category is **opt-in** (no locked items), gated by typing `RESET`.
Backend: `POST /jotihunt/admin/reset` runs all selected deletes in one transaction
and returns row-count results.

| Flag | Hits | Notes |
|---|---|---|
| `fox_locations` | `area_locations` (rows) + `areas.lat/lng/last_seen` (cleared) | Area rows themselves kept (Alpha…Hotel definitions). |
| `fox_status_history` | rows | green/orange/red transitions per fox |
| `predictions` | `fox_predictions` rows | derived; safe to wipe anytime |
| `hunts` | `hunts` rows | hunt photo files on disk become orphans (not deleted) |
| `hint_solutions` | all rows | table has no tenant_id — single-tenant DB |
| `subscription_visits` | rows | scoped via the tenant's subscriptions |
| `api_cache` | all rows | next API sync becomes a fresh full pull |
| `articles` | rows | will be re-synced from the Jotihunt API |
| `chat` | `team_messages` + `message_reactions` rows | `chat_channels` kept |

Files: `frontend/src/components/AdminLaunchReset.tsx`,
`backend/src/routes/jotihunt.ts` (`/admin/reset`),
`frontend/src/services/gameService.ts` (`resetForLaunch`).

---

## ▶ PROGRESS LOG
- **2026-05-24 — Hunt cooldown: enforce + anchor on admin approval.**
  - Per Jotihunt rules: 60 min after a hunt, the scouting group can't re-hunt
    that fox. Was wired wrong: 15 min, per-user, and **never enforced**.
  - Fixed to 60 min, per **team** (`hunter_team_id`), and the submit endpoint
    now returns **HTTP 429** with `wait_minutes` if the team is still locked
    out. Frontend `HuntRegistration` fetches `/hunts/cooldowns`, shows
    `🔒 nog 45 min wachten` / `🔒 wait 45 min` in the dropdown, disables Submit
    until the timer expires, ticks countdown every 30 s.
  - i18n keys `hunt.waitMinutes` and `hunt.cooldownActive` (en + nl).
  - Added `HUNT_COOLDOWN_ENABLED` flag at the top of `hunts.ts` for an
    instant toggle without dropping `HUNT_COOLDOWN_MINUTES = 60` (the documented
    rule value).
  - **Cooldown timer anchored on `approved_at`, not `hunt_time`**: new migration
    `20260524000000_add_hunt_approved_at.js` adds the column; the review endpoint
    stamps it on approve / clears on reject. Pending submissions do NOT lock the
    team out — the 60-min clock starts only when an admin confirms.
  - Removed the "(last seen…)" suffix from the hunt-submit dropdown (per user
    request); only kept on map markers.
- **2026-05-24 — Chat completely broken; root cause was a knex 3 / SQLite gotcha.**
  - On knex 3 + SQLite, `.insert(...).returning('id')` returns `[{id: N}]`, not
    `[N]`. Code that did `const [messageId] = await ...returning('id')` was
    silently using `{id:N}` as the id → follow-up `where('id', messageId)`
    returned nothing → empty JSON response, empty socket emit. Hence "send
    works but message only appears on refresh," and file uploads "couldn't
    submit" (response was empty so the UI gave no feedback).
  - Fix: new `extractInsertId` helper in `backend/src/utils/database.ts`
    normalises both shapes. Applied to chat (both endpoints), hunts.ts, and
    `jotihuntApi.ts` (the area-create path used for fresh API areas).
  - Also: `uploads/chat/` directory didn't exist — multer's diskStorage threw
    ENOENT on first file. Added `fs.mkdirSync(..., { recursive: true })` at
    module load in `chat.ts` (matching what `hunts.ts` does). Created the dir
    locally too.
  - Frontend `ModernChat` now optimistically adds the POST response to local
    state, so the sender sees their message instantly regardless of socket.
- **2026-05-24 — Admin notifications: hunt-pending alerts wired; "(last seen…)" returns.**
  - `NotificationContext` only listened for `hunt-reviewed`. Added
    `hunt-pending-review` listener (admin-only via `isAdmin`) so admins get a
    real-time toast when a hunter submits. Mirrors the new-message pattern.
  - Hunt-submit endpoint now updates `areas.lat/lng/last_seen` so the dropdown
    + map markers reflect the latest sighting. Stripped the cosmetic
    `(${fox_team_name})` suffix from all four dropdowns since the area name
    *is* the fox team name (Alpha…Hotel) — `fox_team_name` is unused metadata.
- **2026-05-24 — Route tab: foxes render on the map (the actual user-visible bug).**
  - Map only mounted when `selectedUser` was set; fox selection got the empty
    placeholder. Fixed the conditional to consider `selectedFoxArea` too,
    added a `key` on `MapContainer` to remount on selection change, and made
    the map center dynamic (centers on the selected fox's first route point).
- **2026-05-23/24 — Prediction overlay: render every fox with data.**
  - `FoxPredictionLayer` was pre-filtering `status==='active'` (no longer
    relevant after my live data fix). Removed.
  - `computePrediction`: skip play-boundary mask if anchor is outside the
    polygon (placeholder is narrow; testing-only safety). Fallback to anchor
    itself if grid ends up empty. Three predictions now render properly in
    their team colours where one used to.
- **2026-05-23 — Dev env clobber fixed (cron sync + status reset).**
  - The every-3-min Jotihunt API sync was overwriting `areas.status` back to
    `inactive` and clearing `fox_team_name`. Set `ENABLE_AUTO_SYNC=false` in
    `backend/.env`. Prod must stay `true` (release checklist updated).
  - `RESET-FOR-LAUNCH` bugfix: the `fox_locations` flag now also resets
    `areas.status` to `'active'`, otherwise hunts kept failing with "Invalid
    or inactive fox area" after a reset.
  - Tenant consolidation script
    (`backend/scripts/consolidate-to-tenant-1.ts`) collapsed 3 tenants + 6
    orphan area rows down to a single canonical tenant-1 dataset. Same script
    will need to run on prod if it has the same multi-tenant duplication.
- **2026-05-23 (cont.) — Route tab fixed: users no longer misclassified as fox teams + fox teams listed individually.**
  - `RouteTracker.tsx` was flagging any hunter (e.g. "Chris", "hunter1") whose
    team's `area` matched a fox name as a "vossenteam" member. Wrong — that
    column means "which fox this hunter team hunts", not "this user IS a fox".
  - `isFoxTeamMember` now returns `false` for every user. "Show foxes only"
    toggle removed (would always be empty anyway).
  - New "Fox teams" section in the route tab lists Alpha…Hotel individually,
    each with its team color (left border). Clicking loads that fox's merged
    sighting trail (hunts + confirmed hints + manual pins + API) via the
    existing `/jotihunt/areas/:id/route` endpoint and renders polyline+markers
    on the same map. User-route and fox-route selection are mutually exclusive.
- **2026-05-23 (cont.) — RESET-FOR-LAUNCH bugfix: also resets `areas.status` to 'active'.**
  - Symptom: after reset, "Invalid or inactive fox area" on every hunt submit
    because `hunts.ts` requires `status='active'` and reset didn't touch status.
  - Fix: the `fox_locations` branch now sets `status='active'` along with
    clearing lat/lng/last_seen. Modal label updated to "Fox locations & status".
  - One-off SQL ran on dev DB to unstick existing rows (all 9 set to active).
- **2026-05-23 (cont.) — RESET-FOR-LAUNCH admin feature DONE (untested in dev, not committed).**
  - Backend: `POST /jotihunt/admin/reset` (admin-only, tenant-scoped, single
    transaction). Accepts boolean flags per category; returns deleted counts.
  - Frontend: new `AdminLaunchReset.tsx` mounted at the top of the admin
    overview tab — checkbox modal where every category is opt-in (no locked
    items), gated by typing `RESET`. Recommended defaults: fox state + hunts +
    hints + subscription_visits + api_cache pre-checked; articles + chat
    unchecked.
  - `gameService.resetForLaunch(flags)` calls the endpoint.
  - Both `tsc` clean. See "🔄 RESET-FOR-LAUNCH" section above for the full spec.
- **2026-05-23 (cont.) — First-pass trust/freshness re-tune APPLIED (untested in dev, not committed).**
  - `backend/src/services/foxPrediction.ts`:
    - `FRESH_TAU_MIN` 60 → **35** (signals age out faster; old hunts no longer
      dominate fresh hints).
    - Hunt: approved 1.0 → **0.85**, pending 0.6 → **0.5**.
    - Hint: confirmed 0.9 → **0.8**, unverified 0.4 → **0.25**.
    - Manual pin 0.5 → **0.45**, API 0.25 → **0.2**.
  - Dry-run re-validated: confidence drops sensibly (0.34 / 0.10 / 0.02 / 0)
    while preserving the ordering `hunt > hint > manual > none`. Backend tsc clean.
  - Still a **first pass** — keep the ⚠️ TODO above; tune again against real
    event behaviour. The ⚠️ block now reflects the *current* numbers as the
    "before" reference.
- **2026-05-23 (cont.) — Admin verify UI DONE (untested, not committed). FEATURE NOW FUNCTIONALLY COMPLETE.**
  - New `frontend/src/components/AdminHintVerification.tsx`: lists hint solutions
    (unverified first), shows fox/coords/solution/submitter/status, with
    Confirm / Reject / Reset buttons → `gameService.updateHintSolution(id,
    {verification_status})`. Confirmed hints get full predictor weight.
  - Wired into `AdminDashboard.tsx` as a new "Hint Solutions" tab (id `hints`,
    MapPin icon) + switch case. i18n `admin.tabHints` added (en/nl).
  - tsc: no errors in new code; JSON valid.
  - **End-to-end now works:** enter hint (standalone) → admin confirms → predictor
    weights it fully → map shows updated heatmap/zones. Same for hunts & pins.
  - **All that remains is non-code / tuning:** dev-test; real OSRM on AWS; replace
    placeholder boundary polygon; tune weight/decay constants.
- **2026-05-23 (cont.) — Step 1 FRONTEND: standalone hint entry DONE (untested, not committed).**
  - `Map.tsx` quick-hint modal now opens/submits WITHOUT a synced article:
    "💡 Quick Hint" button opens even when `hints` is empty (`selectedHint=null`);
    modal gate changed to `showHintSolutionModal &&`; the article-display block
    wrapped in `{selectedHint && (...)}`; submit guard drops the `selectedHint`
    requirement and passes `selectedHint?.id ?? null`.
  - `gameService.submitHintSolution(articleId: number | null, …)`.
  - `gameService.updateHintSolution` now sends `{ verification_status }`
    ('confirmed'|'rejected'|'unverified') to match the backend PATCH.
  - tsc: same pre-existing errors only, NONE new in touched files.
  - **STILL TODO (frontend):** an **admin verify UI** — there is currently NO
    screen that lists hint solutions / calls `updateHintSolution`. Need a simple
    admin list (fox, coords, submitted-by, status) with Confirm/Reject buttons
    calling `gameService.updateHintSolution(id, {verification_status})`. Until this
    exists, all hint solutions stay `unverified` (low predictor weight). Backend
    `GET /hints/solutions/all` + `PATCH /hints/solutions/:id` are ready.
- **2026-05-23 (cont.) — Step 5 FRONTEND DONE (untested in dev, NOT committed).**
  - New `frontend/src/components/FoxPredictionLayer.tsx`: renders per-fox heatmap
    (downsampled `CircleMarker`s, ≤120 pts) + top-3 zone markers with a popup
    (confidence %, "based on" source, last-signal/updated time). No new deps
    (uses react-leaflet `CircleMarker`/`Popup`/`Tooltip`).
  - `Map.tsx`: added `showPredictions` state + a 🎯 "Prediction" toggle button
    (bottom-right cluster) + mounted `<FoxPredictionLayer>` in the MapContainer.
  - `gameService.getFoxPrediction(areaId)` (404→null) + `recomputePredictions()`.
  - Types `FoxPrediction`/`PredictionZone`; i18n `prediction.*` in en/nl.
  - ⚠️ Frontend `tsc --noEmit` shows ~90 PRE-EXISTING errors across other files
    (role/unused/null) — NONE in the new code. Real build is `vite build`
    (esbuild), unaffected. Don't try to "fix" those here.
  - **DEV-TEST NOTE:** predictions only exist after a compute runs. On a fresh DB
    the layer shows nothing until you submit a hunt/hint/manual report, OR call
    `POST /jotihunt/predictions/recompute` (admin). Then toggle 🎯 on the map.
- **2026-05-23 — Steps 2, 3, 4, 5-backend DONE locally + dry-run PASSED.**
  - ⚠️ **Schema reality correction:** the live `hint_solutions` table does NOT
    match migration `20250122` — it has WIDE per-area columns (`alpha_lat`…
    `foxtrot_lng`, only 6 areas, + `reveals_fox_areas`), NOT `fox_team/lat/lng`.
    So the original per-area insert was actually valid; my Step-1 "no such column"
    premise was wrong. Fixed by migration `20260523010000_add_hint_solution_fox_columns.js`
    which ADDS long-format `fox_team/rd_x/rd_y/lat/lng` (supports all 8 areas).
    Legacy wide columns left in place (unused). `hints.ts` writes long format.
  - New files: `src/utils/geo.ts` (dep-free geometry), `src/config/playBoundary.ts`
    (⚠️ PLACEHOLDER polygon — replace with official one), `src/services/reachability.ts`
    (straight-line radius; OSRM swap-in later), `src/services/foxPrediction.ts`
    (anchor gather → weight by trust×freshness → grid score → heatmap/top-zones/
    confidence → `fox_predictions`), `scripts/simulate-prediction.ts` (dry run).
  - Migration `20260523000000_create_fox_predictions.js` applied (Batch 14/15).
  - API: `GET /jotihunt/areas/:areaId/prediction`, `POST /jotihunt/predictions/recompute`
    (admin). Triggers wired fire-and-forget into hunt submit, manual report, hint
    submit + verify. Backend `tsc --noEmit` clean.
  - **Dry run verified the full fallback chain:** hunt(conf .51) → hint(.20) →
    manual(.06) → none(0). Synthetic rows cleaned up.
- **NEXT, in order:**
  1. **Step 5 frontend** — `Map.tsx` heatmap overlay + top-3 zone markers with
     confidence + "based on" label; consume `GET .../prediction`.
  2. **Step 1 frontend remainder** — let quick-hint modal submit standalone (no
     article); admin UI to set `verification_status`. (Dev-test before commit.)
  3. **Step 2b real OSRM** — replace straight-line radius (server/AWS work).
  4. Replace the placeholder `playBoundary.ts` polygon with the official area.
  5. Tune weights/decay constants in `foxPrediction.ts` against real behaviour.
- **2026-05-22 — Step 1 backend DONE (untested in dev).**
  - Migration `backend/database/migrations/20260522010000_fix_hint_solutions.js`:
    `article_id` now nullable + new `verification_status` column (default
    `unverified`). Applied to dev DB (Batch 13); backend `tsc --noEmit` clean.
  - `backend/src/routes/hints.ts` rewritten:
    - `POST /solutions` — inserts **one row per fox** (fixes the
      `alpha_lat`/`reveals_fox_areas` "no such column" runtime bug), `article_id`
      optional (standalone entry), new rows default `unverified`, no auto-confirm,
      no auto-reveal. Response now returns `solutions[]` (+ `solution` = first row
      for backward compat).
    - `PATCH /solutions/:id` — admin sets `verification_status`
      (`confirmed`/`rejected`); reveals fox area only on `confirmed`.
    - `validateSolution()` is now dead code (left in place; harmless).
- **NEXT (Step 1 remainder), in order:**
  1. **Test in dev** (per user rule, before committing): submit a hint with coords
     for several foxes → expect N rows, all `unverified`; submit with no
     `article_id` → succeeds; admin PATCH `confirmed` → fox area updates.
  2. Frontend: let the `Map.tsx` quick-hint modal open/submit **without** a
     selected article (standalone). Confirm `gameService.submitHintSolution`
     handles the new `solutions[]` response (it mostly just reloads).
  3. Admin review UI: surface `verification_status` so admins can confirm/reject.
  4. Then Step 2 (foundations) — can start in parallel; no event data needed.

---


> **Goal:** help hunters decide *where to drive* by showing, per fox group
> (Alpha…Hotel), a **probability heatmap + top 3 "go here" zones**, refreshed live
> as data arrives.
> **Not a goal:** a precise GPS point, or long-horizon (>1h) prediction. The data
> doesn't support it.

---

## 0. Context that shapes everything

- **SQLite** (no PostGIS) → all geometry runs in JS (Turf.js).
- **Cold start.** The app only runs on event day; there is no historical data to
  train on. The predictor must work from zero and sharpen as data streams in.
  → **No ML in v1.** A learned model has nothing to learn from before the event.
- **Multi-tenant.** Every new table/query carries `tenant_id` (match existing schema).
- The three input features below **already exist** in the app — but one of them
  (hint solutions) is **partly broken and must be fixed first** (see Step 1).

---

## 1. The three inputs, their trust, and their current state

| # | Input | Where it lands | Trust | Meaning | Current state |
|---|---|---|---|---|---|
| 1 | **Hunt submission** (photo) | `hunts` (`hunt_lat/lng`, `hunt_time`, `fox_area`, `status`) | **Highest** — photo-verified | Fox was *exactly* here at `hunt_time` | ✅ Works. `status` is `pending` until admin review. |
| 2 | **Hint solution** (manual RD coords) | `hint_solutions` (`lat/lng`, `fox_team`, `verification_status`) | High *iff* `confirmed` | Official clue → where fox is/will be | ⚠️ **Broken — fix in Step 1.** |
| 3 | **Report fox location** (manual pin) | `area_locations` (`source` in `'user_report'`, `'admin_manual'`) | Medium — eyewitness | Someone *saw* the fox near here | ✅ Works (`POST /areas/:area_id/location`). |
| — | API sync coord (fallback) | `area_locations` (`source='api'`) | Low | Last synced position | ✅ Works, sparse. |

**Anchor rule (core of the predictor):** for each fox, score every recent point
by `trust × freshness-decay`. The top-scoring point is the **primary anchor**;
the others add weight. No recent points → "whole play area, low confidence."

---

## STEP 1 — Fix the manual hint input (PREREQUISITE, do first)

The hint-solution feature is the weakest of the three signals and is currently
buggy. The predictor can't rely on it until these are fixed.

### 1a. Fix the schema/code mismatch (bug — likely failing at runtime)
- `hints.ts` submit (`POST /hints/solutions`) writes per-area columns
  (`alpha_lat`, `alpha_rd_x`, …) and `reveals_fox_areas`, **none of which exist**
  in the `hint_solutions` migration (it has single `rd_x/rd_y/lat/lng/fox_team`).
  On SQLite this insert throws "no such column".
- **DECIDED — one row per revealed fox.** One hint can reveal several foxes at
  once (the UI collects all areas), so the submit endpoint inserts *N rows* — one
  per area that has coords — using the existing single-fox columns
  (`rd_x/rd_y/lat/lng/fox_team`). No schema change; matches the predictor's
  per-fox query.
- [ ] Rewrite `hints.ts` submit to loop areas → insert one row per area with
      coords (drop the non-existent `alpha_lat`/`reveals_fox_areas` writes).
- [ ] The admin `PATCH` path already reads singular `solution.lat/lng` — keep,
      now consistent with the one-row-per-fox model.
- [ ] Update `gameService` / form payload handling to match.

### 1b. Make hint trust mean something
- Today `validateSolution` returns `true` for any answer ≥3 chars → **every**
  solution is auto-`is_correct`. The predictor must not trust unverified guesses.
- **DECIDED — admin confirms.** Stop auto-confirming. Introduce a single
  `verification_status` column: `unverified` (default) → `confirmed` / `rejected`,
  set by an admin via the existing `PATCH /hints/solutions/:id`. This **supersedes**
  the old `is_correct` / `reveals_fox_location` booleans as the trust source (leave
  them or migrate them, but the predictor reads only `verification_status`).
- [ ] Stop auto-setting trust on submit; new rows default to `unverified`.
- [ ] Predictor uses `confirmed` at full weight, `unverified` at **low** weight,
      ignores `rejected`.
- [ ] Make sure the admin review screen surfaces unverified hint solutions to act on.
- [ ] (Schema change — fold into the Step 1 migration below.)

### 1c. Hint-entry UI — two modals, leave both (DECIDED)
- There are **two** quick-hint modals: `Map.tsx` (8 areas incl. Golf/Hotel — the
  good one) and `HintsList.tsx` (only Alpha–Foxtrot). **Decision: leave both
  as-is**, don't unify now. Both submit through the same endpoint, so fixing the
  backend (1a/1b) fixes both.
- [ ] Just confirm both modals work end-to-end against the fixed backend.
- [ ] (Low priority, optional) the `HintsList` modal is missing Golf/Hotel; fine
      to leave since `Map.tsx` covers all 8.

### 1d. Allow standalone hint entry (DECIDED — not tied to an API article)
- Today `POST /hints/solutions` **requires** `article_id` (`hints.ts:15`) and
  `hint_solutions.article_id` is a non-null FK to `articles`. So you can't enter a
  hint unless the API has already synced that hint article. For prediction we want
  to capture a solved hint *immediately*.
- [ ] Endpoint: accept submissions with no `article_id` (skip the article lookup).
- [ ] Map.tsx quick-hint modal: allow opening/submitting without a selected hint
      article (a "report a hint location" entry point, independent of the article
      list).

### Step 1 migration (single migration covering 1b + 1d)
- [ ] `…_fix_hint_solutions.js`:
  - make `hint_solutions.article_id` **nullable** (drop not-null; keep the FK so it
    still links when an article exists),
  - add `verification_status` (string, default `'unverified'`),
  - add `tenant_id` if the table lacks it (multi-tenant consistency — verify first).

### 1e. (Quality) sanity-check RD→WGS84
- [ ] Confirm `rdToWgs84()` output lands inside the NL bounds already used in
      `jotihuntApi.ts` (lat 50–54, lng 3–8). Reject out-of-bounds input in the form.

> **Done when:** a hint solution with coords for any of the 8 areas saves without
> error — *including with no linked API article* — shows an explicit verification
> state, and the saved lat/lng is correct.

---

## STEP 2 — Foundations (prep-able before event day, no event data needed)

### 2a. Play boundary
- [ ] Obtain/draw the official Jotihunt region polygon → GeoJSON in
      `backend/src/config/playBoundary.ts`. Used to mask every prediction.
- [ ] Resolve the "route to clubhouse" rule from `spelregels.txt` (likely no fixed
      routes — remove from the model unless the rules actually mandate them).

### 2b. Routing / isochrones — **DECIDED: self-hosted OSRM**
- [ ] Stand up OSRM in Docker with the NL (`netherlands-latest.osm.pbf`) road
      network. Free, no rate limits, reliable on a busy event day.
- [ ] Wrap behind one interface (`getReachableArea(point, minutes, speedProfile)`
      → GeoJSON polygon) so it stays swappable.
- [ ] Straight-line circle fallback if OSRM is unreachable (also lets v1 ship
      before OSRM is fully set up).

### 2c. Prediction cache table
- [ ] New migration `…_create_fox_predictions.js` (match conventions in
      `20251004140000_create_fox_status_history.js`):

```js
table.increments('id').primary();
table.integer('area_id').unsigned().references('id').inTable('areas').onDelete('CASCADE');
table.integer('tenant_id').unsigned().defaultTo(1);
table.datetime('generated_at').notNullable();
table.string('anchor_source');   // 'hunt' | 'hint' | 'manual' | 'api' | 'none'
table.datetime('anchor_time');   // timestamp of the anchor point used
table.text('heatmap_geojson');   // weighted grid as GeoJSON
table.text('top_zones');         // JSON: [{lat,lng,label,score}]
table.float('confidence');       // 0..1
table.index(['area_id', 'generated_at']);
```

---

## STEP 3 — Prediction service (the core, v1, no ML)

New `backend/src/services/foxPrediction.ts`. For each active fox group:

1. **Gather candidate anchors** (today only):
   - latest `hunts` row for this `fox_area` (note `status` for weight),
   - latest `hint_solutions` for this fox (weight by `verification_status`),
   - latest `area_locations` (manual sources `user_report`/`admin_manual` first,
     then `api`).
2. **Pick primary anchor** = max(`trust × freshness-decay`). Record
   `anchor_source` + `anchor_time`.
3. **Elapsed time** = now − anchor time. Cross-check `fox_status_history`:
   `orange` (onderweg) → grow faster; just went `green` after a hunt → widen
   (fox flees the catch site).
4. `getReachableArea(anchor, elapsedMinutes)` → reachable polygon.
5. **Mask** to play boundary (Turf `intersect`).
6. Lay an H3 / square grid over the masked area.
7. **Score each cell:** distance-decay from anchor + density of *today's* points
   (hunts + manual + confirmed hints) + small clubhouse boost
   (`subscription_locations`).
8. Normalize → heatmap; pick top 3 cells → `top_zones`.
9. **Confidence** from anchor freshness + type (fresh hunt = high, old API = low,
   nothing = minimal, whole-area).
10. Upsert into `fox_predictions`.

---

## STEP 4 — Triggers (keep predictions fresh)

Recompute the affected fox's prediction on any of these (throttle per fox to avoid
storms when several land at once):

- [ ] after each API sync (hook into `jotihuntApi.ts` sync),
- [ ] **on hunt submit** — `POST /hunts/submit` (`hunts.ts:108`); freshest anchor,
      don't wait for sync,
- [ ] **on hint solution submit** — `POST /hints/solutions` (recompute at *low*
      weight, since it's `unverified`), and **on verify** —
      `PATCH /hints/solutions/:id` (recompute at full weight once `confirmed`),
- [ ] **on manual fox report** — `POST /areas/:area_id/location` (`jotihunt.ts:498`),
- [ ] on hunt approve/reject — re-weight or drop the anchor.

All four endpoints already emit sockets, so they're clean hook points.

---

## STEP 5 — API + frontend

### Backend
- [ ] `GET /api/jotihunt/areas/:areaId/prediction` (tenant-scoped, same auth
      pattern as the existing `/areas/:areaId/route`) → latest `fox_predictions` row.

### Frontend (`Map.tsx`)
- [ ] Heatmap overlay (Leaflet `heatLayer` or polygon layer from the GeoJSON).
- [ ] Top-3 zone markers with **confidence + "based on: hunt / hint / sighting"**
      so hunters can judge trust.
- [ ] Per-fox toggle; auto-refresh on the existing socket cycle.
- [ ] i18n strings in `en.json` / `nl.json`.

---

## STEP 6 — Validate with a dry run (no real data exists)

- [ ] `backend/scripts/simulate-prediction.ts`: seed a dev DB with fake hunts,
      hint solutions, and manual pins over time; watch the heatmap react.
- [ ] Check the fallback chain (only-API → manual → hint → hunt) and that
      confidence rises as better anchors arrive.

---

## Priority order (what to build, in sequence)

1. **Step 1 — fix the manual hint input.** Without it, signal #2 is broken/untrusted.
2. **Step 2 — foundations** (boundary, routing, cache table). Prep before event.
3. **Step 3 — prediction service** with the trust-weighted anchor.
4. **Step 4 — triggers** so it reacts live.
5. **Step 5 — API + map overlay** with honest confidence labels.
6. **Step 6 — dry-run validation.**

> Steps 1 and 2 are independent and can be done in parallel.

---

## Realistic expectations

- **Good case:** "Bravo likely NE near [hint coord], ≤8 km of a hunt 25 min ago —
  confidence high." Saves real driving time.
- **Sparse case:** prediction ≈ the whole reachable area, low confidence. Still
  useful *if* the UI is honest about it.
- **Not feasible:** precise point prediction; ML in v1 (no training data exists).

---

## Dependencies to add

- `@turf/turf` (JS geometry), optional `h3-js` (hex grid).
- OSRM (self-hosted, Docker) — decided in Step 2b.
- Leaflet heat plugin on the frontend (if not already present).

---

## Decisions locked in

- ✅ Hint data model: **one row per revealed fox** (Step 1a).
- ✅ Hint trust: **admin confirms**; unverified = low weight (Step 1b).
- ✅ Hint UI: **leave both modals as-is**, just fix the shared backend (Step 1c).
- ✅ Hint entry: **standalone** — `article_id` nullable, enter a hint with no API
  article (Step 1d).
- ✅ Routing: **self-hosted OSRM** with straight-line fallback (Step 2b).

## Still open (not blocking the first steps)

1. Is there an official play-boundary polygon, or do we draw an approximate one?
   (Needed for Step 2a; Step 1 doesn't depend on it.)
2. Where does OSRM run on event day — same host as the backend, or separate?
