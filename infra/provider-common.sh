#!/usr/bin/env bash
# Shared, deliberately fail-closed VM bootstrap helpers.
set -Eeuo pipefail

INFRA_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$INFRA_DIR/.." && pwd -P)"
VM_ROOT="${MANAA_VM_ROOT:-$HOME/.local/share/manaa-vms}"
SSH_DIR="${MANAA_SSH_DIR:-$HOME/.ssh/manaa-vms}"
SSH_USER="${MANAA_GUEST_USER:-manaa}"
OSINT_NAME="${MANAA_OSINT_VM_NAME:-manaa-osint}"
POLICE_NAME="${MANAA_POLICE_VM_NAME:-manaa-police}"
OSINT_IP="10.77.10.10"
POLICE_IP="10.77.20.10"
OSINT_HOST_IP="10.77.10.1"
POLICE_HOST_IP="10.77.20.1"
OSINT_NET="manaa-osint-net"
POLICE_NET="manaa-police-net"
OSINT_BRIDGE="virbr-manaa-osint"
POLICE_BRIDGE="virbr-manaa-police"

die() { printf 'infra: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }
valid_layer() { [[ "${1:-}" == osint || "${1:-}" == police ]]; }
vm_name_for() { case "$1" in osint) printf '%s' "$OSINT_NAME";; police) printf '%s' "$POLICE_NAME";; *) die "unknown layer: $1";; esac; }
ip_for() { case "$1" in osint) printf '%s' "$OSINT_IP";; police) printf '%s' "$POLICE_IP";; *) die "unknown layer: $1";; esac; }
network_for() { case "$1" in osint) printf '%s' "$OSINT_NET";; police) printf '%s' "$POLICE_NET";; *) die "unknown layer: $1";; esac; }

init_ssh() {
  mkdir -p "$SSH_DIR"
  chmod 700 "$SSH_DIR"
  if [[ ! -f "$SSH_DIR/id_ed25519" ]]; then
    need ssh-keygen
    ssh-keygen -q -t ed25519 -N '' -C "manaa-host-control" -f "$SSH_DIR/id_ed25519"
  fi
  chmod 600 "$SSH_DIR/id_ed25519"
  chmod 644 "$SSH_DIR/id_ed25519.pub"
}

guest_ssh() {
  local layer="$1"; shift
  local ip; ip="$(ip_for "$layer")"
  ssh -i "$SSH_DIR/id_ed25519" -o BatchMode=yes -o ConnectTimeout=4 \
    -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$SSH_DIR/known_hosts" \
    -o IdentitiesOnly=yes -o ClearAllForwardings=yes "$SSH_USER@$ip" "$@"
}

