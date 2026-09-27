#!/usr/bin/env bash
# Supervisor for the AutoSocial daemon mini-service.
# Restarts the daemon if it ever exits, and fully detaches it from the
# controlling terminal so it survives the launching shell session.

set -u

DAEMON_DIR="/home/z/my-project/mini-services/autosocial-daemon"
LOG_FILE="$DAEMON_DIR/daemon.log"
PIDFILE="$DAEMON_DIR/daemon.pid"

cd "$DAEMON_DIR"

# Kill any existing daemon
if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    kill "$OLDPID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDFILE"
fi
pkill -f "autosocial-daemon/index.ts" 2>/dev/null || true
sleep 1

# Start the supervisor loop in a fully detached session.
# The outer loop restarts the daemon if it crashes.
setsid bash -c '
  while true; do
    POLL_INTERVAL_MS=15000 bun /home/z/my-project/mini-services/autosocial-daemon/index.ts
    echo "$(date -u +%FT%TZ) [WARN] daemon exited, restarting in 3s..." >> '"$LOG_FILE"'
    sleep 3
  done
' > "$LOG_FILE" 2>&1 < /dev/null &

SUPERVISOR_PID=$!
echo "$SUPERVISOR_PID" > "$PIDFILE"
echo "AutoSocial daemon supervisor started (pid $SUPERVISOR_PID)"
echo "Log: $LOG_FILE"
