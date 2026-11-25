#!/usr/bin/env bash
set -Eeuo pipefail
layer="${1:-}" action="${2:-}" run_id="${3:-controlled-example-001}"
[[ "$layer" == osint || "$layer" == police ]] || { echo 'usage: manaa-guest-runner osint|police run' >&2; exit 2; }
[[ "$action" == run ]] || { echo 'only the fixed run action is permitted' >&2; exit 2; }
[[ "$run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$ ]] || { echo 'invalid run id' >&2; exit 2; }
[[ ! -f "/etc/manaa/${layer}.env" ]] || source "/etc/manaa/${layer}.env"
[[ ! -f /etc/manaa/secrets.env ]] || source /etc/manaa/secrets.env
mkdir -p /var/lib/manaa/runs
case "$layer" in
  osint)
    # Only the synthetic controlled case is collected; no live source requests.
    out="/var/lib/manaa/runs/${run_id}.json"
    envelope="/var/lib/manaa/runs/${run_id}-envelope.json"
    /opt/manaa/.venv/bin/python /opt/manaa/engine/tools/controlled_case.py \
      --run-id "$run_id" --parent-run-id fixture-parent-001 --output "$out" --envelope "$envelope"
    curl --fail --silent --show-error --max-time 10 -H 'Content-Type: application/json' \
      --data-binary "@$envelope" "${MANAA_WRITER_URL:-http://10.77.10.1:8081}/v1/findings"
    ;;
  police)
    exec /opt/manaa/.venv/bin/python /usr/local/bin/manaa-police-review "$run_id"
    ;;
esac
