#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Codespaces keeps forwarded ports private by default. Do not expose the
# demonstration administrator account through an unrestricted public port.
if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null; then
  exit 0
fi

nohup npm run dev >/tmp/cejla-codespaces.log 2>&1 </dev/null &
for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null; then
    echo 'CEJLA iniciado. Abra a porta 3000 na aba Ports / Portas.'
    exit 0
  fi
  sleep 1
done
echo 'O CEJLA não iniciou. Consulte /tmp/cejla-codespaces.log.' >&2
exit 1
