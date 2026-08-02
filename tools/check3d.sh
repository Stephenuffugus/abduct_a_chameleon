#!/usr/bin/env bash
# Syntax-check abduct-3d.html's module script. A syntax error in it kills the
# entire game silently, so this runs before every commit.
set -e
cd "$(dirname "$0")/.."
node -e "
const fs=require('fs');const s=fs.readFileSync('abduct-3d.html','utf8');
const m=s.match(/<script type=\"module\">([\s\S]*?)<\/script>/);
if(!m){console.error('no module script found');process.exit(1)}
fs.writeFileSync('/tmp/aac3d-check.mjs', m[1]);
"
node --check /tmp/aac3d-check.mjs && echo "abduct-3d.html module: SYNTAX OK"
