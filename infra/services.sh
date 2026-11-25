#!/usr/bin/env bash
# Private host PostgreSQL and transfer listener lifecycle.
set -Eeuo pipefail

INFRA_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$INFRA_DIR/.." && pwd -P)"
ENGINE_DIR="$REPO_ROOT/engine"
STATE_ROOT="${MANAA_SERVICE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/manaa}"
DB_DIR="$STATE_ROOT/postgres"
SOCKET_DIR="$STATE_ROOT/socket"
VENV_DIR="$STATE_ROOT/venv"
PID_DIR="$STATE_ROOT/pids"
LOG_DIR="$STATE_ROOT/logs"
SECRET_FILE="$STATE_ROOT/services.env"
PGPASS_FILE="$STATE_ROOT/pgpass"
DB_PORT="${MANAA_DB_PORT:-55432}"
DB_NAME="${MANAA_DB_NAME:-manaa_transfer}"
ADMIN_ROLE="${MANAA_DB_ADMIN_ROLE:-$(id -un)}"

die() { printf 'services: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }
usage() { echo 'Usage: infra/services.sh db:up|transfer:start|status|logs|stop [--service writer|reader|results]' >&2; }
[[ "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || die 'MANAA_DB_NAME must be a plain PostgreSQL identifier'
[[ "$ADMIN_ROLE" == "$(id -un)" && "$ADMIN_ROLE" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || die 'MANAA_DB_ADMIN_ROLE must match the local OS username for peer authentication'
[[ "$DB_PORT" =~ ^[0-9]+$ ]] && ((DB_PORT > 0 && DB_PORT < 65536)) || die 'MANAA_DB_PORT must be between 1 and 65535'

service_config() {
  case "$1" in
    writer) printf '%s\n' 10.77.10.1 8081 MANAA_WRITER_DSN;;
    reader) printf '%s\n' 10.77.20.1 8082 MANAA_READER_DSN;;
    results) printf '%s\n' 10.77.20.1 8083 MANAA_RESULTS_DSN;;
    *) die "unknown service: $1";;
  esac
}

prepare_dirs() {
  install -d -m 0700 "$STATE_ROOT" "$PID_DIR" "$LOG_DIR" "$SOCKET_DIR"
  chmod 0700 "$STATE_ROOT" "$PID_DIR" "$LOG_DIR" "$SOCKET_DIR"
}

find_initdb() {
  if command -v initdb >/dev/null 2>&1; then command -v initdb; return; fi
  local candidate
  for candidate in /usr/lib/postgresql/*/bin/initdb; do
    [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
  done
  die 'PostgreSQL server package is missing (initdb not found)'
}

find_pg_ctl() {
  if command -v pg_ctl >/dev/null 2>&1; then command -v pg_ctl; return; fi
  local candidate
  for candidate in /usr/lib/postgresql/*/bin/pg_ctl; do
    [[ -x "$candidate" ]] && { printf '%s\n' "$candidate"; return; }
  done
  die 'PostgreSQL server package is missing (pg_ctl not found)'
}

pg_ctl_cmd() { "$(find_pg_ctl)" "$@"; }
psql_admin() { psql -X -h "$SOCKET_DIR" -p "$DB_PORT" -U "$ADMIN_ROLE" -d postgres "$@"; }

port_free() {
  local host="$1" port="$2"
  python3 - "$host" "$port" <<'PY'
import socket, sys
s = socket.socket()
try:
    s.bind((sys.argv[1], int(sys.argv[2])))
except OSError:
    raise SystemExit(1)
finally:
    s.close()
PY
}

load_secrets() {
  [[ -f "$SECRET_FILE" ]] || die 'database credentials are missing; run db:up first'
  [[ "$(stat -c '%a' "$SECRET_FILE")" == 600 ]] || chmod 0600 "$SECRET_FILE"
  # File content is generated locally as shell-safe values, mode 0600.
  # shellcheck disable=SC1090
  source "$SECRET_FILE"
}

make_secret_file() {
  local admin_pw writer_pw reader_pw results_pw result_token admin_dsn writer_dsn reader_dsn results_dsn
  admin_pw="$(openssl rand -hex 32)"
  writer_pw="$(openssl rand -hex 32)"
  reader_pw="$(openssl rand -hex 32)"
  results_pw="$(openssl rand -hex 32)"
  result_token="$(openssl rand -hex 32)"
  admin_dsn="postgresql://${ADMIN_ROLE}:${admin_pw}@127.0.0.1:${DB_PORT}/${DB_NAME}"
  writer_dsn="postgresql://manaa_writer_login:${writer_pw}@127.0.0.1:${DB_PORT}/${DB_NAME}"
  reader_dsn="postgresql://manaa_reader_login:${reader_pw}@127.0.0.1:${DB_PORT}/${DB_NAME}"
  results_dsn="postgresql://manaa_results_login:${results_pw}@127.0.0.1:${DB_PORT}/${DB_NAME}"
  umask 077
  cat >"$SECRET_FILE" <<EOF
MANAA_MIGRATION_DSN='$admin_dsn'
MANAA_ADMIN_DSN='$admin_dsn'
MANAA_WRITER_DSN='$writer_dsn'
MANAA_READER_DSN='$reader_dsn'
MANAA_RESULTS_DSN='$results_dsn'
MANAA_RESULTS_TOKEN='$result_token'
EOF
  chmod 0600 "$SECRET_FILE"
  cat >"$PGPASS_FILE" <<EOF
127.0.0.1:$DB_PORT:$DB_NAME:manaa_writer_login:$writer_pw
127.0.0.1:$DB_PORT:$DB_NAME:manaa_reader_login:$reader_pw
127.0.0.1:$DB_PORT:$DB_NAME:manaa_results_login:$results_pw
EOF
  chmod 0600 "$PGPASS_FILE"
}

db_ready() {
  command -v pg_isready >/dev/null 2>&1 || return 1
  pg_isready -q -h "$SOCKET_DIR" -p "$DB_PORT" -U "$ADMIN_ROLE" -d postgres
}

start_database() {
  prepare_dirs
  need python3; need psql; need pg_isready; need openssl
  local initdb
  initdb="$(find_initdb)"
  if [[ ! -f "$DB_DIR/PG_VERSION" ]]; then
    [[ ! -e "$DB_DIR" || -z "$(find "$DB_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]] || die "refusing to initialize non-empty, unrecognized PostgreSQL directory: $DB_DIR"
    install -d -m 0700 "$DB_DIR"
    "$initdb" -D "$DB_DIR" --auth-local=peer --auth-host=scram-sha-256 --username="$ADMIN_ROLE" --no-instructions >/dev/null
  fi
  if ! db_ready; then
    if ! port_free 127.0.0.1 "$DB_PORT"; then die "database port $DB_PORT is occupied by an unrelated process"; fi
    pg_ctl_cmd -D "$DB_DIR" -l "$LOG_DIR/postgres.log" -o "-h 127.0.0.1 -p $DB_PORT -k $SOCKET_DIR" -w start >/dev/null
  fi
  [[ -f "$SECRET_FILE" ]] || make_secret_file
  load_secrets
  write_pgpass
  psql_admin -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -qx 1 || createdb -h "$SOCKET_DIR" -p "$DB_PORT" -U "$ADMIN_ROLE" "$DB_NAME"
  bootstrap_roles
  apply_migrations
  verify_roles
}

bootstrap_roles() {
  psql_admin -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='manaa_writer_login') THEN CREATE ROLE manaa_writer_login LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='manaa_reader_login') THEN CREATE ROLE manaa_reader_login LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='manaa_results_login') THEN CREATE ROLE manaa_results_login LOGIN; END IF;
