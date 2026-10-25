#!/usr/bin/env bash
# Copies the shared Kafka contracts into every deployable that needs them.
# Usage: scripts/sync-shared.sh          (copy)
#        scripts/sync-shared.sh --check  (fail if any copy has drifted — use in CI)
set -euo pipefail
cd "$(dirname "$0")/.."

ALL="topics.ts schemas.ts logger.ts topicAdmin.ts"
SERVICES_ONLY="consumerRunner.ts"

targets=(
  "server/src/events/shared:$ALL"
  "services/notification-consumer/src/shared:$ALL $SERVICES_ONLY"
  "services/recommendation-service/src/shared:$ALL $SERVICES_ONLY"
)

status=0
for t in "${targets[@]}"; do
  dir="${t%%:*}"; files="${t#*:}"
  mkdir -p "$dir"
  for f in $files; do
    if [[ "${1:-}" == "--check" ]]; then
      if ! diff -q "shared/$f" "$dir/$f" >/dev/null 2>&1; then
        echo "DRIFT: $dir/$f differs from shared/$f"; status=1
      fi
    else
      cp "shared/$f" "$dir/$f"
    fi
  done
done
[[ "${1:-}" == "--check" && $status -eq 0 ]] && echo "shared contracts in sync"
exit $status
