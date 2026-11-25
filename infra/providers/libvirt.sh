#!/usr/bin/env bash
set -Eeuo pipefail
source "$INFRA_DIR/provider-common.sh"

UBUNTU_RELEASE="${MANAA_UBUNTU_RELEASE:-20241119}"
IMAGE_FILE="ubuntu-24.04-server-cloudimg-amd64.img"
IMAGE_BASE="https://cloud-images.ubuntu.com/releases/24.04/release-${UBUNTU_RELEASE}"
IMAGE_SHA_URL="$IMAGE_BASE/SHA256SUMS"

provider_require() { need virsh; need qemu-img; need cloud-localds; need curl; need sha256sum; need rsync; need ssh; }

fetch_base_image() {
  local image="$VM_ROOT/$IMAGE_FILE" sums="$VM_ROOT/SHA256SUMS" expected actual
  if [[ ! -s "$image" ]]; then
    curl --fail --location --proto '=https' --tlsv1.2 "$IMAGE_BASE/$IMAGE_FILE" -o "$image.part"
    mv "$image.part" "$image"
  fi
  curl --fail --location --proto '=https' --tlsv1.2 "$IMAGE_SHA_URL" -o "$sums.part"
  mv "$sums.part" "$sums"
  expected="$(awk -v f="$IMAGE_FILE" '$2 == f || $2 == "*" f {print $1}' "$sums")"
  [[ "$expected" =~ ^[[:xdigit:]]{64}$ ]] || die "Ubuntu image checksum missing from signed release checksum file"
  actual="$(sha256sum "$image" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || { rm -f -- "$image"; die "Ubuntu cloud image SHA-256 mismatch; deleted cached image"; }
  printf '%s\n' "$image"
}

define_network() {
  local name="$1" bridge="$2" cidr="$3" ip="$4" mode="$5" xml="$VM_ROOT/$name.xml"
  if virsh net-info "$name" >/dev/null 2>&1; then
    virsh net-dumpxml "$name" | grep -Fq "<forward mode='$mode'/>" || die "existing libvirt network $name does not match required $mode policy; refusing to mutate it"
    virsh net-info "$name" | grep -q 'Active:.*yes' || virsh net-start "$name" >/dev/null
    return
  fi
  cat >"$xml" <<EOF
<network>
  <name>${name}</name>
  <bridge name='${bridge}' stp='on' delay='0'/>
  <forward mode='${mode}'/>
  <ip address='${ip}' netmask='255.255.255.0'>
    <dhcp><range start='${cidr}.10' end='${cidr}.200'/></dhcp>
  </ip>
</network>
EOF
  virsh net-define "$xml" >/dev/null
  virsh net-autostart "$name" >/dev/null
  virsh net-start "$name" >/dev/null
}

provider_networks() {
  # Internet access exists only during package installation. The guest NIC is
  # detached after provisioning. Police is always libvirt-isolated.
  define_network "$OSINT_NET" "$OSINT_BRIDGE" 10.77.10 "$OSINT_HOST_IP" none
  define_network "$POLICE_NET" "$POLICE_BRIDGE" 10.77.20 "$POLICE_HOST_IP" none
  define_network manaa-install-net virbr-manaa-install 192.168.77 192.168.77.1 nat
}

provider_create_vm() {
  local layer="$1" offline="$2" name image disk meta userdata seed net mac installer_mac
  name="$(vm_name_for "$layer")"; net="$(network_for "$layer")"
  image="$(fetch_base_image)"
  disk="$VM_ROOT/$name.qcow2"; meta="$VM_ROOT/$name.meta"; userdata="$VM_ROOT/$name.user-data"; seed="$VM_ROOT/$name-seed.iso"
  if virsh dominfo "$name" >/dev/null 2>&1; then return; fi
  qemu-img create -f qcow2 -F qcow2 -b "$image" "$disk" 40G >/dev/null
  write_cloud_init "$layer" "$userdata"
  printf 'instance-id: %s\nlocal-hostname: manaa-%s\n' "$name" "$layer" >"$meta"
  cloud-localds "$seed" "$userdata" "$meta"
  # Keep the network attached only long enough for bootstrap packages. --offline
  # suppresses NAT on OSINT; police is isolated regardless.
  mac="$( [[ "$layer" == police ]] && printf '52:54:00:77:20:10' || printf '52:54:00:77:10:10' )"
  installer_mac="$( [[ "$layer" == police ]] && printf '52:54:00:77:20:11' || printf '52:54:00:77:10:11' )"
  virsh define "$INFRA_DIR/templates/libvirt-domain.xml" >/dev/null 2>&1 || true
  cat >"$VM_ROOT/$name.xml" <<EOF
<domain type='kvm'>
  <name>${name}</name><memory unit='MiB'>8192</memory><vcpu>4</vcpu>
  <os><type arch='x86_64' machine='q35'>hvm</type><boot dev='hd'/></os>
  <features><acpi/><apic/></features>
  <cpu mode='host-passthrough'/><clock offset='utc'/>
  <devices>
    <disk type='file' device='disk'><driver name='qemu' type='qcow2'/><source file='${disk}'/><target dev='vda' bus='virtio'/></disk>
    <disk type='file' device='cdrom'><driver name='qemu' type='raw'/><source file='${seed}'/><target dev='sda' bus='sata'/><readonly/></disk>
    <interface type='network'><mac address='${mac}'/><source network='${net}'/><model type='virtio'/></interface>
    <interface type='network'><mac address='${installer_mac}'/><source network='manaa-install-net'/><model type='virtio'/></interface>
    <serial type='pty'><target type='isa-serial' port='0'/></serial><console type='pty'><target type='serial' port='0'/></console>
    <graphics type='none'/><video><model type='none'/></video>
  </devices>
</domain>
EOF
  virsh define "$VM_ROOT/$name.xml" >/dev/null
  chmod 600 "$disk" "$userdata" "$meta"
}

provider_start_vm() { virsh start "$(vm_name_for "$1")" >/dev/null 2>&1 || virsh domstate "$(vm_name_for "$1")" | grep -qi running; }
provider_detach_install_network() {
  local layer="$1" name installer_mac
  name="$(vm_name_for "$layer")"
  installer_mac="$( [[ "$layer" == police ]] && printf '52:54:00:77:20:11' || printf '52:54:00:77:10:11' )"
  virsh detach-interface "$name" network --mac "$installer_mac" --live --config >/dev/null 2>&1 || true
}

provider_status() {
  for layer in osint police; do
    local name; name="$(vm_name_for "$layer")"
    printf '%s: ' "$layer"; virsh domstate "$name" 2>/dev/null | tr -d '\n' || printf 'absent'
    printf ' | guest='; guest_ssh "$layer" 'systemctl is-active manaa-opencode.service 2>/dev/null || true' 2>/dev/null || printf 'unreachable'
    printf '\n'
  done
}
provider_stop() { local layer="$1"; virsh shutdown "$(vm_name_for "$layer")" >/dev/null 2>&1 || true; }
provider_logs() { local layer="$1"; guest_ssh "$layer" 'sudo journalctl -u manaa-opencode.service --no-pager -n 200'; }