END $$;
SQL
  # Extract generated hexadecimal passwords without putting credentials in argv.
  local admin_pw writer_pw reader_pw results_pw
  admin_pw="$(dsn_password "$MANAA_ADMIN_DSN")"
  writer_pw="$(dsn_password "$MANAA_WRITER_DSN")"
  reader_pw="$(dsn_password "$MANAA_READER_DSN")"
  results_pw="$(dsn_password "$MANAA_RESULTS_DSN")"
  {
    printf "ALTER ROLE CURRENT_USER PASSWORD '%s';\n" "$admin_pw"
    printf "ALTER ROLE manaa_writer_login PASSWORD '%s';\n" "$writer_pw"
    printf "ALTER ROLE manaa_reader_login PASSWORD '%s';\n" "$reader_pw"
    printf "ALTER ROLE manaa_results_login PASSWORD '%s';\n" "$results_pw"
  } | psql_admin -v ON_ERROR_STOP=1 >/dev/null
}

dsn_password() { local value="${1#*://}"; value="${value#*:}"; printf '%s' "${value%%@*}"; }

write_pgpass() {
  umask 077
  cat >"$PGPASS_FILE" <<EOF
127.0.0.1:$DB_PORT:$DB_NAME:manaa_writer_login:$(dsn_password "$MANAA_WRITER_DSN")
127.0.0.1:$DB_PORT:$DB_NAME:manaa_reader_login:$(dsn_password "$MANAA_READER_DSN")
127.0.0.1:$DB_PORT:$DB_NAME:manaa_results_login:$(dsn_password "$MANAA_RESULTS_DSN")
EOF
  chmod 0600 "$PGPASS_FILE"
}

