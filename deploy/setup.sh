#!/bin/bash
# One-time EC2 Ubuntu server setup script for jotihunt-gog.nl
# Run as: bash setup.sh
set -e

REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
APP_DIR="/var/www/jotihunt"
DOMAIN="jotihunt-gog.nl"

echo "=== Installing system packages ==="
sudo apt-get update -y
sudo apt-get install -y git nginx certbot python3-certbot-nginx

echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Cloning repository ==="
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"

echo "=== Installing backend dependencies and building ==="
cd "$APP_DIR/backend"
npm ci
npm run build
cd "$APP_DIR/backend"
npm run db:migrate

echo "=== Creating backend .env ==="
cat > "$APP_DIR/backend/.env" <<EOF
NODE_ENV=production
PORT=3001
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
FRONTEND_URL=https://$DOMAIN
ENABLE_AUTO_SYNC=true
EOF
echo ">>> Edit $APP_DIR/backend/.env and set JWT_SECRET before starting the app!"

echo "=== Installing frontend dependencies and building ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== Configuring Nginx ==="
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/jotihunt
sudo ln -sf /etc/nginx/sites-available/jotihunt /etc/nginx/sites-enabled/jotihunt
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "=== Obtaining SSL certificate via Let's Encrypt ==="
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"
sudo systemctl reload nginx

echo "=== Starting backend with PM2 ==="
cp "$APP_DIR/deploy/ecosystem.config.js" "$APP_DIR/ecosystem.config.js"
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save

echo "=== Configuring PM2 to start on reboot ==="
pm2 startup | tail -n 1 | sudo bash

echo ""
echo "=== Setup complete! ==="
echo "App running at: https://$DOMAIN"
echo "Backend health: https://$DOMAIN/api/health"
echo ""
echo "Useful commands:"
echo "  pm2 status              - check backend process"
echo "  pm2 logs jotihunt-backend - view backend logs"
echo "  sudo nginx -t           - test nginx config"
echo "  sudo systemctl reload nginx"
