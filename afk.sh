#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

if node --experimental-strip-types --eval "" >/dev/null 2>&1; then
  node --experimental-strip-types ./.sandcastle/main.mts "$1"
elif [ -x "./node_modules/.bin/tsx" ]; then
  ./node_modules/.bin/tsx ./.sandcastle/main.mts "$1"
elif [ -f "./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs" ]; then
  node --import ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs ./.sandcastle/main.mts "$1"
else
  echo "tsx is not available. Install dependencies or add tsx as a devDependency."
  exit 1
fi
