#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/provider-common.sh"

usage() { echo "Usage: infra/provision.sh --provider libvirt|virtualbox [--layer osint|police|all]" >&2; }
PROVIDER="${MANAA_VM_PROVIDER:-}"
LAYER=all
while (($#)); do
  case "$1" in
    --provider) (($# >= 2)) || { usage; exit 2; }; PROVIDER="$2"; shift 2;;
    --layer) (($# >= 2)) || { usage; exit 2; }; LAYER="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) usage; die "unknown option: $1";;
  esac
done
[[ "$PROVIDER" == libvirt || "$PROVIDER" == virtualbox ]] || die "--provider libvirt|virtualbox is required"
[[ "$LAYER" == all || "$LAYER" == osint || "$LAYER" == police ]] || die "--layer must be osint, police, or all"

# A caller can only hand these fixed words to a guest; no shell strings or
# operator-provided commands cross the SSH boundary.
layers=(osint police)
[[ "$LAYER" == all ]] || layers=("$LAYER")
source "$INFRA_DIR/providers/$PROVIDER.sh"
provider_require
init_ssh
mkdir -p "$VM_ROOT"
provider_networks
cleanup_install_nics() {
  for cleanup_layer in osint police; do provider_detach_install_network "$cleanup_layer" >/dev/null 2>&1 || true; done
}
trap cleanup_install_nics EXIT
for layer in "${layers[@]}"; do
  provider_create_vm "$layer" 0
done
for layer in "${layers[@]}"; do
  provider_start_vm "$layer"
  install_guest_payload "$layer"
  provider_detach_install_network "$layer"
  # The private policy is active and the installer NIC is gone before the
  # OpenCode server process is started or restarted.
  guest_ssh "$layer" 'sudo systemctl restart manaa-opencode.service'
  guest_ssh "$layer" 'systemctl is-active --quiet manaa-opencode.service' || die "$layer OpenCode service did not become ready"
  printf 'Provisioned %s (%s) with internet detached and checksum-verified base image.\n' "$layer" "$PROVIDER"
done

# Persist provider choice for vm-control only. Avoid system-global mutation.
printf '%s\n' "$PROVIDER" >"$VM_ROOT/provider"
chmod 600 "$VM_ROOT/provider"
echo "Requested VM layer(s) are provisioned, private network policy is active, and OpenCode services are ready."
