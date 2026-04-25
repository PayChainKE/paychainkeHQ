#!/usr/bin/env bash

# PayChainKE Tailscale Bootstrapper for Render (Rootless)
# This script initializes Tailscale in userspace mode.

set -e

TAILSCALE_VERSION="1.64.0"
ARCH="amd64"
TS_DIR="$(pwd)/tailscale"

mkdir -p "$TS_DIR/state"

# Download Tailscale if not present
if [ ! -f "$TS_DIR/tailscaled" ]; then
  echo "📥 Downloading Tailscale v${TAILSCALE_VERSION}..."
  curl -sLO "https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz"
  tar xzf "tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz" --strip-components=1 -C "$TS_DIR"
  rm "tailscale_${TAILSCALE_VERSION}_${ARCH}.tgz"
fi

# Starting Tailscale Daemon in Background (Userspace mode)
echo "🚀 Starting Tailscale daemon..."
"$TS_DIR/tailscaled" \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --statedir="$TS_DIR/state" > "$TS_DIR/tailscaled.log" 2>&1 &

# Wait for daemon to initialize
sleep 5

# Authenticate
if [ -n "$TS_AUTHKEY" ]; then
  echo "🔑 Authenticating with Tailscale..."
  # Use set -x for this command to see exact expansion
  (set -x; "$TS_DIR/tailscale" up --auth-key="$TS_AUTHKEY" --hostname="paychain-backend" --accept-dns=false --reset)
else
  echo "⚠️ TS_AUTHKEY not set. Local VPN access may fail."
fi

# Check for tailscale error
if [ $? -ne 0 ]; then
  echo "❌ Tailscale auth failed. Daemon logs:"
  cat "$TS_DIR/tailscaled.log"
  exit 1
fi

# Handoff to Node.js server
echo "✅ Tailscale ready. Starting application..."
exec "$@"
