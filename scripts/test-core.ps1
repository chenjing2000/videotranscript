$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
New-Item -ItemType Directory -Force -Path '.tmp-core' | Out-Null
& tsc --target ES2022 --module commonjs --strict --skipLibCheck --outDir .tmp-core src/core/*.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Content -LiteralPath '.tmp-core/package.json' -Value '{"type":"commonjs"}'
& node --test tests/*.test.mjs
exit $LASTEXITCODE
