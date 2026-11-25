#!/usr/bin/env bash
set -Eeuo pipefail
lock=/tmp/manaa-bootstrap/guest/runtime.lock
package="$(awk -F= '$1=="opencode_package" {print $2}' "$lock")"
version="$(awk -F= '$1=="opencode_version" {print $2}' "$lock")"
node_major="$(awk -F= '$1=="node_major" {print $2}' "$lock")"
node_version="$(awk -F= '$1=="node_version" {print $2}' "$lock")"
n_version="$(awk -F= '$1=="node_installer_n" {print $2}' "$lock")"
uv_version="$(awk -F= '$1=="uv" {print $2}' "$lock")"
[[ "$package" == '@opencode/cli' && "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'invalid OpenCode package/version pin' >&2; exit 2; }
[[ "$node_major" =~ ^[0-9]+$ && "$node_version" =~ ^${node_major}\.[0-9]+\.[0-9]+$ ]] || { echo 'invalid Node.js version pin' >&2; exit 2; }
[[ "$n_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'invalid Node installer pin' >&2; exit 2; }
[[ "$uv_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'invalid uv version pin' >&2; exit 2; }
if command -v opencode >/dev/null 2>&1; then
  actual="$(opencode --version | head -n1 | tr -cd '0-9.')"
  [[ "$actual" == "$version" ]] || { echo "installed OpenCode is $actual but pin is $version; refusing an online update through a detached runtime NIC" >&2; exit 1; }
else
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm
  npm install --global --no-audit --no-fund "n@${n_version}"
  n "$node_version"
  [[ "$(node --version | sed 's/^v//')" == "$node_version" ]] || { echo 'Node.js version pin mismatch' >&2; exit 1; }
  npm install --global --no-audit --no-fund "${package}@${version}"
fi
if [[ ! -x /opt/manaa/.venv/bin/uv ]]; then
  python3 -m venv /opt/manaa/.venv
  /opt/manaa/.venv/bin/pip install --disable-pip-version-check "uv==${uv_version}"
fi
cd /opt/manaa/engine
if [[ -e /opt/manaa/.venv/lib/python3.12/site-packages/httpx ]]; then
  /opt/manaa/.venv/bin/uv sync --extra transfer --frozen --offline
else
  /opt/manaa/.venv/bin/uv sync --extra transfer --frozen
fi
chown -R root:root /opt/manaa/.venv
chmod -R a-w /opt/manaa/.venv
install -d -o manaa -g manaa /home/manaa/.config/opencode
systemctl daemon-reload
