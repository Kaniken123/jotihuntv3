# Mobile app — port the recent web changes

Scope locked in 2026-05-25. Mobile is hunter-focused (no admin tabs). Backend
is already shipped; mobile only needs frontend parity.

**Deferred:** prediction overlay — the mobile map is already too cluttered;
fix that first in a separate pass. Don't port `FoxPredictionLayer` for now.

---

## 1. Hunt cooldowns on mobile  🎯 primary task

Mirror what the web `HuntRegistration` does. Backend already enforces (HTTP
429) — mobile needs to fetch + display + gate.

- [ ] **`gameService.getHuntCooldowns()`** — new method, `GET /hunts/cooldowns`.
  Returns `[{ fox_area, approved_at, cooldown_until }]` per fox the team is
  still locked out of. Already team-scoped server-side.
  *(mobile/src/services/gameService.ts)*

- [ ] **HuntScreen state + fetching.**
  - On mount: call `getHuntCooldowns()`, store as `Record<fox_area, ISO date>`.
  - After every successful submit: re-fetch.
  - Add a 30-s `setInterval` `tick` (force re-render so countdowns stay
    current); clear on unmount.

- [ ] **Render readiness in the fox picker** (whatever UI element mobile
  uses — Picker / SegmentedControl / list):
  - In cooldown: append `🔒 ${count} min wachten` (NL) / `🔒 wait ${count} min` (EN).
  - Ready: append `⏳ Klaar om te jagen` / `⏳ Ready to hunt`.
  - Count is `Math.ceil((cooldown_until - now) / 60_000)`.

- [ ] **Disable submit when the selected fox is in cooldown** — same gate
  logic as web: `cooldownWait(selectedFox) > 0`. Visible disabled state.

- [ ] **Handle the 429 in the submit catch block.**
  Backend returns `{ error, fox_area, cooldown_until, wait_minutes }`. Surface
  `error` to the user — don't silent-fail.

- [ ] **i18n keys** (if mobile uses i18next — check). Mirror web:
  - `hunt.waitMinutes` with `{{count}}`
  - `hunt.cooldownActive` with `{{area}}`, `{{count}}`

- [ ] **Drop the misleading "(Unknown Team)" / `(<fox_team_name>)` suffix**
  from the fox picker while you're in there — `area.name` IS the fox team.

> The cooldown timer is anchored on `approved_at` server-side, so a pending
> submission does NOT lock the team out. The clock only starts when an admin
> approves. (Hunters don't need to know this — but it explains why dropdown
> sometimes shows "Ready" right after they submit.)

## 2. Make chat global (one shared room)  🎯 primary task

Mobile currently uses the old team-only endpoints (`/chat/messages/:team_id`)
and hard-gates the screen on `teamId`. Migrate to the channels API and use
the tenant-wide **general** channel, which every user can see.

- [ ] **Remove the `if (!teamId)` block** at top of `ChatScreen` (line ~160).
  The "No Team" message + its styles can go.

- [ ] **New service methods** in `mobile/src/services/gameService.ts`:
  - `getChatChannels()` → `GET /chat/channels` (returns the user's accessible
    channels; mobile only needs the one with `type === 'general'`).
  - `getChannelMessages(channelId)` → `GET /chat/channels/:id/messages`.
  - `sendChannelMessage(channelId, message, attachment?)` →
    `POST /chat/channels/:id/messages` (multipart if attachment).
  - Delete or deprecate the old `getTeamMessages` / `sendTeamMessage` once
    nothing else uses them.

- [ ] **ChatScreen rewrite (load + send):**
  - On mount: `getChatChannels()`, pick the one with `type === 'general'`,
    store as `activeChannel`. Then `getChannelMessages(activeChannel.id)`.
  - Send: `sendChannelMessage(activeChannel.id, text, file?)`.
  - **Optimistic add** the response to local state immediately (don't rely
    only on the socket echo — same fix as web).

- [ ] **Switch socket room join** from team-based to tenant-general:
  - Stop emitting `join-team`.
  - Emit `join-tenant-general` with the tenant id (web does this via
    `WebSocketContext`).
  - Listen for `new-message` (the channels API uses this) instead of
    `team-message` / `new-team-message`. Filter by `message.channel_id === activeChannel.id`
    in the handler.

- [ ] **Header / title cleanup:** the screen showed `authState.team?.name`
  in the header — replace with something tenant-neutral like "Chat" or
  the channel name ("General").

- [ ] **Optional polish:** drop unused team-specific styles + state once the
  team flow is gone.

> Backend already supports this — the web has been using the channels API
> for a while. Same endpoints (`/chat/channels`, `/chat/channels/:id/messages`),
> same socket events (`new-message`, `join-tenant-general`).

## Smaller fixes also worth doing in the same pass

These are 5-minute typing/contract fixes that came along with the recent
backend work. Easy to lump in while you're already in those files.

- [ ] **`gameService.submitHintSolution(articleId, …)`** — widen `articleId`
  to `number | null`. Backend now accepts standalone hint entries (no synced
  article). If mobile has a quick-hint UI, allow opening it without a
  selected article.

- [ ] **`gameService.updateHintSolution(id, data)`** — change payload to
  `{ verification_status: 'confirmed' | 'rejected' | 'unverified' }`. Old
  shape is still accepted by the backend for legacy compat, but the new one
  drives the predictor properly.

- [ ] **`FoxRoutePoint.id` is now `string | number`** — `GET /jotihunt/areas/:id/route`
  returns prefixed ids (`loc-N` / `hunt-N` / `hint-N`) because it merges
  `area_locations`, `hunts`, and confirmed `hint_solutions` into one trail.
  Widen the type and check any `id === N` comparisons in mobile.
  *(mobile/src/types/index.ts + any route-rendering screen)*

---

## Explicitly skipped (don't port)

- ❌ **Fox prediction overlay (🎯)** — deferred until the mobile map is
  decluttered. Don't port `FoxPredictionLayer`.
- ❌ All admin-only UI: Admin Dashboard tabs, Hint Verification screen,
  Reset for Launch modal, `hunt-pending-review` notifications, the
  recompute-predictions endpoint.

---

## Suggested order

1. **Chat global migration** first — it's the bigger refactor and the
   "No Team" screen is user-visible.
2. **Hunt cooldown UI** next — the backend 429 is already biting any
   hunter who tries to re-hunt within an hour; mobile is currently
   silent-failing or showing a confusing message.
3. **Smaller contract fixes** (the type/payload tweaks) as you touch
   those files.

For the *why* on any of this, `FOX_PREDICTION_PLAN.md` PROGRESS LOG has
the full rationale — this file is just the what.
