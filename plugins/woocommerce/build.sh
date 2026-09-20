#!/usr/bin/env bash
# Builds the installable WordPress plugin zip and copies it where the developer
# portal serves it from (apps/docs/public/downloads).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist && mkdir -p dist
zip -rq dist/paychain-for-woocommerce.zip paychain-for-woocommerce -x '*.DS_Store'

mkdir -p ../../apps/docs/public/downloads
cp dist/paychain-for-woocommerce.zip ../../apps/docs/public/downloads/paychain-for-woocommerce.zip
echo "Built dist/paychain-for-woocommerce.zip and copied it to apps/docs/public/downloads/"
