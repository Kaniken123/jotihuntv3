# Jotihunt v2 - Technische Documentatie

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Architectuur](#architectuur)
3. [Technologiestack](#technologiestack)
4. [Database Schema](#database-schema)
5. [Backend Functionaliteiten](#backend-functionaliteiten)
6. [Frontend Functionaliteiten](#frontend-functionaliteiten)
7. [API Endpoints](#api-endpoints)
8. [Real-time Functionaliteit](#real-time-functionaliteit)
9. [Authenticatie en Beveiliging](#authenticatie-en-beveiliging)
10. [Multi-tenancy](#multi-tenancy)
11. [Installatie en Configuratie](#installatie-en-configuratie)
12. [Deployment](#deployment)

---

## Overzicht

Jotihunt v2 is een real-time web-applicatie voor het organiseren en volgen van de Jotihunt, een jachtspel waarbij teams vossen (fox teams) proberen te vinden en te fotograferen. De applicatie biedt uitgebreide functionaliteit voor locatietracking, communicatie tussen teamleden, hint-beheer, en administratieve tools.

### Kernfunctionaliteiten

- Real-time locatietracking van gebruikers en vossenteams
- Interactieve kaart met live updates
- Team chat met bestandsbijlagen en emoji-reacties
- Hunt (jacht) registratie met foto-upload
- Hints en opdrachten beheer
- Administratieve dashboards
- Multi-tenant ondersteuning
- Role-based access control
- Automatische synchronisatie met externe Jotihunt API

---

## Architectuur

### High-level Architectuur

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  - Vite build tool                                   │
│  - React Router voor navigatie                      │
│  - Leaflet voor kaarten                             │
│  - Socket.IO client voor real-time                  │
└──────────────┬──────────────────────────────────────┘
               │ HTTP/REST + WebSocket
               │
┌──────────────▼──────────────────────────────────────┐
│              Backend (Express.js)                    │
│  - REST API endpoints                                │
│  - Socket.IO server                                  │
│  - JWT authenticatie                                 │
│  - Cron jobs voor API sync                          │
└──────────────┬──────────────────────────────────────┘
               │ Knex.js ORM
               │
┌──────────────▼──────────────────────────────────────┐
│              Database (SQLite3)                      │
│  - 20+ tabellen                                      │
│  - Versioned migrations                              │
└─────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│         Externe Jotihunt API                         │
│  - https://jotihunt.nl/api/2.0                      │
│  - Synchronisatie om de 3 minuten                   │
└─────────────────────────────────────────────────────┘
```

### Projectstructuur

```
jotihuntv2/
├── backend/                    # Express.js server
│   ├── src/
│   │   ├── server.ts          # Hoofdbestand, Express + Socket.IO setup
│   │   ├── routes/            # API route handlers (8 bestanden)
│   │   ├── middleware/        # Auth middleware
│   │   ├── services/          # Business logic (Jotihunt API integratie)
│   │   ├── utils/             # Database config, coordinate berekeningen
│   │   └── types/             # TypeScript type definities
│   ├── database/
│   │   ├── migrations/        # 20 database migraties
│   │   ├── seeds/             # Seed data voor ontwikkeling
│   │   └── jotihunt.db       # SQLite database bestand
│   ├── uploads/               # Uploaded bestanden (foto's, attachments)
│   └── dist/                  # Gecompileerde JavaScript
│
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # React componenten (20 bestanden)
│   │   ├── contexts/          # React Context providers (Auth, WebSocket, Notifications)
│   │   ├── services/          # API client services
│   │   ├── types/             # TypeScript interfaces
│   │   └── utils/             # Utility functies
│   └── dist/                  # Production build output
│
└── node_modules/              # Gedeelde dependencies
```

---

## Technologiestack

### Backend

| Component | Technologie | Versie | Doel |
|-----------|-------------|--------|------|
| Runtime | Node.js | 18+ | JavaScript runtime |
| Taal | TypeScript | ^5.3.3 | Type-safe development |
| Framework | Express.js | ^4.18.2 | REST API server |
| Database | SQLite3 | ^5.1.6 | Relationele database |
| ORM | Knex.js | ^3.0.1 | Query builder & migraties |
| Real-time | Socket.io | ^4.7.5 | WebSocket server |
| Authenticatie | jsonwebtoken | ^9.0.2 | JWT tokens |
| Password hashing | bcrypt | ^2.4.3 | Beveiligde password storage |
| Security | helmet | ^7.1.0 | HTTP security headers |
| CORS | cors | ^2.8.5 | Cross-Origin Resource Sharing |
| File uploads | multer | ^1.4.5-lts.1 | Multipart form data |
| Task scheduling | node-cron | ^3.0.3 | Geplande taken |
| HTTP client | axios | ^1.6.2 | Externe API calls |
| Configuratie | dotenv | ^16.3.1 | Environment variabelen |

### Frontend

| Component | Technologie | Versie | Doel |
|-----------|-------------|--------|------|
| Library | React | ^18.2.0 | UI library |
| Taal | TypeScript | ^5.2.2 | Type-safe development |
| Build tool | Vite | ^5.0.8 | Snelle bundler |
| Styling | Tailwind CSS | ^3.3.6 | Utility-first CSS |
| Routing | React Router DOM | ^6.20.1 | Client-side routing |
| Maps | Leaflet | ^1.9.4 | Interactieve kaarten |
| Maps (React) | React Leaflet | ^4.2.1 | React wrapper voor Leaflet |
| Real-time | Socket.io Client | ^4.7.5 | WebSocket client |
| Forms | React Hook Form | ^7.48.2 | Form management |
| Icons | Lucide React | ^0.294.0 | Icon library |
| HTTP | Axios | ^1.6.2 | API client |
| Date utils | date-fns | ^2.30.0 | Datum formatting |

---

## Database Schema

### Belangrijkste Tabellen

#### 1. Gebruikers & Authenticatie

**tenants**
- Multi-tenancy: verschillende organisaties/regio's
- Velden: id, name, slug, description, logo_url, settings (JSON), is_active

**users**
- Gebruikersaccounts met tenant associatie
- Velden: id, username, email, password_hash, first_name, last_name, tenant_id, is_active, is_super_admin

**user_roles**
- Rol per tenant per gebruiker
- Rollen: super_admin, tenant_admin, user
- Velden: id, user_id, tenant_id, role, is_active

**auth_tokens**
- JWT token tracking
- Velden: id, user_id, token, expires_at, is_active

#### 2. Teams & Spel Entiteiten

**teams**
- Jachtteams met basis locaties
- Velden: id, name, description, area, base_lat, base_lng, tenant_id, is_active

**team_members**
- Team lidmaatschap
- Velden: id, team_id, user_id, role (leader/member), joined_at, is_active

**areas**
- Fox teams (8 totaal: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel)
- Velden: id, name, fox_team_name, status (active/inactive/hunted), lat, lng, points, last_seen, tenant_id

**area_locations**
- Historische fox locaties
- Velden: id, area_id, lat, lng, recorded_at, source

#### 3. Hints & Opdrachten

**articles**
- Hints, opdrachten en nieuws
- Velden: id, title, content, type (hint/assignment/news), area_id, external_id, published_at, is_active, tenant_id

**article_read_tracking**
- Bijhouden welke gebruikers hints hebben gelezen
- Velden: id, user_id, article_id, read_at

**article_completion_tracking**
- Opdracht voltooiingsstatus
- Velden: id, user_id, article_id, completed_at, completion_notes

**hint_solutions**
- Hint oplossingen met coordinaten
- Velden: id, hint_id, user_id, fox_alpha_lat, fox_alpha_lng, ..., points_awarded, is_approved, submitted_at

#### 4. Jachten (Hunts)

**hunts**
- Foto-gebaseerde hunt submissions
- Velden: id, hunter_team_id, hunter_user_id, fox_area, hunt_lat, hunt_lng, photo_url, points_awarded, status (pending/approved/rejected), rejection_reason, hunt_time, tenant_id

#### 5. Locatie Tracking

**user_locations**
- GPS tracking van gebruikers
- Velden: id, user_id, lat, lng, accuracy, recorded_at, source, session_status, tenant_id

**user_location_settings**
- Privacy en tracking instellingen
- Velden: id, user_id, tracking_interval, offline_threshold, location_sharing_enabled, privacy_mode

#### 6. Subscriptions (Accommodaties)

**subscriptions**
- Deelnemende teams/accommodaties
- Velden: id, team_name, external_id, is_participating, area_id, lat, lng, visited_by_foxes (JSON), visit_count, accomodation, street, housenumber, postcode, city, tenant_id

**subscription_locations**
- Subscription location history
- Velden: id, subscription_id, lat, lng, recorded_at

**subscription_visits**
- Fox bezoeken aan accommodaties
- Velden: id, subscription_id, fox_area, visited_at, reported_by_user_id

**subscription_fox_mappings**
- Koppeling tussen subscriptions en fox teams
- Velden: id, subscription_id, fox_area_id

#### 7. Communicatie

**team_messages**
- Team chat berichten
- Velden: id, team_id, user_id, message, attachment_url, attachment_type, is_edited, edited_at, created_at, tenant_id

**message_reactions**
- Emoji reacties op berichten
- Velden: id, message_id, user_id, reaction, created_at

**general_chat_channels**
- Algemene chat kanalen per tenant
- Velden: id, tenant_id, name, description, is_active

#### 8. Status & Geschiedenis

**fox_status_history**
- Fox status veranderingen tracking
- Velden: id, area_id, status, changed_at, changed_by_user_id

**api_cache**
- Cache voor externe API responses
- Velden: id, endpoint, response_data (JSON), cached_at, expires_at

---

## Backend Functionaliteiten

### 1. Server Setup (`backend/src/server.ts`)

**Express.js Configuratie:**
- Helmet security headers
- CORS met configureerbare origins
- JSON body parser (10MB limiet)
- Static file serving voor uploads (24-uur cache)

**Socket.IO Server:**
- CORS voor frontend en ngrok tunnels
- Tenant-specifieke rooms: `tenant-{id}-team-{id}`, `tenant-{id}-general-chat`
- Authenticatie via JWT token
- Event handlers voor join-team, join-tenant-general

**Cron Jobs:**
- Automatische API synchronisatie elke 3 minuten (configureerbaar)
- Haalt subscriptions, areas en articles op van externe API
- Respecteert rate limiting (429 responses)

### 2. Route Handlers

#### `routes/auth.ts` (427 regels)
**Endpoints:**
- POST `/api/auth/login` - Login met credentials, optionele tenant selectie
- POST `/api/auth/register` - Nieuwe gebruiker registratie
- GET `/api/auth/me` - Huidige gebruiker en team info ophalen
- POST `/api/auth/logout` - Server-side logout
- POST `/api/auth/switch-tenant` - Wissel van tenant (multi-tenant)
- GET `/api/auth/tenants` - Beschikbare tenants voor gebruiker
- GET `/api/auth/public-tenants` - Publieke tenants voor registratie
- POST `/api/auth/tenants` - Nieuwe tenant aanmaken (admin)
- PUT `/api/auth/tenants/:id` - Tenant updaten (admin)

**Functionaliteit:**
- Bcrypt password verificatie
- JWT token generatie met 24-uur expiratie
- Tenant selectie bij meerdere tenants
- Token refresh bij tenant switch
- Tenant management (admin only)

#### `routes/jotihunt.ts` (924 regels)
**Endpoints:**
- GET `/api/jotihunt/areas` - Alle fox teams met huidige locaties
- GET `/api/jotihunt/areas/:id/history` - Fox location history
- GET `/api/jotihunt/areas/:id/route` - Fox route voor visualisatie
- PUT `/api/jotihunt/areas/:id/location` - Update fox locatie (admin)
- POST `/api/jotihunt/areas/reset-all-locations` - Reset alle fox locaties (admin)
- GET `/api/jotihunt/articles` - Hints/opdrachten/nieuws met filtering
- GET `/api/jotihunt/articles/:id` - Specifiek artikel
- POST `/api/jotihunt/articles/:id/read` - Markeer als gelezen
- POST `/api/jotihunt/articles/:id/toggle-completion` - Toggle opdracht voltooiing
- POST `/api/jotihunt/hint-solutions` - Submit hint oplossing
- GET `/api/jotihunt/hint-solutions` - Gebruiker's oplossingen
- GET `/api/jotihunt/hint-solutions/all` - Alle oplossingen (admin)
- PUT `/api/jotihunt/hint-solutions/:id` - Approve/reject oplossing (admin)
- GET `/api/jotihunt/subscriptions` - Accommodaties met bezoeken
- POST `/api/jotihunt/subscriptions/:id/visits` - Registreer fox bezoek
- GET `/api/jotihunt/subscriptions/:id/visits` - Bezoek geschiedenis
- PUT `/api/jotihunt/subscriptions/:id` - Update subscription area
- POST `/api/jotihunt/sync` - Handmatige data sync (admin)
- GET `/api/jotihunt/status` - Game status

**Functionaliteit:**
- Tenant isolatie op alle endpoints
- Automatische subscription location tracking
- Fox status management (active/hunted/inactive)
- Hint oplossingen met RD coordinaten (8 fox teams)
- Article filtering op type en area
- WebSocket broadcasts voor updates

#### `routes/locations.ts` (425 regels)
**Endpoints:**
- GET `/api/locations/users` - Alle gebruiker locaties met team filtering
- POST `/api/locations/update` - Update eigen locatie
- GET `/api/locations/settings` - Ophalen locatie instellingen
- PUT `/api/locations/settings` - Opslaan locatie instellingen
- GET `/api/locations/history/:userId` - Route geschiedenis (admin)

**Functionaliteit:**
- GPS tracking met accuracy
- Privacy settings (location_sharing_enabled, privacy_mode)
- Tracking interval configuratie (10-600 seconden)
- Offline threshold (60-1800 seconden)
- Session status tracking (active/idle)
- WebSocket broadcasts voor live locatie updates
- 7-dagen data retentie

#### `routes/hunts.ts` (321 regels)
**Endpoints:**
- POST `/api/hunts/submit` - Submit hunt met foto
- GET `/api/hunts` - Gebruiker's hunts
- GET `/api/hunts/team` - Team hunts
- GET `/api/hunts/all` - Alle hunts (admin)
- PUT `/api/hunts/:id/review` - Approve/reject hunt (admin)

**Functionaliteit:**
- Multer file upload (10MB max)
- Automatische punt berekening per area
- Cooldown management tussen hunts
- Status tracking (pending/approved/rejected)
- Foto opslag in `/uploads/hunts/`
- WebSocket notificaties bij review

#### `routes/chat.ts` (485 regels)
**Endpoints:**
- GET `/api/chat/channels` - Beschikbare chat kanalen
- GET `/api/chat/messages` - Berichten voor kanaal
- POST `/api/chat/messages` - Nieuw bericht versturen
- POST `/api/chat/messages/:id/reactions` - Reactie toevoegen
- DELETE `/api/chat/messages/:id/reactions` - Reactie verwijderen
- POST `/api/chat/upload` - Bestand upload voor attachment

**Functionaliteit:**
- Team-specifieke en algemene kanalen
- Real-time bericht delivery via Socket.IO
- Emoji reacties (6 types: 👍 ❤️ 😂 😮 😢 🎉)
- File attachments met type detectie
- Message edit tracking
- Tenant isolatie

#### `routes/users.ts` (454 regels)
**Endpoints:**
- GET `/api/users` - Alle gebruikers in tenant
- GET `/api/users/:id` - Specifieke gebruiker
- POST `/api/users` - Nieuwe gebruiker aanmaken (admin)
- PUT `/api/users/:id` - Gebruiker updaten
- DELETE `/api/users/:id` - Gebruiker verwijderen (admin)
- PUT `/api/users/:id/password` - Wachtwoord wijzigen

**Functionaliteit:**
- Tenant-scoped user management
- Role assignment bij aanmaken
- Password change met bcrypt
- Gebruiker detail met team info

#### `routes/admin.ts` (546 regels)
**Endpoints:**
- GET `/api/admin/dashboard` - Dashboard statistics
- GET `/api/admin/users` - User management lijst
- GET `/api/admin/hunts/pending` - Pending hunts voor review
- GET `/api/admin/statistics` - Game statistics
- POST `/api/admin/notifications` - Broadcast notificaties
- GET `/api/admin/users/route-tracking` - Gebruikers voor route tracking

**Functionaliteit:**
- Gebruikers statistieken (actief, totaal, nieuwe)
- Hunt review interface data
- Team statistieken
- Message counts
- Notificatie broadcasting (system/team/user)
- Admin-only access via middleware

#### `routes/hints.ts` (292 regels)
**Endpoints:**
- POST `/api/hints` - Nieuwe hint aanmaken (admin)
- GET `/api/hints/:id` - Hint ophalen
- PUT `/api/hints/:id` - Hint updaten (admin)
- DELETE `/api/hints/:id` - Hint verwijderen (admin)

**Functionaliteit:**
- Hint CRUD operations
- Area assignment
- Publish date management

#### `routes/rules.ts` (66 regels)
**Endpoints:**
- GET `/api/rules` - Spelregels ophalen

**Functionaliteit:**
- Statische spelregels (8 secties)

### 3. Middleware (`backend/src/middleware/auth.ts`)

**authenticate**
- Verificatie van JWT token uit Authorization header
- Token validatie (expiratie, signature)
- Gebruiker ophalen met rollen en tenant info
- Request object aanvullen met user data

**requireAdmin**
- Controleert op tenant_admin of super_admin rol
- Gebruikt na authenticate middleware

**requireSuperAdmin**
- Controleert specifiek op super_admin rol
- Voor multi-tenant management functies

**tenantIsolation**
- Voegt tenant filtering toe aan queries
- Voorkomt cross-tenant data lekkage

### 4. Services (`backend/src/services/jotihuntApi.ts`)

**syncSubscriptions()**
- Haalt deelnemende teams op van externe API
- Synchroniseert met database (insert/update)
- Extraheert location data indien aanwezig

**syncAreas()**
- Haalt fox teams op van externe API
- Update status en locaties
- Inserts area_locations records

**syncArticles()**
- Haalt hints, opdrachten, nieuws op
- Synchroniseert met database
- Type mapping (hint/assignment/news)

**Rate Limiting:**
- 1 seconde delay tussen API calls
- Respect voor 429 responses met exponential backoff
- Error logging en handling

### 5. Utilities

**`utils/database.ts`**
- Knex configuratie en initialisatie
- Connection pooling (min 2, max 10)
- Migration runner
- Graceful shutdown handling

**`utils/coordinates.ts`**
- Haversine distance berekening
- RD (Rijksdriehoek) naar WGS84 conversie
- Proximity checks
- Bounding box berekeningen

---

## Frontend Functionaliteiten

### 1. Pagina's & Routing

**Publieke Routes:**
- `/login` - Login/registratie met tenant selectie

**Beveiligde Routes (ProtectedRoute wrapper):**
- `/` - Hoofdkaart met live tracking
- `/chat` - Team chat interface
- `/hunt` - Hunt registratie formulier
- `/updates` - Hints/opdrachten lijst
- `/updates/:id` - Gedetailleerde update view
- `/rules` - Spelregels documentatie
- `/settings` - Locatie instellingen
- `/routes` - Route tracking voor teamleden
- `/admin` - Admin dashboard (admin only)
- `/admin/routes` - Admin route tracking (admin only)

### 2. Componenten

#### **Map.tsx** (1,833 regels)
**Kernfunctionaliteit:**

*Kaartvisualisatie:*
- Leaflet interactieve kaart met OpenStreetMap tiles
- Zoom levels 7-18, start centrum Nederland
- Dark mode ondersteuning

*Fox Team Markers:*
- 8 fox teams (Alpha-Hotel) met custom SVG icons
- Team-specifieke kleuren:
  - Alpha: Orange (#FF6B35)
  - Bravo: Blue (#3B82F6)
  - Charlie: Green (#10B981)
  - Delta: Yellow (#F59E0B)
  - Echo: Purple (#8B5CF6)
  - Foxtrot: Red (#EF4444)
  - Golf: Cyan (#06B6D4)
  - Hotel: Pink (#EC4899)
- Status indicators (active/hunted/inactive)
- Popup met details en locatie geschiedenis

*Gebruiker Locaties:*
- Auto-vormige markers voor teamleden
- Kleurcodering: groen (actief <2 min), grijs (inactief)
- Team filtering toggles
- Session status weergave
- Popup met gebruiker details

*Subscription (Accommodatie) Markers:*
- Huis-vormige icons
- Bezocht/onbezocht status
- Popup met adres en bezoek geschiedenis
- Fox visit recording modal

*Fox Route Visualisatie:*
- Polylines voor bewegingsgeschiedenis
- Tijdsspanne selector (6u, 12u, 24u, custom)
- Cirkel overlays voor locatie voorspellingen
- Automatische groei op basis van tijd

*Interactieve Features:*
- Admin fox location placement mode
- Hint solution quick submit modal (8 fox coordinaten)
- Filter controls (foxes, users, subscriptions, no-hunt zones)
- Real-time updates via WebSocket
- Auto-refresh locaties

*WebSocket Events:*
- `location-update` - Algemene locatie updates
- `team-location-update` - Team locatie updates
- `fox-status-update` - Fox status wijzigingen
- `fox-location-update` - Fox positie wijzigingen
- `hint-solution-submitted` - Hint opgelost (fox reveal)
- `fox-locations-reset` - Admin reset

#### **ModernChat.tsx** (590 regels)
**Kernfunctionaliteit:**

*Kanalen:*
- Algemene tenant chat kanaal
- Team-specifieke kanalen
- Kanaal lijst met actieve highlight
- Auto-selectie general kanaal bij load

*Berichten:*
- Rich text input met auto-expand
- File attachments (upload button)
- Gebruiker avatar met initialen
- Timestamp formatting (relatief/absoluut)
- Message grouping per gebruiker

*Reacties:*
- 6 emoji types: 👍 ❤️ 😂 😮 😢 🎉
- Emoji picker modal
- Reaction count aggregatie
- Real-time sync

*Features:*
- Zoekfunctionaliteit
- Scroll-to-bottom op nieuwe berichten
- Message status indicators
- Edit status tracking
- Link detection en rendering

*WebSocket Events:*
- `new-message` - Nieuwe berichten
- `message-reaction-added` - Reactie toegevoegd
- `message-reaction-removed` - Reactie verwijderd

#### **HuntRegistration.tsx** (330 regels)
**Kernfunctionaliteit:**

*Hunt Submission:*
- Area selectie dropdown (8 fox teams)
- Camera foto upload met preview
- Huidige locatie ophalen via Geolocation API
- Form validatie
- Loading states

*Recente Hunts:*
- Laatste 5 hunts weergave
- Status indicators (pending/approved/rejected)
- Timestamp en area display
- Foto preview

*Features:*
- Large file support (tot 10MB)
- Error handling voor geolocation
- Success/error feedback messages

#### **AdminDashboard.tsx** (2,080 regels)
**Kernfunctionaliteit:**

*Tab Interface (6 tabs):*
1. **Overzicht:**
   - User statistieken (totaal, actief, nieuwe)
   - Team counts
   - Hunt counts (pending/approved/rejected)
   - Message counts
   - Recent activity feed

2. **Hunt Review:**
   - Pending hunts lijst met filters
   - Foto preview
   - Locatie op kaart
   - Approve/reject acties met feedback
   - Bulk actions

3. **Gebruikersbeheer:**
   - User lijst met search/filter
   - Create nieuwe gebruiker modal
   - Edit gebruiker modal
   - Delete gebruiker met confirmatie
   - Role assignment
   - Team assignment

4. **Areas Beheer:**
   - Fox team lijst
   - Status toggles (active/hunted/inactive)
   - Locatie update interface
   - Reset all fox locations button
   - Area statistics

5. **Notificaties:**
   - Broadcast interface
   - Type selectie (system/team/user)
   - Target selectie (alle users, specifiek team, specifieke user)
   - Title en message input
   - Send button met confirmatie

6. **Tenant Beheer:**
   - Tenant lijst
   - Create nieuwe tenant modal
   - Edit tenant modal
   - Tenant activation toggle
   - Tenant settings (JSON)

*Extra Features:*
- Data sync button (handmatige API sync)
- Export functionaliteit
- Statistieken grafieken
- Activity log

#### **LocationSettings.tsx** (460 regels)
**Kernfunctionaliteit:**

*Privacy Instellingen:*
- Location sharing toggle (aan/uit)
- Privacy mode toggle (verberg voor iedereen behalve admin)
- Waarschuwing bij privacy mode activatie

*Tracking Configuratie:*
- Tracking interval slider (10-600 seconden)
- Offline threshold slider (60-1800 seconden)
- Real-time preview van instellingen

*Locatie Geschiedenis:*
- Delete location history button
- Confirmatie modal
- 7-dagen retentie warning

*Features:*
- Settings auto-save
- Success/error feedback
- Uitleg teksten voor elke instelling

#### **HintsList.tsx** (658 regels)
**Kernfunctionaliteit:**

*Filtering:*
- Type filter (hints/assignments/news/all)
- Area filter (8 fox teams + all)
- Search bar (titel/content)
- Combinatie van filters

*Artikel Cards:*
- Type badge met kleur (hint=blue, assignment=green, news=yellow)
- Area badge indien van toepassing
- Read/unread status indicator
- Completion status voor assignments
- Publish date/tijd
- Content preview (eerste 150 tekens)

*Acties:*
- Mark as read button
- Toggle completion (assignments)
- Submit solution button (hints)
- Navigatie naar detail pagina

*Solution Modal:*
- 8 fox coordinaat inputs (RD formaat)
- Validatie van coordinaten
- Submit button
- Success/error feedback

#### **SubscriptionManager.tsx** (260 regels)
**Kernfunctionaliteit:**

*Subscription Lijst:*
- Team naam en area assignment
- Accommodatie details (adres, type, stad)
- Visit count en status
- Visited foxes lijst

*Fox Visit Recording:*
- Fox team selectie dropdown
- Visit timestamp (automatisch)
- Reporter tracking (huidige gebruiker)
- Submit button

*Features:*
- Search/filter subscriptions
- Sort by visits
- Status indicators

#### **Navbar.tsx** (295 regels)
**Kernfunctionaliteit:**

*Navigatie:*
- Logo/branding
- Hoofdmenu items met icons:
  - Home (Map)
  - Chat
  - Hunt
  - Updates
  - Routes
  - Rules
  - Admin (indien admin)
- Active page highlighting
- Responsive mobile menu

*Gebruiker Menu:*
- Team display badge
- Notification bell met unread count
- User dropdown met:
  - Gebruikersnaam en rol
  - Settings link
  - Tenant switcher (indien super admin)
  - Logout button

*Features:*
- Dark mode toggle
- Mobile hamburger menu
- Responsive design (hidden op mobile, show bij hamburger click)

#### **NotificationCenter.tsx** (233 regels)
**Kernfunctionaliteit:**

*Notificatie Panel:*
- Bell icon met unread badge
- Slide-in panel van rechts
- Notification lijst met grouping

*Notificatie Types:*
- Message (chat icoon, blauw)
- Hunt (camera icoon, groen)
- Assignment (clipboard icoon, paars)
- Location (map pin icoon, oranje)
- System (info icoon, grijs)

*Acties:*
- Mark individual as read
- Mark all as read
- Clear all notifications
- Navigatie naar relevante pagina bij click

*Features:*
- Relatieve tijd display (2m ago, 3h ago)
- localStorage persistence
- Max 50 notificaties historie
- Browser notification permission request

#### **FoxStatusOverlay.tsx** (163 regels)
**Kernfunctionaliteit:**

*Status Summary:*
- Expandable overlay (rechtsonder op kaart)
- Count per status:
  - Active foxes (groen)
  - Hunted foxes (rood)
  - Inactive foxes (grijs)

*Gedetailleerd Overzicht:*
- Lijst van alle fox teams
- Status per team met timestamp
- Last seen locatie
- Expand/collapse toggle

#### **RouteTracker.tsx** + **AdminRouteTracking.tsx** (579 + 456 regels)
**Kernfunctionaliteit:**

*Gebruiker Selectie:*
- Lijst van teamleden met location history
- Filter op team (admin)
- Availability indicator

*Route Visualisatie:*
- Kaart met route polyline
- Start/end markers
- Location points met timestamps
- Route statistieken:
  - Totale afstand
  - Gemiddelde snelheid
  - Tijd periode
  - Aantal punten

*Features:*
- Date range selector
- Export route data
- Speed heatmap kleuren op route

#### **Rules.tsx** (737 regels)
**Kernfunctionaliteit:**

*8 Secties:*
1. Overzicht - Algemene introductie
2. Schema - Tijdschema van het spel
3. Veiligheid - Veiligheidsregels
4. Teams - Teamstructuur
5. Vossen - Fox team regels
6. Jachten - Hunt regels
7. Punten - Punten systeem
8. Overige Regels

*Features:*
- Tab navigatie
- Sticky sidebar op desktop
- Scroll-to-section
- Dark mode ondersteuning
- Responsive design

### 3. Context Providers

#### **AuthContext** (`contexts/AuthContext.tsx`)
**State:**
```typescript
{
  user: User | null,
  team: Team | null,
  token: string | null,
  currentTenant: Tenant | null,
  availableTenants: Tenant[],
  isLoading: boolean,
  isAuthenticated: boolean,
  isSuperAdmin: boolean
}
```

**Acties:**
- login(credentials)
- register(userData)
- logout()
- switchTenant(tenantId)
- updateUser(userData)
- refreshUserData()

**Features:**
- localStorage token persistence
- Automatische token retrieval bij app load
- 401 error handling met redirect
- Multi-tenant ondersteuning
- Role-based flags

#### **WebSocketContext** (`contexts/WebSocketContext.tsx`)
**State:**
```typescript
{
  socket: Socket | null,
  isConnected: boolean
}
```

**Features:**
- Socket.IO initialisatie met token auth
- Automatische reconnection
- Tenant room joining (join-tenant-general)
- Team room joining (join-team)
- Error handling zonder app crash
- Connection status tracking

**Event Helpers:**
- on(event, handler) - Event listener toevoegen
- emit(event, data) - Event versturen
- off(event, handler) - Event listener verwijderen

#### **NotificationContext** (`contexts/NotificationContext.tsx`)
**State:**
```typescript
{
  notifications: NotificationData[],
  unreadCount: number,
  isVisible: boolean
}
```

**Acties:**
- addNotification(notification)
- markAsRead(notificationId)
- markAllAsRead()
- removeNotification(notificationId)
- clearAll()
- toggleVisibility()

**Features:**
- localStorage persistence
- Browser notification API integratie
- Real-time WebSocket listeners (7 events)
- Auto-close na 5 seconden
- Max 50 notificaties historie

**WebSocket Events:**
- new-message
- hunt-reviewed
- new-assignment
- location-alert
- system-notification
- team-notification
- user-notification

### 4. Services

#### **authService.ts**
**API Methods:**
- login(username, password, tenantSlug?)
- register(userData, tenantSlug?)
- getCurrentUser()
- logout()
- switchTenant(tenantId)
- getTenants()
- getPublicTenants()
- createTenant(tenantData)
- updateTenant(tenantId, updates)

**Features:**
- Axios instance met Bearer token interceptor
- Automatische token injection
- 401 response interceptor
- Base URL: `/api`

#### **gameService.ts** (184 regels)
**40+ API Methods:**

*Areas & Fox Teams:*
- getAreas()
- updateFoxLocation(areaId, lat, lng)
- getFoxLocationHistory(areaId, limit)
- getFoxRoute(areaId, timeSpan)
- resetAllFoxLocations()

*Hunts:*
- submitHunt(formData)
- getHunts()
- getUserRoute(userId, startDate, endDate)

*Locations:*
- getUserLocations()
- updateUserLocation(lat, lng, accuracy)
- getLocationSettings()
- updateLocationSettings(settings)

*Subscriptions:*
- getSubscriptions()
- recordFoxVisit(subscriptionId, foxArea)
- getSubscriptionVisits(subscriptionId)
- updateSubscription(subscriptionId, updates)

*Articles:*
- getArticles(type?, areaId?)
- getArticle(articleId)
- markArticleAsRead(articleId)
- toggleAssignmentCompletion(articleId)

*Hints:*
- submitHintSolution(hintId, coordinates)
- getHintSolutions()
- getAllHintSolutions()
- updateHintSolution(solutionId, updates)

*Admin:*
- getStatus()
- syncData()
- deleteUser(userId)
- getUsersForRouteTracking()

### 5. Type Definitions

Zie [Database Schema](#database-schema) sectie voor type details.

---

## API Endpoints

### Overzicht API Endpoints

| Methode | Endpoint | Authenticatie | Rol | Beschrijving |
|---------|----------|---------------|-----|--------------|
| **Auth** |
| POST | /api/auth/login | Nee | - | Login met credentials |
| POST | /api/auth/register | Nee | - | Nieuwe gebruiker registratie |
| GET | /api/auth/me | Ja | - | Huidige gebruiker info |
| POST | /api/auth/logout | Ja | - | Logout |
| POST | /api/auth/switch-tenant | Ja | - | Wissel tenant |
| GET | /api/auth/tenants | Ja | - | Beschikbare tenants |
| GET | /api/auth/public-tenants | Nee | - | Publieke tenants |
| POST | /api/auth/tenants | Ja | Admin | Nieuwe tenant |
| PUT | /api/auth/tenants/:id | Ja | Admin | Update tenant |
| **Jotihunt** |
| GET | /api/jotihunt/areas | Ja | - | Alle fox teams |
| GET | /api/jotihunt/areas/:id/history | Ja | - | Fox history |
| GET | /api/jotihunt/areas/:id/route | Ja | - | Fox route |
| PUT | /api/jotihunt/areas/:id/location | Ja | Admin | Update fox locatie |
| POST | /api/jotihunt/areas/reset-all-locations | Ja | Admin | Reset fox locaties |
| GET | /api/jotihunt/articles | Ja | - | Hints/opdrachten/nieuws |
| GET | /api/jotihunt/articles/:id | Ja | - | Specifiek artikel |
| POST | /api/jotihunt/articles/:id/read | Ja | - | Markeer gelezen |
| POST | /api/jotihunt/articles/:id/toggle-completion | Ja | - | Toggle voltooiing |
| POST | /api/jotihunt/hint-solutions | Ja | - | Submit hint oplossing |
| GET | /api/jotihunt/hint-solutions | Ja | - | Eigen oplossingen |
| GET | /api/jotihunt/hint-solutions/all | Ja | Admin | Alle oplossingen |
| PUT | /api/jotihunt/hint-solutions/:id | Ja | Admin | Approve oplossing |
| GET | /api/jotihunt/subscriptions | Ja | - | Accommodaties |
| POST | /api/jotihunt/subscriptions/:id/visits | Ja | - | Registreer bezoek |
| GET | /api/jotihunt/subscriptions/:id/visits | Ja | - | Bezoek geschiedenis |
| PUT | /api/jotihunt/subscriptions/:id | Ja | Admin | Update subscription |
| POST | /api/jotihunt/sync | Ja | Admin | Data synchronisatie |
| GET | /api/jotihunt/status | Ja | - | Game status |
| **Locations** |
| GET | /api/locations/users | Ja | - | Gebruiker locaties |
| POST | /api/locations/update | Ja | - | Update eigen locatie |
| GET | /api/locations/settings | Ja | - | Locatie instellingen |
| PUT | /api/locations/settings | Ja | - | Save locatie instellingen |
| GET | /api/locations/history/:userId | Ja | Admin | Route geschiedenis |
| **Hunts** |
| POST | /api/hunts/submit | Ja | - | Submit hunt |
| GET | /api/hunts | Ja | - | Eigen hunts |
| GET | /api/hunts/team | Ja | - | Team hunts |
| GET | /api/hunts/all | Ja | Admin | Alle hunts |
| PUT | /api/hunts/:id/review | Ja | Admin | Review hunt |
| **Chat** |
| GET | /api/chat/channels | Ja | - | Chat kanalen |
| GET | /api/chat/messages | Ja | - | Berichten ophalen |
| POST | /api/chat/messages | Ja | - | Nieuw bericht |
| POST | /api/chat/messages/:id/reactions | Ja | - | Reactie toevoegen |
| DELETE | /api/chat/messages/:id/reactions | Ja | - | Reactie verwijderen |
| POST | /api/chat/upload | Ja | - | Bestand upload |
| **Users** |
| GET | /api/users | Ja | Admin | Alle gebruikers |
| GET | /api/users/:id | Ja | - | Specifieke gebruiker |
| POST | /api/users | Ja | Admin | Nieuwe gebruiker |
| PUT | /api/users/:id | Ja | Admin | Update gebruiker |
| DELETE | /api/users/:id | Ja | Admin | Delete gebruiker |
| PUT | /api/users/:id/password | Ja | - | Wachtwoord wijzigen |
| **Admin** |
| GET | /api/admin/dashboard | Ja | Admin | Dashboard stats |
| GET | /api/admin/users | Ja | Admin | User management |
| GET | /api/admin/hunts/pending | Ja | Admin | Pending hunts |
| GET | /api/admin/statistics | Ja | Admin | Game statistics |
| POST | /api/admin/notifications | Ja | Admin | Broadcast notificaties |
| GET | /api/admin/users/route-tracking | Ja | Admin | Route tracking users |
| **Hints** |
| POST | /api/hints | Ja | Admin | Nieuwe hint |
| GET | /api/hints/:id | Ja | - | Hint ophalen |
| PUT | /api/hints/:id | Ja | Admin | Update hint |
| DELETE | /api/hints/:id | Ja | Admin | Delete hint |
| **Rules** |
| GET | /api/rules | Ja | - | Spelregels |

---

## Real-time Functionaliteit

### WebSocket Events

#### Client → Server Events

**Room Management:**
```typescript
socket.emit('join-team', { teamId: number, token: string })
socket.emit('join-tenant-general', { tenantId: number, token: string })
```

**Geen andere client-initiated events** - alle data updates gaan via REST API, server broadcast daarna via WebSocket.

#### Server → Client Events

**Locatie Updates:**
```typescript
// Algemene locatie update
socket.on('location-update', (data: UserLocation) => {})

// Team-specifieke locatie update
socket.on('team-location-update', (data: UserLocation) => {})

// Fox locatie update
socket.on('fox-location-update', (data: { areaId, lat, lng, timestamp }) => {})

// Fox status wijziging
socket.on('fox-status-update', (data: { areaId, status, timestamp }) => {})

// Fox locaties reset
socket.on('fox-locations-reset', () => {})
```

**Chat Updates:**
```typescript
// Nieuw bericht
socket.on('new-message', (message: TeamMessage) => {})

// Reactie toegevoegd
socket.on('message-reaction-added', (data: { messageId, reaction, user }) => {})

// Reactie verwijderd
socket.on('message-reaction-removed', (data: { messageId, reaction, userId }) => {})
```

**Notificaties:**
```typescript
// Chat bericht notificatie
socket.on('new-message', (notification: NotificationData) => {})

// Hunt review notificatie
socket.on('hunt-reviewed', (notification: NotificationData) => {})

// Nieuwe opdracht
socket.on('new-assignment', (notification: NotificationData) => {})

// Locatie alert
socket.on('location-alert', (notification: NotificationData) => {})

// Systeem notificatie (broadcast alle users)
socket.on('system-notification', (notification: NotificationData) => {})

// Team notificatie (broadcast naar team)
socket.on('team-notification', (notification: NotificationData) => {})

// Gebruiker notificatie (specifieke user)
socket.on('user-notification', (notification: NotificationData) => {})
```

**Hint/Assignment Updates:**
```typescript
// Hint oplossing ingediend (reveals fox locaties)
socket.on('hint-solution-submitted', (data: { hintId, foxLocations }) => {})
```

### Room Structuur

**Tenant General Room:**
- Format: `tenant-{tenantId}-general-chat`
- Gebruikt voor: algemene chat, system notifications, tenant-wide broadcasts

**Team Room:**
- Format: `tenant-{tenantId}-team-{teamId}`
- Gebruikt voor: team chat, team-specifieke locatie updates, team notifications

### Connection Lifecycle

**Client-side:**
1. AuthContext initialiseert WebSocketContext
2. WebSocket connectie met JWT token in auth parameter
3. Bij connectie: auto-join tenant general room en team room
4. Event listeners registreren in componenten
5. Bij disconnect: automatische reconnect poging
6. Bij logout: socket disconnect

**Server-side:**
1. Socket.IO server luistert op `/api/socket.io/`
2. Bij connectie: JWT token verificatie
3. join-team event: gebruiker toevoegen aan team room
4. join-tenant-general event: gebruiker toevoegen aan tenant room
5. Disconnect handling

---

## Authenticatie en Beveiliging

### Authenticatie Flow

**Registratie:**
1. Gebruiker vult registratie formulier in
2. Optioneel: tenant slug selecteren (multi-tenant)
3. POST /api/auth/register met credentials
4. Server: bcrypt password hashing (10 salt rounds)
5. Gebruiker aanmaken in database
6. Default rol: 'user'
7. JWT token generatie
8. Token + user data terugsturen

**Login:**
1. Gebruiker vult login formulier in
2. POST /api/auth/login met username/email + password
3. Server: bcrypt password verificatie
4. Bij meerdere tenants: tenant selectie modal
5. JWT token generatie met tenant_id claim
6. Token opslaan in localStorage
7. Redirect naar hoofdpagina

**Token Structuur:**
```typescript
{
  userId: number,
  username: string,
  email: string,
  tenantId: number,
  roles: Array<{ role: string, tenantId: number }>,
  isSuperAdmin: boolean,
  iat: number,  // issued at
  exp: number   // expiration (24 uur)
}
```

**Token Refresh:**
- Bij tenant switch: nieuwe token met nieuwe tenant_id
- Bij user update: nieuwe token met updated data
- Geen automatische refresh - 24-uur expiratie

**Token Validatie:**
- authenticate middleware op alle beveiligde routes
- JWT signature verificatie
- Expiratie check
- Gebruiker ophalen uit database
- Request object aanvullen met user data

### Beveiliging Measures

**Password Security:**
- Bcrypt hashing met 10 salt rounds
- Minimum password lengte (frontend validatie)
- Password change alleen met oude password verificatie

**JWT Security:**
- Secret key in .env bestand (JWT_SECRET)
- 24-uur token expiratie
- Signed met HS256 algoritme
- Bearer token in Authorization header

**HTTP Security:**
- Helmet middleware voor security headers
- CORS met configureerbare origins
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security

**SQL Injection Prevention:**
- Knex parameterized queries
- Geen raw SQL queries
- Input sanitization

**File Upload Security:**
- Multer middleware met file size limiting (10MB)
- File type validatie (mimetype check)
- Opslag buiten document root
- Unieke filenames (timestamp + random)

**Cross-Site Scripting (XSS):**
- React's automatic escaping
- Geen dangerouslySetInnerHTML gebruik
- Content-Security-Policy headers

**Cross-Site Request Forgery (CSRF):**
- JWT tokens (niet in cookies)
- SameSite cookie attribute voor session cookies

### Authorization

**Role Hierarchy:**
1. **super_admin** - Globale admin, toegang tot alle tenants
2. **tenant_admin** - Admin binnen specifieke tenant
3. **user** - Standaard gebruiker binnen tenant

**Permission Checks:**
```typescript
// Middleware
requireAdmin - tenant_admin OF super_admin
requireSuperAdmin - alleen super_admin

// Frontend utilities
isAdmin(user) - Controleert admin rol in huidige tenant
isSuperAdmin(user) - Controleert super_admin rol
hasRole(user, role, tenantId) - Specifieke rol check
```

**Tenant Isolation:**
- Alle queries gefilterd op tenant_id
- tenantIsolation middleware voegt WHERE clause toe
- Cross-tenant data toegang alleen voor super_admin
- Frontend: huidige tenant in AuthContext

---

## Multi-tenancy

### Architectuur

**Tenant Model:**
```typescript
{
  id: number,
  name: string,              // Display name: "Regio Noord"
  slug: string,              // URL-friendly: "regio-noord"
  description?: string,
  logo_url?: string,
  settings?: JSON,           // Tenant-specific configuratie
  is_active: boolean
}
```

**User-Tenant Relatie:**
- Gebruiker kan meerdere tenants hebben
- user_roles tabel koppelt user aan tenant met specifieke rol
- Huidige tenant opgeslagen in JWT token
- Tenant switch genereert nieuwe token

**Data Isolatie:**
- Elke tabel (behalve users, tenants) heeft tenant_id foreign key
- Middleware voegt automatisch tenant filtering toe
- Queries zijn tenant-scoped tenzij super_admin
- WebSocket rooms zijn tenant-specifiek

### Tenant Management

**Tenant Aanmaken (Super Admin):**
1. POST /api/auth/tenants met tenant data
2. Tenant record aanmaken
3. Optioneel: initial teams, areas, settings aanmaken
4. Super admin krijgt automatisch toegang

**Tenant Selectie:**
1. Bij login: lijst van beschikbare tenants ophalen
2. Gebruiker selecteert tenant (indien meerdere)
3. JWT token met tenant_id
4. Frontend opslaan in AuthContext

**Tenant Switch:**
1. Super admin of gebruiker met meerdere tenants
2. TenantSwitcher component in Navbar
3. POST /api/auth/switch-tenant met nieuwe tenant_id
4. Nieuwe JWT token genereren
5. Frontend update AuthContext
6. WebSocket reconnect met nieuwe token
7. Page reload voor fresh data

**Tenant Isolation Voorbeelden:**

```typescript
// Backend - automatisch gefilterd
app.get('/api/hunts', authenticate, async (req, res) => {
  const hunts = await knex('hunts')
    .where('tenant_id', req.user.currentTenant)  // Auto-added
    .select('*');
});

// Frontend - altijd in context van huidige tenant
const { currentTenant } = useAuth();
// Alle API calls gebruiken automatisch currentTenant via JWT
```

---

## Installatie en Configuratie

### Vereisten

- Node.js 18.x of hoger
- npm 9.x of hoger
- SQLite3 (builtin met node-sqlite3)
- Git voor version control

### Installatie Stappen

**1. Repository Clonen**
```bash
git clone <repository-url>
cd jotihuntv2
```

**2. Dependencies Installeren**
```bash
# Root dependencies + backend + frontend
npm run install:all

# Of afzonderlijk
npm install              # Root
cd backend && npm install
cd ../frontend && npm install
```

**3. Environment Configuratie**

Backend `.env` bestand (`backend/.env`):
```env
# JWT Secret (WIJZIG IN PRODUCTIE!)
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production

# Environment
NODE_ENV=development

# Server
PORT=3001

# Frontend URL (voor CORS)
FRONTEND_URL=http://localhost:3000

# Auto-sync (elke 3 minuten)
ENABLE_AUTO_SYNC=true
```

Frontend environment variabelen (via vite.config.ts):
- Dev server port: 3000
- API proxy: /api → http://localhost:3001

**4. Database Setup**

```bash
cd backend

# Run migraties (maakt alle tabellen aan)
npm run db:migrate

# Seed database met initial data (optioneel)
npm run db:seed
```

**5. Start Development Servers**

```bash
# Vanaf project root - start beide servers
npm run dev

# Of afzonderlijk
npm run backend:dev    # Backend op :3001
npm run frontend:dev   # Frontend op :3000
```

**6. Toegang tot Applicatie**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Default admin credentials (na seeding):
  - Username: admin
  - Password: admin123 (WIJZIG IN PRODUCTIE!)

### Database Migraties

**Nieuwe Migratie Aanmaken:**
```bash
cd backend
npx knex migrate:make migration_name
```

**Migraties Uitvoeren:**
```bash
npm run db:migrate
```

**Rollback:**
```bash
npm run db:rollback
```

**Migration Status:**
```bash
npx knex migrate:status
```

### Database Seeding

**Nieuwe Seed Aanmaken:**
```bash
cd backend
npx knex seed:make seed_name
```

**Seeds Uitvoeren:**
```bash
npm run db:seed
```

---

## Deployment

### Production Build

**1. Build Backend:**
```bash
cd backend
npm run build

# Output: backend/dist/
```

**2. Build Frontend:**
```bash
cd frontend
npm run build

# Output: frontend/dist/
```

**3. Frontend Static Files Serven:**
- Optie A: Via backend Express server (static middleware)
- Optie B: Via CDN/static hosting (Netlify, Vercel, S3+CloudFront)

### Environment Configuratie

**Backend Production `.env`:**
```env
JWT_SECRET=<STERKE_RANDOM_STRING>
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://jotihunt.example.com
ENABLE_AUTO_SYNC=true
```

**Frontend Production:**
- Build met `npm run build`
- Environment variabelen via vite.config.ts
- API base URL configureren voor productie domein

### Server Setup

**Optie 1: PM2 Process Manager**
```bash
# Installeer PM2
npm install -g pm2

# Start backend
cd backend
pm2 start dist/server.js --name jotihunt-api

# Auto-start bij reboot
pm2 startup
pm2 save
```

**Optie 2: systemd Service (Linux)**

Maak `/etc/systemd/system/jotihunt.service`:
```ini
[Unit]
Description=Jotihunt API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/jotihunt/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl enable jotihunt
sudo systemctl start jotihunt
```

### Database

**SQLite in Productie:**
- Voor kleine tot middelgrote deployments (< 1000 concurrent users)
- Backup strategie noodzakelijk
- Overweeg PostgreSQL/MySQL voor grotere schaal

**Backups:**
```bash
# SQLite backup
sqlite3 database/jotihunt.db ".backup backup-$(date +%Y%m%d).db"

# Cron job voor dagelijkse backups
0 2 * * * /path/to/backup-script.sh
```

**Migratie naar PostgreSQL/MySQL:**
- Wijzig `backend/database/knexfile.js`
- Installeer driver: `npm install pg` of `npm install mysql2`
- Run migraties opnieuw
- Data migratie met Knex seed scripts

### Reverse Proxy (Nginx)

**Nginx Configuratie:**
```nginx
server {
    listen 80;
    server_name jotihunt.example.com;

    # Frontend static files
    location / {
        root /opt/jotihunt/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /api/socket.io/ {
        proxy_pass http://localhost:3001/api/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Uploaded files
    location /uploads {
        alias /opt/jotihunt/backend/uploads;
        expires 24h;
    }
}
```

**SSL/TLS met Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d jotihunt.example.com
```

### Monitoring & Logging

**PM2 Logging:**
```bash
pm2 logs jotihunt-api
pm2 monit
```

**Application Logging:**
- Backend logt naar stdout (capturen met PM2/systemd)
- Error tracking service (Sentry, LogRocket)
- Performance monitoring (New Relic, Datadog)

**Health Check Endpoint:**
```bash
GET /api/jotihunt/status
# Returns: { status: 'ok', timestamp, ... }
```

### Schaling

**Horizontale Schaling:**
- Meerdere backend instances met load balancer
- Shared database (switch naar PostgreSQL)
- Redis voor session sharing
- Socket.IO met Redis adapter voor multi-instance

**Verticale Schaling:**
- Verhoog Node.js memory: `node --max-old-space-size=4096`
- Database connection pooling tuning
- Nginx worker processes

### Security Checklist

- [ ] Wijzig JWT_SECRET naar sterke random string
- [ ] Wijzig default admin password
- [ ] Enable HTTPS met SSL certificaat
- [ ] Configure secure CORS origins
- [ ] Database backups geconfigureerd
- [ ] Rate limiting op API endpoints
- [ ] Input validatie op alle forms
- [ ] SQL injection preventie (Knex queries)
- [ ] XSS preventie (React escaping)
- [ ] CSP headers configureren
- [ ] Helmet security headers enabled
- [ ] File upload size limits
- [ ] Environment variabelen secure opgeslagen
- [ ] Regular dependency updates (npm audit)

---

## Bijlagen

### Code Metrics

| Aspect | Aantal |
|--------|--------|
| Backend routes | 8 bestanden, 3940 regels |
| Frontend componenten | 20 bestanden, 10169 regels |
| Database tabellen | 20+ tabellen |
| API endpoints | 60+ endpoints |
| TypeScript interfaces | 15+ major types |
| Database migraties | 20 versies |

### Externe Dependencies

**Belangrijkste Backend Dependencies:**
- express (4.18.2)
- socket.io (4.7.5)
- knex (3.0.1)
- sqlite3 (5.1.6)
- jsonwebtoken (9.0.2)
- bcrypt (2.4.3)
- multer (1.4.5-lts.1)
- axios (1.6.2)
- node-cron (3.0.3)

**Belangrijkste Frontend Dependencies:**
- react (18.2.0)
- react-router-dom (6.20.1)
- leaflet (1.9.4)
- react-leaflet (4.2.1)
- socket.io-client (4.7.5)
- axios (1.6.2)
- tailwindcss (3.3.6)
- vite (5.0.8)

### Externe API Integratie

**Jotihunt Officiële API:**
- Base URL: https://jotihunt.nl/api/2.0
- Endpoints gebruikt:
  - GET /subscriptions - Deelnemende teams
  - GET /areas - Fox team locaties
  - GET /articles - Hints/opdrachten/nieuws
- Rate limiting: max ~1 call/minuut (respecteert 429 responses)
- Synchronisatie frequentie: elke 3 minuten (configureerbaar)

### Browser Compatibility

**Minimum Vereisten:**
- Modern browsers met ES6+ support
- WebSocket ondersteuning
- Geolocation API ondersteuning
- LocalStorage ondersteuning

**Getest op:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Contact & Support

Voor vragen of issues met deze documentatie of de applicatie, neem contact op met het development team of maak een issue aan in de project repository.

**Laatste update:** 2025-10-20
**Versie:** 2.0
**Auteur:** Claude Code (Technische Documentatie Generator)
