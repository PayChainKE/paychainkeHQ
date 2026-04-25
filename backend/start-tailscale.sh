#!/usr/bin/env bash

# PayChainKE Tailscale Bootstrapper for Render (Rootless)
# Security Hardened & Race Condition Fixed

set -e

# Configuration
TAILSCALE_VERSION="1.64.0"
ARCH="amd64"
TS_DIR="$(pwd)/tailscale"

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
# Using userspace-networking is required for Render's rootless containers
"$TS_DIR/tailscaled" \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --statedir="$TS_DIR/state" > /dev/null 2>&1 &

# 3. Wait for Daemon Initialization (Retry Loop)
echo "⏳ Waiting for Tailscaled to be ready..."
MAX_RETRIES=12
RETRY_COUNT=0
# Loop until 'tailscale status' returns a successful exit code
until "$TS_DIR/tailscale" status >/dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Error: Tailscaled failed to initialize within 12 seconds."
  exit 1
fi

# 4. Authenticate (Sanitized Logs)
if [ -n "$TS_AUTHKEY" ]; then
  echo "🔑 Authenticating with Tailscale..."
  # Protect the key from logs by disabling tracing and redirecting output
  set +x
  "$TS_DIR/tailscale" up \
    --authkey="${TS_AUTHKEY}" \
    --hostname="paychain-backend" \
    --accept-dns=false \
    --reset > /dev/null 2>&1
  
  AUTH_STATUS=$?
  
  if [ $AUTH_STATUS -ne 0 ]; then
    echo "❌ Tailscale authentication failed (Status: $AUTH_STATUS)."
    exit 1
  fi
else
  echo "⚠️ TS_AUTHKEY not set. VPN access may be restricted."
fi

# 5. Handoff to Node.js server
echo "✅ Tailscale ready. Starting PayChainKE application..."
# exec replaces the shell with the node process, ensuring signals (like SIGTERM) are handled correctly.
exec "$@"
