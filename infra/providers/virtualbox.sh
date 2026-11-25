#!/usr/bin/env bash
set -Eeuo pipefail
source "$INFRA_DIR/provider-common.sh"

UBUNTU_RELEASE="${MANAA_UBUNTU_RELEASE:-20241119}"
IMAGE_FILE="ubuntu-24.04-server-cloudimg-amd64.vmdk"
IMAGE_BASE="https://cloud-images.ubuntu.com/releases/24.04/release-${UBUNTU_RELEASE}"

provider_require() { need VBoxManage; need cloud-localds; need curl; need sha256sum; need rsync; need ssh; }
fetch_base_image() {
  local image="$VM_ROOT/$IMAGE_FILE" sums="$VM_ROOT/SHA256SUMS" expected actual
  if [[ ! -s "$image" ]]; then
    curl --fail --location --proto '=https' --tlsv1.2 "$IMAGE_BASE/$IMAGE_FILE" -o "$image.part"
    mv "$image.part" "$image"
  fi
  curl --fail --location --proto '=https' --tlsv1.2 "$IMAGE_BASE/SHA256SUMS" -o "$sums.part"
  mv "$sums.part" "$sums"
  expected="$(awk -v f="$IMAGE_FILE" '$2 == f || $2 == "*" f {print $1}' "$sums")"
  [[ "$expected" =~ ^[[:xdigit:]]{64}$ ]] || die "Ubuntu image checksum missing from release checksum file"
  actual="$(sha256sum "$image" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || { rm -f -- "$image"; die "Ubuntu image SHA-256 mismatch; deleted cached image"; }
  printf '%s\n' "$image"
}

hostonly_name_for() {
  local layer="$1" map="$VM_ROOT/vbox-hostonly-${layer}"
  [[ -s "$map" ]] && { cat "$map"; return; }
  # New host-only adapters are named by VirtualBox (usually vboxnetN).
  # Persist the assigned name so repeated provisioning never creates extras.
  VBoxManage hostonlyif create >/dev/null
  local created; created="$(VBoxManage list hostonlyifs | awk -F': *' '/^Name:/ {print $2}' | tail -1)"
  [[ -n "$created" ]] || die "VirtualBox did not report its new host-only interface"
  VBoxManage hostonlyif ipconfig "$created" --ip "$( [[ "$layer" == osint ]] && echo "$OSINT_HOST_IP" || echo "$POLICE_HOST_IP" )" --netmask 255.255.255.0
  printf '%s\n' "$created" >"$map"; chmod 600 "$map"
  printf '%s' "$created"
}
ensure_hostonly() {
  local layer="$1" nic
  nic="$(hostonly_name_for "$layer")"
  VBoxManage list hostonlyifs | grep -Fq "$nic" || die "VirtualBox host-only adapter $nic no longer exists; remove $VM_ROOT/vbox-hostonly-$layer to recreate it"
  printf '%s' "$nic"
}

provider_networks() {
  OSINT_BRIDGE="$(ensure_hostonly osint)"
  POLICE_BRIDGE="$(ensure_hostonly police)"
}
provider_create_vm() {
  local layer="$1" name image disk seed meta userdata hostonly ip
  name="$(vm_name_for "$layer")"; image="$(fetch_base_image)"; ip="$(ip_for "$layer")"
  if VBoxManage showvminfo "$name" >/dev/null 2>&1; then return; fi
  hostonly="$(ensure_hostonly "$layer")"
  disk="$VM_ROOT/$name.vdi"; seed="$VM_ROOT/$name-seed.iso"; userdata="$VM_ROOT/$name.user-data"; meta="$VM_ROOT/$name.meta"
  VBoxManage createvm --name "$name" --ostype Ubuntu_64 --register >/dev/null
  VBoxManage modifyvm "$name" --memory 8192 --cpus 4 --boot1 disk --boot2 dvd --graphicscontroller none --audio none --usb off --nic1 hostonly --hostonlyadapter1 "$hostonly" --nictype1 virtio --macaddress1 "$( [[ "$layer" == police ]] && echo 525400772010 || echo 525400771010 )" --nic2 nat --nictype2 virtio --macaddress2 "$( [[ "$layer" == police ]] && echo 525400772011 || echo 525400771011 )" --cableconnected2 on
  # Convert the verified Canonical cloud disk to VDI; do not mutate cached base.
  VBoxManage clonemedium disk "$image" "$disk" --format VDI --variant Standard >/dev/null
  write_cloud_init "$layer" "$userdata"
  printf 'instance-id: %s\nlocal-hostname: manaa-%s\n' "$name" "$layer" >"$meta"
  cloud-localds "$seed" "$userdata" "$meta"
  VBoxManage storagectl "$name" --name SATA --add sata --controller IntelAhci >/dev/null
  VBoxManage storageattach "$name" --storagectl SATA --port 0 --device 0 --type hdd --medium "$disk"
  VBoxManage storageattach "$name" --storagectl SATA --port 1 --device 0 --type dvddrive --medium "$seed"
  chmod 600 "$disk" "$userdata" "$meta"
}

provider_start_vm() { VBoxManage startvm "$(vm_name_for "$1")" --type headless >/dev/null 2>&1 || VBoxManage showvminfo "$(vm_name_for "$1")" --machinereadable | grep -q 'VMState="running"'; }
provider_detach_install_network() { VBoxManage modifyvm "$(vm_name_for "$1")" --nic2 none --cableconnected2 off; }
provider_status() {
  for layer in osint police; do
    local name; name="$(vm_name_for "$layer")"
    printf '%s: ' "$layer"
    VBoxManage showvminfo "$name" --machinereadable 2>/dev/null | sed -n 's/^VMState="\([^"]*\)"/\1/p' || printf 'absent'
    printf ' | guest='; guest_ssh "$layer" 'systemctl is-active manaa-opencode.service 2>/dev/null || true' 2>/dev/null || printf 'unreachable'
    printf '\n'
  done
}
provider_stop() { VBoxManage controlvm "$(vm_name_for "$1")" acpipowerbutton >/dev/null 2>&1 || true; }
provider_logs() { VBoxManage showvminfo "$(vm_name_for "$1")" --log 0 2>/dev/null | tail -200; guest_ssh "$1" 'sudo journalctl -u manaa-opencode.service --no-pager -n 200' 2>/dev/null || true; }
