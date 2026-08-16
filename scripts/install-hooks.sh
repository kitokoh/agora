#!/usr/bin/env bash
# Install git hooks for Agora developers (pre-commit: gitleaks secret scan).
#
# Usage: ./scripts/install-hooks.sh
set -euo pipefail

HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

cat > "$PRE_COMMIT" <<'EOF'
#!/usr/bin/env bash
# Agora pre-commit hook — gitleaks secret scan on staged changes.
set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "pre-commit: gitleaks not installed — skipping secret scan"
  echo "           install: https://github.com/gitleaks/gitleaks (brew install gitleaks)"
  exit 0
fi

gitleaks protect --staged --config .gitleaks.toml --redact --verbose
EOF

chmod +x "$PRE_COMMIT"
echo "✓ pre-commit hook installed ($PRE_COMMIT) — gitleaks secret scan"
