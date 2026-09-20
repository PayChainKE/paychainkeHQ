#!/usr/bin/env bash
# Builds the downloadable zip and copies it where the developer portal serves it from.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist && mkdir -p dist
zip -rq dist/paychain-shopify.zip paychain-shopify -x '*.DS_Store' 'paychain-shopify/node_modules/*' 'paychain-shopify/.env'

mkdir -p ../../apps/docs/public/downloads
cp dist/paychain-shopify.zip ../../apps/docs/public/downloads/paychain-shopify.zip
echo "Built dist/paychain-shopify.zip and copied it to apps/docs/public/downloads/"
