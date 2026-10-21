#!/bin/sh
# Install or update Frame, optionally with optional modules.
#
#   ./install.sh                       core into /config
#   ./install.sh calendar energy       core plus optional/calendar and optional/energy
#   CONFIG=/some/path ./install.sh     another config folder
#
# Safe to run again to update: the runtime (www/frame) and the module templates are replaced, your own files
# are not. templates/frame.yaml (your household), the views and the theme are only copied when they don't
# exist yet. Restart Home Assistant after the first install; after an update, bump ?v= of the frame.js resource
# (the rail says so when the browser still runs an older frame.js).
set -e
CONFIG="${CONFIG:-/config}"
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -d "$CONFIG" ] || { echo "No config folder at $CONFIG (set CONFIG=...)"; exit 1; }

mkdir -p "$CONFIG/www/frame" "$CONFIG/frame/templates" "$CONFIG/frame/views" "$CONFIG/themes"
# runtime: always the newest
cp -R "$HERE/www/frame/." "$CONFIG/www/frame/"
# code: replaced; your settings: kept
cp "$HERE/dashboard/templates/core.yaml" "$HERE/dashboard/templates/setup.yaml" "$CONFIG/frame/templates/"
for f in frame.yaml templates/frame.yaml views/10-home.yaml views/20-house.yaml views/90-setup.yaml; do
  [ -e "$CONFIG/frame/$f" ] || cp "$HERE/dashboard/$f" "$CONFIG/frame/$f"
done
[ -e "$CONFIG/themes/frame.yaml" ] || cp "$HERE/themes/frame.yaml" "$CONFIG/themes/frame.yaml"
echo "✓ core"

for m in "$@"; do
  d="$HERE/optional/$m"
  [ -d "$d" ] || { echo "✗ no optional module '$m' (have: $(ls "$HERE/optional" | tr '\n' ' '))"; continue; }
  [ -d "$d/www/frame" ] && cp -R "$d/www/frame/." "$CONFIG/www/frame/"
  [ -d "$d/dashboard/templates" ] && cp "$d/dashboard/templates/"*.yaml "$CONFIG/frame/templates/"
  # Home Assistant packages (helpers, automations): replaced like code; needs `packages:` in configuration.yaml
  if [ -d "$d/packages" ]; then mkdir -p "$CONFIG/packages" && cp "$d/packages/"*.yaml "$CONFIG/packages/"; fi
  # Jinja macros the packages import; replaced like code
  if [ -d "$d/custom_templates" ]; then mkdir -p "$CONFIG/custom_templates" && cp "$d/custom_templates/"*.jinja "$CONFIG/custom_templates/"; fi
  if [ -d "$d/dashboard/views" ]; then
    for v in "$d/dashboard/views/"*.yaml; do [ -e "$CONFIG/frame/views/$(basename "$v")" ] || cp "$v" "$CONFIG/frame/views/"; done
  fi
  echo "✓ $m (see optional/$m/README.md for the last step)"
done
echo "Done. Raise ?v= of the frame.js resource and reload the Frame dashboard (restart Home Assistant after the first install)."
