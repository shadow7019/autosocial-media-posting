#!/usr/bin/env bash
# Supervisor for the Next.js dev server.
# Restarts the dev server if it ever exits, and fully detaches it from the
# controlling terminal so it survives the launching shell session.

set -u

LOG_FILE="/home/z/my-project/dev-direct.log"
PIDFILE="/home/z/my-project/dev-server.pid"

# Kill any existing dev server
if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    kill "$OLDPID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDFILE"
fi
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun run dev" 2>/dev/null || true
sleep 2

# Start the supervisor loop in a fully detached session.
setsid bash -c '
  while true; do
    /usr/bin/node /home/z/my-project/node_modules/.bin/next dev -p 3000
    echo "$(date -u +%FT%TZ) [WARN] dev server exited, restarting in 3s..." >> '"$LOG_FILE"'
    sleep 3
  done
' > "$LOG_FILE" 2>&1 < /dev/null &

SUPERVISOR_PID=$!
echo "$SUPERVISOR_PID" > "$PIDFILE"
echo "Next.js dev server supervisor started (pid $SUPERVISOR_PID)"
echo "Log: $LOG_FILE"
