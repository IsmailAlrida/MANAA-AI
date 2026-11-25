#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/provider-common.sh"
layer="${1:-}"
valid_layer "$layer" || { echo 'Usage: infra/model-preflight.sh osint|police' >&2; exit 2; }
upper="${layer^^}"
host_var="MANAA_${upper}_MODEL_HOST"; port_var="MANAA_${upper}_MODEL_PORT"
name_var="MANAA_${upper}_MODEL_NAME"; key_var="MANAA_${upper}_MODEL_API_KEY"
default_host="$OSINT_HOST_IP"; [[ "$layer" != police ]] || default_host="$POLICE_HOST_IP"
model_host="${!host_var:-$default_host}"
model_port="${!port_var:-11434}"
model_name="${!name_var:-local-model}"
model_key="${!key_var:-}"
[[ "$model_host" == "$default_host" ]] || die "$layer model endpoint must be $default_host on its private bridge"
[[ "$model_port" =~ ^[0-9]{1,5}$ ]] && ((model_port > 0 && model_port < 65536)) || die 'model port must be 1..65535'
[[ "$model_name" =~ ^[A-Za-z0-9._:/-]{1,96}$ ]] || die 'invalid model ID'
[[ "$model_key" =~ ^[A-Za-z0-9._~-]{0,256}$ ]] || die 'model API key may contain only letters, digits, . _ ~ and -'
need curl; need jq
endpoint="http://${model_host}:${model_port}/v1/models"
if [[ -n "$model_key" ]]; then
  payload="$(printf 'header = "Authorization: Bearer %s"\n' "$model_key" | curl --config - --fail --silent --show-error --max-time 5 "$endpoint")" || die "$layer private model endpoint did not pass /v1/models preflight"
else
  payload="$(curl --fail --silent --show-error --max-time 5 "$endpoint")" || die "$layer private model endpoint did not pass /v1/models preflight"
fi
if ! jq -e --arg model "$model_name" '([.data[]?.id, .models[]?.name] | index($model)) != null' <<<"$payload" >/dev/null; then
  unset payload model_key
  die "$layer private model endpoint is reachable but the configured model ID is unavailable"
fi
unset payload model_key
printf '%s private model ready: %s at %s\n' "$layer" "$model_name" "$endpoint"
