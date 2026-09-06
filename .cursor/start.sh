#!/usr/bin/env bash
# Per-boot startup: bring up the Docker daemon and the local Supabase stack.
# Idempotent — safe to run repeatedly.
set -euo pipefail
cd "$(dirname "$0")/.."

# The Cloud Agent VM's legacy iptables FORWARD policy defaults to DROP, which
# silently blocks Docker bridge (container-to-container) traffic. Docker runs in
# nft mode, so flip the legacy policy to ACCEPT on every boot.
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true

echo "==> Ensuring Docker daemon is running"
if ! sudo docker info >/dev/null 2>&1; then
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
# Let the non-root user talk to the daemon.
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

echo "==> Ensuring local Supabase is running"
if ! supabase status >/dev/null 2>&1; then
  supabase start
fi

echo "==> start.sh complete"
supabase status || true
