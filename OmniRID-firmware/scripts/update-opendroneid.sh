#!/usr/bin/env bash
# Fetches the official OpenDroneID C library at a pinned ref and replaces the
# vendored copy used by `opendroneid-sys`.
#
# Usage: update-opendroneid.sh [ref]        (default: master)
#
# The upstream `v2.0` release tag is from 2022-04-06 and is OLDER than the
# master state we vendor (master added round() to all encoders, const
# qualifiers, INV_ALT guards, ...). Syncing from "latest release" would be a
# downgrade — hence we track master pinned to a commit SHA resolved by CI.
#
# After downloading, `vendor/local-tweaks.patch` (PRIu32 format specifiers
# for embedded toolchains, #ifndef guards on INV_ALT/MAX_TIMESTAMP) is
# re-applied. If upstream touches the same lines, `patch` fails and the sync
# aborts loudly instead of silently dropping the tweaks.
#
# This is the "deliberate, reviewed and verified" update path: the layout
# parity tests in `opendroneid-sys` (layout_probe.c vs the Rust FFI mirrors)
# and the byte-exact tests in `out-astm` gate the change. If the C struct
# layout or encoder behaviour changed, those tests fail and the FFI mirror in
# `external-libs/opendroneid-sys/src/lib.rs` must be updated in the same PR.
set -euo pipefail

REPO="opendroneid/opendroneid-core-c"
REF="${1:-master}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_DIR="${SCRIPT_DIR}/../external-libs/opendroneid-sys/vendor"

for f in opendroneid.c opendroneid.h; do
  echo "==> downloading ${REPO}@${REF}/${f}"
  curl -fsSL "https://raw.githubusercontent.com/${REPO}/${REF}/${f}" -o "${VENDOR_DIR}/${f}" \
    || curl -fsSL "https://raw.githubusercontent.com/${REPO}/${REF}/libopendroneid/${f}" -o "${VENDOR_DIR}/${f}"
done

echo "==> re-applying local tweaks"
patch -p0 --directory="${VENDOR_DIR}" -i "${VENDOR_DIR}/local-tweaks.patch"

echo "==> vendored library updated to ${REF}"
git -C "${SCRIPT_DIR}/.." diff --stat -- external-libs/opendroneid-sys
