#!/usr/bin/env bash
set -Eeuo pipefail
layer="${1:-}"
model_host="${2:-$( [[ "$layer" == police ]] && printf '10.77.20.1' || printf '10.77.10.1' )}"
model_port="${3:-11434}"
model_name="${4:-local-model}"
[[ "$layer" == osint || "$layer" == police ]] || { echo 'guest-install: layer must be osint or police' >&2; exit 2; }
install -d -o manaa -g manaa /opt/manaa/engine /opt/manaa/guest /var/lib/manaa /etc/manaa
install -d -o root -g root -m 0755 /usr/local/lib/manaa /usr/local/bin
cp -a /tmp/manaa-bootstrap/engine/. /opt/manaa/engine/
cp -a /tmp/manaa-bootstrap/guest/. /opt/manaa/guest/
chown -R root:root /opt/manaa/engine /opt/manaa/guest
chmod -R a-w /opt/manaa/engine /opt/manaa/guest
install -m 0755 /opt/manaa/guest/guest-runner.sh /usr/local/bin/manaa-guest-runner
install -m 0755 /opt/manaa/guest/police-review.py /usr/local/bin/manaa-police-review
install -m 0644 /opt/manaa/guest/opencode.service /etc/systemd/system/manaa-opencode.service
[[ "$model_host" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ && "$model_port" =~ ^[0-9]{1,5}$ ]] || { echo 'invalid private model endpoint' >&2; exit 2; }
((model_port > 0 && model_port < 65536)) || { echo 'invalid private model port' >&2; exit 2; }
[[ "$model_name" =~ ^[A-Za-z0-9._:/-]{1,96}$ ]] || { echo 'invalid model ID' >&2; exit 2; }
sed -e "s|__LAYER__|${layer}|g" -e "s|__MODEL_HOST__|${model_host}|g" -e "s|__MODEL_PORT__|${model_port}|g" -e "s|__MODEL_NAME__|${model_name}|g" \
  /opt/manaa/guest/runtime.env >"/etc/manaa/${layer}.env"
chown root:manaa "/etc/manaa/${layer}.env"
chmod 0640 "/etc/manaa/${layer}.env"
sed -e "s|__MODEL_NAME__|${model_name}|g" /opt/manaa/guest/opencode.json >/etc/manaa/opencode.json
chmod 0644 /etc/manaa/opencode.json
install -d -o manaa -g manaa /home/manaa/.config/opencode
install -m 0600 /etc/manaa/opencode.json /home/manaa/.config/opencode/opencode.json
chown manaa:manaa /home/manaa/.config/opencode/opencode.json
systemctl daemon-reload
systemctl enable manaa-opencode.service
# Default-deny guest firewall: only the private model endpoint, this layer's
# one-way transfer services, and host-side SSH/OpenCode access are permitted.
host_ip=10.77.10.1; writer_port=8081; reader_port=0; results_port=0
if [[ "$layer" == police ]]; then host_ip=10.77.20.1; writer_port=0; reader_port=8082; results_port=8083; fi
allowed_model_host=10.77.10.1
[[ "$layer" != police ]] || allowed_model_host=10.77.20.1
[[ "$model_host" == "$allowed_model_host" ]] || { echo "model host must be the private bridge endpoint $allowed_model_host" >&2; exit 2; }
cat >/etc/nftables.conf <<EOF
#!/usr/sbin/nft -f
flush ruleset
table inet manaa {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    ip saddr ${host_ip} tcp dport { 22, 4096 } accept
  }
  chain output {
    type filter hook output priority 0; policy drop;
    oif lo accept
    ct state established,related accept
    ip daddr ${model_host} tcp dport ${model_port} accept
$( [[ "$writer_port" != 0 ]] && printf '    ip daddr %s tcp dport %s accept\n' "$host_ip" "$writer_port" )
$( [[ "$reader_port" != 0 ]] && printf '    ip daddr %s tcp dport %s accept\n' "$host_ip" "$reader_port" )
$( [[ "$results_port" != 0 ]] && printf '    ip daddr %s tcp dport %s accept\n' "$host_ip" "$results_port" )
  }
}
EOF
# Do not start services during installation. Caller detaches provisioning NAT,
# applies network policy, then may start the services.
touch /var/lib/manaa/installed-${layer}
