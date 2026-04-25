#!/usr/bin/env bash

# PayChainKE Tailscale Bootstrapper for Render (Rootless)
# This script initializes Tailscale in userspace mode.

set -e

TAILSCALE_VERSION="1.64.0"
ARCH="amd64"
TS_DIR="/home/render/tailscale" # Or relative path if outside /home/render

# Fallback to current directory if not on Render home
if [ ! -d "/home/render" ]; then
  TS_DIR="$(pwd)/tailscale"
fi

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
  --statedir="$TS_DIR/state" &

# Wait for daemon to initialize
sleep 3

# Authenticate
if [ -n "$TS_AUTHKEY" ]; then
  echo "🔑 Authenticating with Tailscale..."
  "$TS_DIR/tailscale" up --authkey="$TS_AUTHKEY" --hostname="paychain-backend" ${TS_EXTRA_ARGS}
else
  echo "⚠️ TS_AUTHKEY not set. Local VPN access may fail."
fi

# Handoff to Node.js server
echo "✅ Tailscale ready. Starting application..."
exec "$@"
