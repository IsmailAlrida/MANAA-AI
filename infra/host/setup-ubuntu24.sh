#!/usr/bin/env bash
# Host setup is explicit and does not run as part of provisioning. It installs
# only the local VM and host-transfer dependencies; it does not create VMs or
# configure firewall/routes. Ubuntu's PostgreSQL package may initialize its
# default cluster; MANAA host services use a separate state-dir cluster and do
# not alter the package-managed one.
set -Eeuo pipefail
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo 'Run with sudo: infra/host/setup-ubuntu24.sh [--with-virtualbox]' >&2
  exit 1
fi
[[ -r /etc/os-release ]] || { echo 'cannot identify host OS' >&2; exit 1; }
. /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || { echo 'This setup supports Ubuntu 24.04 only.' >&2; exit 1; }
WITH_VIRTUALBOX=0
case "${1:-}" in '' ) ;; --with-virtualbox) WITH_VIRTUALBOX=1;; -h|--help) echo 'Usage: sudo infra/host/setup-ubuntu24.sh [--with-virtualbox]'; exit 0;; *) echo "unknown option: $1" >&2; exit 2;; esac

packages=(qemu-kvm libvirt-daemon-system libvirt-clients virtinst qemu-utils cloud-image-utils rsync openssh-client curl ca-certificates postgresql postgresql-client python3-venv python3-pip openssl iproute2 util-linux nftables)
if ((WITH_VIRTUALBOX)); then packages+=(virtualbox); fi
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
systemctl enable --now libvirtd
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != root ]]; then
  usermod -aG libvirt,kvm "$SUDO_USER"
  echo "Added $SUDO_USER to libvirt and kvm groups. Sign out and back in to use libvirt without sudo."
fi
echo 'Host packages are ready. Run infra/vm-control.sh networks --provider libvirt before starting transfer listeners.'
