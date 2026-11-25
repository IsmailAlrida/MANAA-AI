#!/usr/bin/env bash
set -Eeuo pipefail
# Runs after pinned OpenCode/Python packages install, while temporary NAT exists.
test -s /etc/nftables.conf || { echo 'nftables policy is missing' >&2; exit 1; }
nft -c -f /etc/nftables.conf
systemctl enable --now nftables.service
systemctl is-active --quiet nftables.service
