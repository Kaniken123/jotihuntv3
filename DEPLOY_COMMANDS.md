# Deploy / server quick reference

Commands I always forget. Stash, don't memorize.

## SSH into the EC2 box
```
ssh -i "C:\Users\xctia\.ssh\jotihunt-key.pem" ubuntu@13.61.66.181
```

App lives at `/var/www/jotihunt` on the server.

## Edit prod `.env` (e.g. flip ENABLE_AUTO_SYNC)
```
cd /var/www/jotihunt
nano backend/.env
```
Nano save+exit: `Ctrl+O`, `Enter`, then `Ctrl+X`. (Or just `Ctrl+X`, `Y`, `Enter`.)

After editing `.env` the backend must reload so it re-reads the file:
```
pm2 restart jotihunt-backend --update-env
```
Prod must have `ENABLE_AUTO_SYNC=true` (or the line absent — defaults to true).
Dev has it `false` so the 3-min sync doesn't clobber test state.

## Watch backend logs
```
pm2 logs jotihunt-backend --lines 100        # last 100 lines, then live tail
pm2 logs jotihunt-backend --err              # errors only
pm2 status                                   # is it running, restarts, memory
```

## Restart / stop / start
```
pm2 restart jotihunt-backend --update-env    # picks up .env changes
pm2 stop jotihunt-backend
pm2 start backend/dist/server.js --name jotihunt-backend
pm2 save                                     # persist process list across reboots
```

## DB backup / restore
```
# Backup before anything destructive
cp /var/www/jotihunt/backend/database/jotihunt.db /tmp/jotihunt_backup_$(date +%Y%m%d_%H%M).db

# Restore from a backup
cp /tmp/jotihunt_backup.db /var/www/jotihunt/backend/database/jotihunt.db
pm2 restart jotihunt-backend
```
The GitHub Action also backs up to `/tmp/jotihunt_backup.db` on every deploy.

## Run a migration / consolidation script manually
```
cd /var/www/jotihunt/backend
npm run db:migrate                            # apply any pending migrations
npx ts-node scripts/consolidate-to-tenant-1.ts # one-time tenant cleanup
npx ts-node scripts/simulate-prediction.ts    # dry-run the predictor
```

## Quick DB checks
```
sqlite3 /var/www/jotihunt/backend/database/jotihunt.db
# inside sqlite3:
.tables
.schema hunts
SELECT id, name, is_active FROM tenants;
SELECT tenant_id, COUNT(*) FROM areas GROUP BY tenant_id;
.quit
```

## Deploy a new version
Pushing to `main` on GitHub triggers the **Deploy to EC2** Action automatically.
Watch progress at: GitHub repo → Actions tab.
No SSH needed for a normal deploy — the Action handles backup, fetch,
`npm install`, `npm run build`, `npm run db:migrate`, and `pm2 restart`.

## Useful one-liners
```
# Disk / memory
df -h
free -m

# Find process listening on a port
sudo lsof -i :3001

# Nginx
sudo systemctl status nginx
sudo nginx -t                # test config
sudo systemctl reload nginx  # apply config after edit
sudo tail -f /var/log/nginx/error.log
```

---

*Consider adding this file to `.gitignore` if you don't want the EC2 IP /
key path in the public repo. It contains no secrets — the `.pem` itself
isn't tracked — but the IP is an attack surface.*
