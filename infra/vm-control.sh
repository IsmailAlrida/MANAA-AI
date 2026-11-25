#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/provider-common.sh"

usage() { echo "Usage: infra/vm-control.sh status|networks|model-preflight|stop|logs [--provider libvirt|virtualbox] [--layer osint|police|all]" >&2; }
ACTION="${1:-}"; shift || true
PROVIDER="${MANAA_VM_PROVIDER:-}"; LAYER=all
while (($#)); do
  case "$1" in
    --provider) (($# >= 2)) || { usage; exit 2; }; PROVIDER="$2"; shift 2;;
    --layer) (($# >= 2)) || { usage; exit 2; }; LAYER="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) usage; die "unknown option: $1";;
  esac
done
[[ "$ACTION" == status || "$ACTION" == networks || "$ACTION" == model-preflight || "$ACTION" == stop || "$ACTION" == logs ]] || { usage; exit 2; }
if [[ -z "$PROVIDER" && -s "$VM_ROOT/provider" ]]; then PROVIDER="$(cat "$VM_ROOT/provider")"; fi
[[ "$PROVIDER" == libvirt || "$PROVIDER" == virtualbox ]] || die 'pass --provider libvirt|virtualbox or set MANAA_VM_PROVIDER'
[[ "$LAYER" == all || "$LAYER" == osint || "$LAYER" == police ]] || die 'layer must be osint, police, or all'
source "$INFRA_DIR/providers/$PROVIDER.sh"
provider_require

layers=(osint police); [[ "$LAYER" == all ]] || layers=("$LAYER")
case "$ACTION" in
  networks)
    provider_networks
    printf 'public bridge: %s/24 host=%s osint=%s writer=http://%s:8081/v1/findings\n' "$OSINT_BRIDGE" "$OSINT_HOST_IP" "$OSINT_IP" "$OSINT_HOST_IP"
    printf 'police bridge: %s/24 host=%s police=%s reader=http://%s:8082 results=http://%s:8083/v1/results\n' \
      "$POLICE_BRIDGE" "$POLICE_HOST_IP" "$POLICE_IP" "$POLICE_HOST_IP" "$POLICE_HOST_IP"
    printf 'OpenCode endpoints: osint=http://%s:4096 police=http://%s:4096\n' "$OSINT_IP" "$POLICE_IP"
    ;;
  model-preflight)
    [[ "$LAYER" == osint || "$LAYER" == police ]] || die 'model-preflight requires --layer osint|police'
    "$INFRA_DIR/model-preflight.sh" "$LAYER"
    ;;
  status)
    provider_status
    if command -v curl >/dev/null 2>&1; then
      for endpoint in "http://${OSINT_HOST_IP}:8081/healthz" "http://${POLICE_HOST_IP}:8082/healthz" "http://${POLICE_HOST_IP}:8083/healthz"; do
        code="$(curl --silent --show-error --max-time 1 -o /dev/null -w '%{http_code}' "$endpoint" 2>/dev/null || true)"
        [[ "$code" == 200 ]] && state=ready || state=not-ready
        printf 'listener %s: %s\n' "$endpoint" "$state"
      done
    fi
    ;;
  stop)
    for layer in "${layers[@]}"; do provider_stop "$layer"; done
    ;;
  logs)
    [[ "$LAYER" == osint || "$LAYER" == police ]] || die 'logs requires --layer osint|police'
    provider_logs "$LAYER"
    ;;
esac
