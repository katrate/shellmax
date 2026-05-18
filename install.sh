#!/bin/bash
set -e

echo ""
echo "  Installing ShellMax..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ✖  Node.js not found. Install from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 16 ]; then
  echo "  ✖  Node.js 16+ required. Current: $(node -v)"
  exit 1
fi

echo "  ✔  Node.js $(node -v) found"

# Install dependencies
npm install --silent
echo "  ✔  Dependencies installed"

# Global install
npm install -g . --silent
echo "  ✔  ShellMax installed globally"

echo ""
echo "  Run:  shellmax"
echo ""
