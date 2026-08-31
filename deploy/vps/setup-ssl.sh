#!/usr/bin/env bash
# Issue / renew Let's Encrypt cert for bakibook.run.place + api.bakibook.run.place
set -euo pipefail

PRIMARY_DOMAIN=bakibook.run.place
WWW_DOMAIN=www.bakibook.run.place
API_DOMAIN=api.bakibook.run.place
ENV_FILE=/var/www/bakibook/server/.env
CERT_DIR="/etc/letsencrypt/live/$PRIMARY_DOMAIN"

echo "==> Installing certbot (if needed)"
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y certbot
fi

echo "==> ACME webroot"
sudo mkdir -p /var/www/certbot

echo "==> Nginx snippets"
if [[ -f "$HOME/nginx-bakibook-api-locations.conf" ]]; then
  sudo cp "$HOME/nginx-bakibook-api-locations.conf" /etc/nginx/snippets/bakibook-api-locations.conf
fi
if [[ -f "$HOME/nginx-bakibook-frontend-locations.conf" ]]; then
  sudo cp "$HOME/nginx-bakibook-frontend-locations.conf" /etc/nginx/snippets/bakibook-frontend-locations.conf
fi

CERT_EMAIL=""
if [[ -f "$ENV_FILE" ]]; then
  CERT_EMAIL=$(grep -E '^EMAIL_USER=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r"' | tr -d "'")
fi
if [[ -z "$CERT_EMAIL" ]]; then
  echo "ERROR: set EMAIL_USER in $ENV_FILE (used as Let's Encrypt contact email)"
  exit 1
fi

if [[ ! -f "$CERT_DIR/fullchain.pem" ]]; then
  echo "==> Bootstrap HTTP nginx for ACME challenge"
  if [[ -f "$HOME/nginx-bakibook-http.conf" ]]; then
    sudo cp "$HOME/nginx-bakibook-http.conf" /etc/nginx/sites-available/bakibook
    sudo ln -sfn /etc/nginx/sites-available/bakibook /etc/nginx/sites-enabled/bakibook
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx
  fi
  echo "==> Requesting certificate for $PRIMARY_DOMAIN, $WWW_DOMAIN, and $API_DOMAIN"
else
  echo "==> Expanding certificate to include $WWW_DOMAIN / $API_DOMAIN (if needed)"
fi

sudo certbot certonly --webroot -w /var/www/certbot \
  -d "$PRIMARY_DOMAIN" \
  -d "$WWW_DOMAIN" \
  -d "$API_DOMAIN" \
  --expand \
  --non-interactive --agree-tos -m "$CERT_EMAIL" \
  --preferred-challenges http

echo "==> Installing HTTPS nginx config"
if [[ -f "$HOME/nginx-bakibook.conf" ]]; then
  sudo cp "$HOME/nginx-bakibook.conf" /etc/nginx/sites-available/bakibook
  sudo ln -sfn /etc/nginx/sites-available/bakibook /etc/nginx/sites-enabled/bakibook
fi

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Frontend: https://$PRIMARY_DOMAIN"
echo "API:      https://$API_DOMAIN/api/health"
echo "Renewal:  sudo certbot renew --dry-run"
