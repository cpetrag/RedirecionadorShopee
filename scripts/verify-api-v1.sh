#!/usr/bin/env bash
set -euo pipefail
cd /var/www/RedirecionadorShopee

KEY="$(grep '^REDIRECT_API_KEY=' .env.local | sed 's/^REDIRECT_API_KEY=//' | tr -d '\r')"
echo "key_length=${#KEY}"

pm2 restart redirect-shopee --update-env
sleep 4

echo "=== local POST ==="
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://127.0.0.1:5222/api/v1/redirects" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/landing-teste-api"}'

echo "=== public POST ==="
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "https://redirect.clubepromos.com.br/api/v1/redirects" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/landing-teste-api"}'

echo "=== no auth (expect 401) ==="
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "https://redirect.clubepromos.com.br/api/v1/redirects" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