apply_migrations() {
  (cd "$ENGINE_DIR" && MANAA_MIGRATION_DSN="$MANAA_MIGRATION_DSN" "$VENV_DIR/bin/python" -m transfer.migrate)
  psql_admin -d "$DB_NAME" -v ON_ERROR_STOP=1 -v db_name="$DB_NAME" >/dev/null <<'SQL'
GRANT CONNECT ON DATABASE :"db_name" TO manaa_writer, manaa_reader, manaa_results;
GRANT USAGE ON SCHEMA public TO manaa_writer, manaa_reader, manaa_results;
GRANT manaa_writer TO manaa_writer_login;
GRANT manaa_reader TO manaa_reader_login;
GRANT manaa_results TO manaa_results_login;
SQL
}

verify_roles() {
  local role
  for role in writer reader results; do
    PGPASSFILE="$PGPASS_FILE" psql -X -h 127.0.0.1 -p "$DB_PORT" -U "manaa_${role}_login" -d "$DB_NAME" -v ON_ERROR_STOP=1 -tAc 'SELECT current_user' >/dev/null || die "database login check failed for $role role"
  done
}

ensure_venv() {
  prepare_dirs
  need python3
  local uv_version
  uv_version="$(awk -F= '$1=="uv" {print $2}' "$INFRA_DIR/runtime.lock")"
  [[ "$uv_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'infra/runtime.lock has no valid uv pin'
  if [[ ! -x "$VENV_DIR/bin/uv" ]]; then
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/python" -m pip install --disable-pip-version-check "uv==$uv_version" >/dev/null
  fi
  # Keep the project environment outside the engine checkout.
  (cd "$ENGINE_DIR" && UV_PROJECT_ENVIRONMENT="$VENV_DIR" "$VENV_DIR/bin/uv" sync --extra transfer --frozen >/dev/null)
}

owned_pid() {
  local service="$1" file="$PID_DIR/$service.pid" pid args
  [[ -f "$file" ]] || return 1
  read -r pid <"$file" || return 1
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null || return 1
  args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$args" == *'transfer.serve '*" $service "* ]] || return 1
  printf '%s' "$pid"
}

service_health() {
  local service="$1" host port
  readarray -t _cfg < <(service_config "$service"); host="${_cfg[0]}"; port="${_cfg[1]}"
  curl --silent --show-error --fail --max-time 2 "http://$host:$port/healthz" >/dev/null 2>&1
}

start_service() {
  local service="$1" host port dsnvar pid
  readarray -t _cfg < <(service_config "$service"); host="${_cfg[0]}"; port="${_cfg[1]}"; dsnvar="${_cfg[2]}"
  if owned_pid "$service" >/dev/null; then
    service_health "$service" || die "$service process is owned but not ready; see logs"
    printf '%s is already running and ready\n' "$service"; return
  fi
  if ! port_free "$host" "$port"; then die "$service listener port $host:$port is occupied by an unrelated process"; fi
  load_secrets
  ensure_venv
  # No DSN or password is written to logs or process arguments.
  if [[ "$service" == results ]]; then
    env "$dsnvar=${!dsnvar}" "MANAA_RESULTS_TOKEN=$MANAA_RESULTS_TOKEN" "$VENV_DIR/bin/python" -m transfer.serve "$service" --host "$host" --port "$port" >"$LOG_DIR/$service.log" 2>&1 &
  else
    env "$dsnvar=${!dsnvar}" "$VENV_DIR/bin/python" -m transfer.serve "$service" --host "$host" --port "$port" >"$LOG_DIR/$service.log" 2>&1 &
  fi
  pid=$!
  printf '%s\n' "$pid" >"$PID_DIR/$service.pid"; chmod 0600 "$PID_DIR/$service.pid"
  for _ in $(seq 1 60); do
    if service_health "$service"; then printf '%s ready at %s:%s\n' "$service" "$host" "$port"; return; fi
    if ! kill -0 "$pid" 2>/dev/null; then rm -f "$PID_DIR/$service.pid"; die "$service failed to start; see $LOG_DIR/$service.log"; fi
    sleep 1
  done
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_DIR/$service.pid"
  die "$service did not become ready; see $LOG_DIR/$service.log"
}

stop_service() {
  local service="$1" pid
  if pid="$(owned_pid "$service")"; then
    kill "$pid"
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && kill -TERM "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/$service.pid"
  fi
}

status() {
  local service
  if db_ready; then echo 'postgres: ready'; else echo 'postgres: stopped'; fi
  for service in writer reader results; do
    if owned_pid "$service" >/dev/null && service_health "$service"; then echo "$service: ready";
    elif owned_pid "$service" >/dev/null; then echo "$service: starting or unhealthy";
    else echo "$service: stopped"; fi
  done
}

main() {
  local command="${1:-}" selected='' service
  [[ -n "$command" ]] || { usage; exit 2; }; shift
  if [[ "$command" == -h || "$command" == --help ]]; then usage; return; fi
  while (($#)); do
    case "$1" in --service) (($# >= 2)) || { usage; exit 2; }; selected="$2"; shift 2;; -h|--help) usage; return;; *) usage; die "unknown option: $1";; esac
  done
  if [[ -n "$selected" && "$selected" != writer && "$selected" != reader && "$selected" != results && "$selected" != postgres ]]; then die "unknown service: $selected"; fi
  case "$command" in
    db:up) ensure_venv; start_database;;
    transfer:start) start_database; for service in writer reader results; do start_service "$service"; done;;
    status) prepare_dirs; status;;
    logs)
      if [[ -n "$selected" ]]; then [[ "$selected" == writer || "$selected" == reader || "$selected" == results || "$selected" == postgres ]] || die "unknown service: $selected"; [[ -f "$LOG_DIR/$selected.log" ]] || die "no log file for $selected"; tail -n 100 -f "$LOG_DIR/$selected.log"
      else for service in postgres writer reader results; do [[ -f "$LOG_DIR/$service.log" ]] && { echo "--- $service ---"; tail -n 100 "$LOG_DIR/$service.log"; }; done; fi;;
    stop)
      prepare_dirs
      for service in writer reader results; do [[ -z "$selected" || "$selected" == "$service" ]] && stop_service "$service"; done
      if [[ -z "$selected" ]] && [[ -f "$DB_DIR/PG_VERSION" ]] && db_ready; then pg_ctl_cmd -D "$DB_DIR" -m fast -w stop >/dev/null; fi;;
    *) usage; die "unknown command: $command";;
  esac
}

main "$@"
