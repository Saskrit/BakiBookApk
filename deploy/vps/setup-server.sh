#!/usr/bin/env bash
# One-time provision for BakiBook API on Ubuntu 24.04 (Oracle Cloud)
set -euo pipefail

APP_DIR=/var/www/bakibook
SERVER_DIR="$APP_DIR/server"

echo "==> Installing Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

echo "==> Installing PM2"
sudo npm install -g pm2

echo "==> App directories"
sudo mkdir -p "$SERVER_DIR" "$APP_DIR/uploads"
sudo chown -R ubuntu:ubuntu "$APP_DIR"

echo "==> Installing Nginx + Certbot"
sudo apt-get install -y nginx certbot
if [[ -f "$HOME/nginx-bakibook-api-locations.conf" ]]; then
  sudo cp "$HOME/nginx-bakibook-api-locations.conf" /etc/nginx/snippets/bakibook-api-locations.conf
fi
if [[ -f "$HOME/nginx-bakibook-http.conf" ]]; then
  sudo cp "$HOME/nginx-bakibook-http.conf" /etc/nginx/sites-available/bakibook
  sudo ln -sfn /etc/nginx/sites-available/bakibook /etc/nginx/sites-enabled/bakibook
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> SSL (run after DNS points to this server)"
echo "    bash ~/setup-ssl.sh"

echo "==> Firewall (UFW) — keep SSH open"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

echo "==> Oracle often needs iptables ACCEPT for 80/443 as well"
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true

echo "==> PM2 startup on boot"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -n 1 | bash || true

echo ""
echo "Setup done."
echo "Next: upload server code + .env, then:"
echo "  cd $SERVER_DIR && npm ci --omit=dev"
echo "  pm2 start $HOME/ecosystem.config.cjs"
echo "  pm2 save"
node -v
npm -v
nginx -v 2>&1 | head -1
