# Jotihunt V3 — werkafspraken

Lees dit eerst. Het vangt op wat niet uit de code of de git-history te halen is.

**Het evenement is zaterdag 17 okt 10:00 t/m zondag 18 okt 12:00 2026.** Tijdens
die uren draait dit in productie met echte hunters erop. Behandel elke push als
een live ingreep: klein houden, één ding tegelijk, en achteraf verifiëren.

## Hoe deployen werkt

Push naar `main` → GitHub Actions SSH't naar EC2 → `git reset --hard origin/main`
→ `npm install` → build → `npm run db:migrate` → `pm2 restart jotihunt-backend`.
Zie [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

**Alles bouwt op de server.** Lokaal hoef je niets te installeren of te draaien om
te kunnen deployen — een commit op `main` is genoeg. Een clone met push-rechten
volstaat; zelfs het potloodje op github.com start dezelfde deploy.

Verifiëren na een deploy:

```bash
curl -s https://jotihunt-gog.nl/api/health          # moet {"status":"ok"} geven
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://jotihunt-gog.nl/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"x","password":"x"}'   # 401
```

Een paar seconden 502 tijdens de pm2-restart is normaal, geen storing.

## Serverbeheer

**Je kunt er zelf niet bij.** De gebruiker heeft alleen de EC2 Instance Connect
terminal in de browser. Geef serverwerk dus als commando's die hij plakt, en vraag
om de uitvoer terug. De app staat in `/var/www/jotihunt`.

Maak die commando's **idempotent**. Een `sed -i` die een regel toevoegt plakt er bij
elke herhaling nóg een bij — dat heeft nginx al een keer onderuit gehaald. Verwijder
eerst, voeg dan toe, en laat het resultaat teruglezen.

## Omgevingsvariabelen

`backend/.env` is gitignored en bestaat **alleen op de server**; de deploy maakt er
een kopie van en zet die terug rond de reset. Nooit committen.

Daaruit volgt: **code die een nieuwe env-variabele leest werkt pas als die regel met
de hand op de server staat.** Dat is al een keer stilletjes misgegaan met de
Firebase-sleutel — de code was er, de regel niet, en push viel terug op
"niet geconfigureerd" zonder foutmelding. Lees env altijd via `loadEnv`, nooit via
een `process.env`-lezing op moduleniveau: die draait vóór dotenv.

De Firebase service-account JSON is een secret. Die hoort alleen op de server, op
`/var/www/jotihunt/backend/firebase-service-account.json`, chmod 600.

## Commits

**Geen `Co-Authored-By: Claude` trailer.** De gebruiker committet als zichzelf
(Kaniken123). Dit gaat boven de standaard-attributie van de harness.

## Valkuilen die al een keer tijd hebben gekost

- **Regeleindes lopen door elkaar.** Sommige bestanden zijn CRLF, andere LF. Bepaal
  het per bestand vóór een `replace`, anders mist je anker stil.
- **nginx limiteert uploads.** `client_max_body_size` staat op 25M in
  `/etc/nginx/nginx.conf`. Zakt die terug naar de default van 1 MB, dan krijgen
  foto-uploads een 413 vóórdat Node ze ziet — dat ziet er in de app uit als een
  bug in het indienen.
- **`backend/` en `frontend/` hebben geen lockfile.** `npm install` lost vers op, dus
  twee machines kunnen verschillende versies trekken.
- **`backend/database/jotihunt.db.post-consolidate-bak` staat in git** (2,4 MB, 4
  accounts met bcrypt-hashes). De ignore-regel `*.db` dekt die extensie niet. Zou
  eruit moeten, na het weekend.
- **APK's bouwen gaat lokaal met Gradle**, niet met EAS: JDK 17 + `C:\Android\Sdk`,
  en de `node:sea`-patch in @expo/cli moet een `npm install` overleven. Zie
  [mobile/BUILD_APK_GUIDE.md](mobile/BUILD_APK_GUIDE.md). De versie op de site staat
  in `APK_VERSION` in [frontend/src/components/WelcomeModal.tsx](frontend/src/components/WelcomeModal.tsx)
  en is nu v29.

## Open punten

Dingen die de gebruiker zelf moet doen, niet in code op te lossen:

- Mensen toevoegen aan de kanalen Creatief / Foto's / Puzzels. Die zijn
  members-only; zolang er niemand in zit blijven ze leeg en stil.
- Per persoon `📍 Locatie volgen` aanzetten op het planningsbord. Zonder dat
  stuurt de telefoon niets en staat er geen stip op de kaart.
- De GPS-bug bij hoge snelheid is nooit getest; dat kan alleen tijdens het spel.

## Verdere documentatie

- [CURRENT_STATUS.md](CURRENT_STATUS.md) — levend overzicht van wat af is per fase.
- [DEPLOY_COMMANDS.md](DEPLOY_COMMANDS.md) — serververwijzingen die je steeds vergeet.
- [TECHNISCHE_DOCUMENTATIE.md](TECHNISCHE_DOCUMENTATIE.md) — architectuur.
- [MOBILE_TODO.md](MOBILE_TODO.md) — mobiele pariteit.
- `FOX_PREDICTION_PLAN.md` is **achterhaald**: de voorspelfunctie is in `110c83d`
  verwijderd omdat die de webkaart liet vastlopen. Niet terugbouwen zonder overleg.
