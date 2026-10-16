#!/bin/sh
# Jarvis HUD FX, greeting context.
# Claude Code UserPromptSubmit hook. When you send your first message from
# Claudian's welcome screen, the plugin saves the greeting you saw next to
# this script. This hook prints it, which Claude Code adds as context for
# that message, and removes the file so it is only used once. A greeting
# older than MAX_AGE seconds is dropped instead, so a stale one never
# reaches an unrelated message.

MAX_AGE=60
note="$(dirname "$0")/greeting.txt"

cat > /dev/null # Claude Code sends the prompt on stdin, not needed here.
[ -f "$note" ] || exit 0

saved=$(stat -f %m "$note" 2>/dev/null || stat -c %Y "$note" 2>/dev/null || echo 0)
line=$(cat "$note")
rm -f "$note"

[ $(( $(date +%s) - saved )) -le "$MAX_AGE" ] || exit 0
[ -n "$line" ] || exit 0

printf 'Before this message, the Jarvis welcome screen in Obsidian greeted the user with: "%s"\nThe user did not write that line, but their message may be a reply to it.\n' "$line"
