#!/usr/bin/env bash

# PayChainKE Tailscale Bootstrapper for Render (Rootless)
# Security Hardened & Race Condition Fixed

set -e

# Configuration
TAILSCALE_VERSION="1.64.0"
ARCH="amd64"
TS_DIR="$(pwd)/tailscale"
export PATH="$TS_DIR:$PATH"

mkdir -p "$TS_DIR/state"

# 1. Download Tailscale if not present
if [ ! -f "$TS_DIR/tailscaled" ]; then
  echo "📥 Downloading Tailscale v${TAILSCALE_VERSION}..."
  curl -sLO "https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz"
  tar xzf "tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz" --strip-components=1 -C "$TS_DIR"
  rm "tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz"
fi

# 2. Starting Tailscale Daemon in Background
echo "🚀 Starting Tailscale daemon..."
"$TS_DIR/tailscaled" \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --socket="$TS_DIR/tailscaled.sock" \
  --statedir="$TS_DIR/state" > "$TS_DIR/tailscaled.log" 2>&1 &

# 3. Wait for Daemon Initialization (Retry Loop)
echo "⏳ Waiting for Tailscaled to be ready..."
MAX_RETRIES=15
RETRY_COUNT=0
# check if the socket file exists as a proxy for readiness
until [ -S "$TS_DIR/tailscaled.sock" ] || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Error: Tailscaled failed to initialize within 15 seconds."
  echo "--- Tailscaled Logs ---"
  cat "$TS_DIR/tailscaled.log"
  exit 1
fi

# 4. Authenticate (Sanitized Logs)
if [ -n "$TS_AUTHKEY" ]; then
  echo "🔑 Authenticating with Tailscale..."
  # Explicitly disable command echoing to protect the key
  set +x
  "$TS_DIR/tailscale" --socket="$TS_DIR/tailscaled.sock" up \
    --auth-key="${TS_AUTHKEY}" \
    --hostname="paychain-backend" \
    --accept-dns=false \
    --reset > /dev/null 2>&1
  AUTH_STATUS=$?
  set -x
  
  if [ $AUTH_STATUS -ne 0 ]; then
    echo "❌ Tailscale authentication failed."
    exit 1
  fi
else
  echo "⚠️ TS_AUTHKEY not set. VPN access may be restricted."
fi

# 5. Handoff to Node.js server
echo "✅ Tailscale ready. Starting PayChainKE application..."
# exec replaces the shell with the node process, ensuring signals (like SIGTERM) are handled correctly.
exec "$@"
