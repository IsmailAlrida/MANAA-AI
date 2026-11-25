#!/usr/bin/env bash
# Host-to-guest RPC with a tiny fixed command surface. No caller command string
# is forwarded. The only variable payload is a validated idempotent run ID.
set -Eeuo pipefail
source "$(dirname -- "$0")/provider-common.sh"
usage() { echo 'Usage: infra/guest-exec.sh [--provider libvirt|virtualbox] osint|police run [RUN_ID]' >&2; }
PROVIDER="${MANAA_VM_PROVIDER:-}"
while (($#)) && [[ "$1" == --provider ]]; do
  (($# >= 2)) || { usage; exit 2; }; PROVIDER="$2"; shift 2
done
(($# >= 2 && $# <= 3)) || { usage; exit 2; }
layer="$1" action="$2" run_id="${3:-controlled-example-001}"
valid_layer "$layer" || { usage; die 'invalid layer'; }
[[ "$action" == run ]] || { usage; die 'only the fixed run action is allowed'; }
[[ "$run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$ ]] || die 'run ID must be 1-96 letters, digits, dots, underscores, or hyphens'
if [[ -z "$PROVIDER" && -s "$VM_ROOT/provider" ]]; then PROVIDER="$(cat "$VM_ROOT/provider")"; fi
[[ "$PROVIDER" == libvirt || "$PROVIDER" == virtualbox ]] || die 'pass --provider or set MANAA_VM_PROVIDER'
source "$INFRA_DIR/providers/$PROVIDER.sh"
provider_require
guest_ssh "$layer" "/usr/local/bin/manaa-guest-runner $layer run $run_id"