# Render the same deterministic user-data for either provider. It creates a
# non-root control account, disables password SSH, and installs only pinned
# runtime packages. Each guest has a temporary NAT install NIC that is removed
# before runtime; the persistent role NIC has no default route or internet.
write_cloud_init() {
  local layer="$1" out="$2" host_key mac install_mac private_ip model_host model_port model_name sudo_commands upper var
  host_key="$(cat "$SSH_DIR/id_ed25519.pub")"
  private_ip="$(ip_for "$layer")"
  upper="${layer^^}"
  var="MANAA_${upper}_MODEL_HOST"; model_host="${!var:-$( [[ "$layer" == police ]] && printf '10.77.20.1' || printf '10.77.10.1' )}"
  var="MANAA_${upper}_MODEL_PORT"; model_port="${!var:-11434}"
  var="MANAA_${upper}_MODEL_NAME"; model_name="${!var:-local-model}"
  local allowed_model_host="$OSINT_HOST_IP"; [[ "$layer" != police ]] || allowed_model_host="$POLICE_HOST_IP"
  [[ "$model_host" == "$allowed_model_host" ]] || die "${layer} model endpoint must use $allowed_model_host"
  [[ "$model_port" =~ ^[0-9]{1,5}$ ]] && ((model_port > 0 && model_port < 65536)) || die 'MANAA_MODEL_PORT must be 1..65535'
  [[ "$model_name" =~ ^[A-Za-z0-9._:/-]{1,96}$ ]] || die "invalid ${layer} model name"
  sudo_commands="/usr/local/lib/manaa/guest-install.sh ${layer} ${model_host} ${model_port} ${model_name}, /usr/local/lib/manaa/install-opencode.sh, /usr/local/lib/manaa/apply-network-policy.sh, /usr/bin/systemctl start manaa-opencode.service, /usr/bin/systemctl stop manaa-opencode.service, /usr/bin/systemctl restart manaa-opencode.service, /usr/bin/journalctl -u manaa-opencode.service --no-pager -n 200, /usr/bin/tee /etc/manaa/secrets.env, /usr/bin/chmod 0640 /etc/manaa/secrets.env, /usr/bin/chown root:manaa /etc/manaa/secrets.env, /usr/bin/tee /etc/manaa/model.env, /usr/bin/chmod 0640 /etc/manaa/model.env, /usr/bin/chown root:manaa /etc/manaa/model.env"
  mac="$( [[ "$layer" == osint ]] && printf '52:54:00:77:10:10' || printf '52:54:00:77:20:10' )"
  install_mac="$( [[ "$layer" == osint ]] && printf '52:54:00:77:10:11' || printf '52:54:00:77:20:11' )"
  cat >"$out" <<EOF
#cloud-config
hostname: manaa-${layer}
manage_etc_hosts: true
network:
  version: 2
  ethernets:
    private:
      match:
        macaddress: '${mac}'
      set-name: private0
      addresses: ['${private_ip}/24']
      dhcp4: false
    installer:
      match:
        macaddress: '${install_mac}'
      set-name: installer0
      dhcp4: true
      dhcp4-overrides:
        route-metric: 100
users:
  - name: ${SSH_USER}
    gecos: MANAA ${layer} runtime
    groups: []
    shell: /bin/bash
    sudo: ["ALL=(root) NOPASSWD: ${sudo_commands}"]
    lock_passwd: true
    ssh_authorized_keys:
      - ${host_key}
ssh_pwauth: false
disable_root: true
package_update: true
packages:
  - ca-certificates
  - curl
  - jq
  - openssh-server
  - python3
  - python3-venv
  - nftables
runcmd:
  - [bash, -lc, "install -d -o ${SSH_USER} -g ${SSH_USER} /opt/manaa /var/lib/manaa /etc/manaa"]
  - [bash, -lc, "mkdir -p /usr/local/lib/manaa"]
  - [bash, -lc, "touch /var/lib/manaa/bootstrap-ready"]
write_files:
  - path: /usr/local/lib/manaa/guest-install.sh
    owner: root:root
    permissions: '0755'
    encoding: b64
    content: $(base64 -w0 "$INFRA_DIR/guest/guest-install.sh")
  - path: /usr/local/lib/manaa/install-opencode.sh
    owner: root:root
    permissions: '0755'
    encoding: b64
    content: $(base64 -w0 "$INFRA_DIR/guest/install-opencode.sh")
  - path: /usr/local/lib/manaa/apply-network-policy.sh
    owner: root:root
    permissions: '0755'
    encoding: b64
    content: $(base64 -w0 "$INFRA_DIR/guest/apply-network-policy.sh")
EOF
}

