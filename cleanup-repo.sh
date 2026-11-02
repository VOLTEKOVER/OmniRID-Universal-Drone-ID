#!/bin/bash
# cleanup-repo.sh - Distinguish sources from artifacts
# Usage: ./cleanup-repo.sh [--clean-artifacts|--verify-structure]

set -e

echo "=== ESP32_DRONE_ID Repository Cleanup ==="
echo ""

# Verify gitignored artifacts are indeed ignored
echo "1. Checking gitignored artifacts are ignored..."
git -C OmniRID-firmware check-ignore target/ > /dev/null 2>&1 && echo "  ✅ target/ is gitignored" || echo "  ⚠️ target/ is NOT gitignored"
git -C OmniRID-firmware check-ignore node_modules/ > /dev/null 2>&1 && echo "  ✅ node_modules/ is gitignored" || echo "  ⚠️ node_modules/ is NOT gitignored"
git -C OmniRID-app check-ignore .nuxt/ > /dev/null 2>&1 && echo "  ✅ .nuxt/ is gitignored" || echo "  ⚠️ .nuxt/ is NOT gitignored"

echo ""
echo "2. Show sizes of key directories:"
echo "  Firmware target: $(du -sh OmniRID-firmware/target/ 2>/dev/null || echo 'N/A')"
echo "  App .nuxt: $(du -sh OmniRID-app/.nuxt/ 2>/dev/null || echo 'N/A')"
echo "  Git repo: $(git -C OmniRID-firmware du -sh . 2>/dev/null | cut -f1)"

echo ""
echo "3. Show source file count:"
echo "  Firmware Rust files: $(find OmniRID-firmware -name '*.rs' -not -path '*/target/*' | wc -l)"
echo "  App Vue files: $(find OmniRID-app -name '*.vue' | wc -l)"

echo ""
echo "4. Clean Python cache (optional):"
read -p "  Remove Python __pycache__ directories? (y/n) " clean_py
if [[ "$clean_py" =~ ^[Yy]$ ]]; then
    find OmniRID-firmware -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
    echo "  ✅ Python cache cleaned"
fi

echo ""
echo "=== Done ==="
