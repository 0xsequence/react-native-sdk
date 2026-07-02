#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPO_DIR="$ROOT_DIR/examples/expo-example"
PACKAGE_NAME="$(cd "$ROOT_DIR" && node -p "require('./package.json').name")"
PACKAGE_VERSION="$(cd "$ROOT_DIR" && node -p "require('./package.json').version")"
PACKAGE_SPEC="$PACKAGE_NAME@$PACKAGE_VERSION"

if npm view "$PACKAGE_SPEC" version >/dev/null 2>&1; then
  npm --prefix "$EXPO_DIR" ci
  exit 0
fi

TMP_DIR="$(mktemp -d)"
restore_manifest() {
  cp "$TMP_DIR/package.json" "$EXPO_DIR/package.json"
  cp "$TMP_DIR/package-lock.json" "$EXPO_DIR/package-lock.json"
  rm -rf "$TMP_DIR"
}
trap restore_manifest EXIT

cp "$EXPO_DIR/package.json" "$TMP_DIR/package.json"
cp "$EXPO_DIR/package-lock.json" "$TMP_DIR/package-lock.json"

TARBALL="$TMP_DIR/oms-react-native-sdk-$PACKAGE_VERSION.tgz"

cd "$ROOT_DIR"
yarn prepare
yarn pack --out "$TARBALL"
npm --prefix "$EXPO_DIR" install --package-lock-only --ignore-scripts "$TARBALL"
npm --prefix "$EXPO_DIR" ci