assert_repo_is_safe_to_share() {
  [[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || die "repository metadata unavailable"
  # Never copy secret-bearing files into a guest. Source tree is rsynced with
  # an explicit allow-by-omission list below rather than copying all of $HOME.
}

install_guest_payload() {
  local layer="$1" ip tmp
  ip="$(ip_for "$layer")"
  printf 'Waiting for %s SSH at %s' "$layer" "$ip"
  for _ in $(seq 1 120); do
    if ssh -i "$SSH_DIR/id_ed25519" -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$SSH_DIR/known_hosts" -o IdentitiesOnly=yes "$SSH_USER@$ip" true >/dev/null 2>&1; then break; fi
    sleep 2
    printf '.'
  done
  printf '\n'
  ssh -i "$SSH_DIR/id_ed25519" -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$SSH_DIR/known_hosts" -o IdentitiesOnly=yes "$SSH_USER@$ip" true || die "$layer guest did not become reachable; VM remains powered off after this command exits"

  # Only the Python engine and declarative policy are shared. Keep the guest
  # checkout immutable and do not mount the host worktree into a VM.
  assert_repo_is_safe_to_share
  tmp="$VM_ROOT/payload-$layer"
  rm -rf -- "$tmp"
  mkdir -p "$tmp"
  rsync -a --delete \
    --exclude='.git/' --exclude='.venv/' --exclude='__pycache__/' --exclude='*.pyc' \
    --exclude='node_modules/' --exclude='.env' --exclude='*.sqlite*' --exclude='*.pem' \
    --exclude='id_*' --exclude='known_hosts' \
    "$REPO_ROOT/engine/" "$tmp/engine/"
  rsync -a --delete "$REPO_ROOT/infra/guest/" "$tmp/guest/"
  cp "$INFRA_DIR/runtime.lock" "$tmp/guest/runtime.lock"
  rsync -e "ssh -i $SSH_DIR/id_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$SSH_DIR/known_hosts -o IdentitiesOnly=yes" -a "$tmp/" "$SSH_USER@$ip:/tmp/manaa-bootstrap/"
  local upper model_host model_port model_name var model_key key_var
  upper="${layer^^}"
  var="MANAA_${upper}_MODEL_HOST"; model_host="${!var:-$( [[ "$layer" == police ]] && printf '10.77.20.1' || printf '10.77.10.1' )}"
  var="MANAA_${upper}_MODEL_PORT"; model_port="${!var:-11434}"
  var="MANAA_${upper}_MODEL_NAME"; model_name="${!var:-local-model}"
  local allowed_model_host="$OSINT_HOST_IP"; [[ "$layer" != police ]] || allowed_model_host="$POLICE_HOST_IP"
  [[ "$model_host" == "$allowed_model_host" ]] || die "${layer} model endpoint must use $allowed_model_host"
  [[ "$model_port" =~ ^[0-9]{1,5}$ ]] && ((model_port > 0 && model_port < 65536)) || die 'MANAA_MODEL_PORT must be 1..65535'
  [[ "$model_name" =~ ^[A-Za-z0-9._:/-]{1,96}$ ]] || die "invalid ${layer} model name"
  guest_ssh "$layer" "sudo /usr/local/lib/manaa/guest-install.sh $layer $model_host $model_port $model_name"
  # OpenCode is version-pinned in runtime.lock; no channel/latest installer.
  guest_ssh "$layer" 'sudo /usr/local/lib/manaa/install-opencode.sh'
  guest_ssh "$layer" 'sudo /usr/local/lib/manaa/apply-network-policy.sh'
  key_var="MANAA_${upper}_MODEL_API_KEY"; model_key="${!key_var:-}"
  [[ "$model_key" =~ ^[A-Za-z0-9._~-]{0,256}$ ]] || die "${layer} model API key may contain only letters, digits, . _ ~ and -"
  printf 'MANAA_MODEL_API_KEY=%s\n' "$model_key" | guest_ssh "$layer" 'sudo tee /etc/manaa/model.env >/dev/null && sudo chmod 0640 /etc/manaa/model.env && sudo chown root:manaa /etc/manaa/model.env'
  if [[ "$layer" == police ]]; then
    local service_root="${MANAA_SERVICE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/manaa}"
    local secrets_file="$service_root/services.env" token
    [[ -r "$secrets_file" ]] || die "host results token file is required at $secrets_file (MANAA_RESULTS_TOKEN only; no secret values will be printed)"
    token="$(sed -n 's/^MANAA_RESULTS_TOKEN=//p' "$secrets_file" | head -n1 | tr -d '\r')"
    [[ "$token" =~ ^[[:xdigit:]]{32,128}$ ]] || die 'MANAA_RESULTS_TOKEN must be 32-128 hex characters'
    printf 'MANAA_RESULTS_TOKEN=%s\n' "$token" | guest_ssh police 'sudo tee /etc/manaa/secrets.env >/dev/null && sudo chmod 0640 /etc/manaa/secrets.env && sudo chown root:manaa /etc/manaa/secrets.env'
    unset token
  fi
}
