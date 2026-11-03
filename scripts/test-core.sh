#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .tmp-core
tsc --target ES2022 --module commonjs --strict --skipLibCheck --outDir .tmp-core src/core/*.ts
printf '{"type":"commonjs"}\n' > .tmp-core/package.json
node --test tests/*.test.mjs
