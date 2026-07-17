#!/usr/bin/env bash
#
# Mirror the current tree to a new GitHub repository.
#
# See docs/MIGRATE-TO-NEW-REPO.md for the human context.
#
# Usage:
#   bash scripts/mirror-to-new-repo.sh https://github.com/OWNER/al-qasdi-project.git
#
# Guards before doing anything destructive:
#   • the working tree is clean (no uncommitted changes),
#   • no .env or secret / key / mail-outbox file is tracked or staged,
#   • the destination repo (via `gh` when available) is Private.
#
# On success:
#   • adds the `al-qasdi` remote,
#   • pushes the current branch as `main` on the new repo,
#   • creates + pushes tag $TAG (default v1.0.0-rc1),
#   • asks GitHub via `gh` to set default_branch=main,
#   • prints URLs for Actions, Tags, and branch-protection setup.
#
set -euo pipefail

REMOTE_URL="${1:?usage: mirror-to-new-repo.sh <new-repo-url>}"
NEW_REMOTE="al-qasdi"
DEFAULT_BRANCH="main"
TAG="${TAG:-v1.0.0-rc1}"
LOCAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Derive owner/repo from URL.
OWNER_REPO="$(echo "$REMOTE_URL" | sed -E 's|^https://github.com/||; s|\.git$||')"

say() { printf '\033[36m▶\033[0m %s\n' "$*"; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ─── Guard 1 — clean working tree ────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "working tree has uncommitted changes — commit or stash first"
fi

# ─── Guard 2 — refuse to push if any secret file is tracked ─────────────
say "checking for secret-shaped tracked files…"
FORBIDDEN_PATTERNS=(
  '^\.env$'
  '^\.env\.(?!example$).+$'
  '^storage/keys/.+'
  '^storage/mail-outbox/.+'
  '^storage/transfers/.+\.(png|jpg|jpeg|webp|pdf)$'
  '^storage/generated/.+\.pdf$'
  '.*\.pem$'
  '.*\.key$'
  '.*\.pfx$'
  '.*/id_rsa$'
  '.*/id_ed25519$'
)
BAD=()
while IFS= read -r f; do
  for pat in "${FORBIDDEN_PATTERNS[@]}"; do
    if [[ "$f" =~ $pat ]]; then
      BAD+=("$f  (pattern: $pat)")
    fi
  done
done < <(git ls-files)
if (( ${#BAD[@]} )); then
  printf '\n\033[31mRefusing to push — the following files would leak secrets or PII:\033[0m\n' >&2
  printf '  %s\n' "${BAD[@]}" >&2
  printf '\nAdd them to .gitignore, `git rm --cached`, and commit before re-running.\n' >&2
  exit 2
fi

# ─── Guard 3 — verify the destination is Private ────────────────────────
if command -v gh >/dev/null 2>&1; then
  say "checking that ${OWNER_REPO} is Private via gh…"
  IS_PRIVATE=$(gh api "repos/${OWNER_REPO}" --jq '.private' 2>/dev/null || echo "unknown")
  case "$IS_PRIVATE" in
    true)  say "  ✓ private" ;;
    false) die "destination repo is Public — set it to Private before mirroring" ;;
    *)     warn "could not confirm private status ($IS_PRIVATE) — continuing but please verify" ;;
  esac
else
  warn "gh CLI not installed — cannot auto-verify Private visibility. VERIFY MANUALLY at ${REMOTE_URL} before continuing."
fi

# ─── Upsert the remote ──────────────────────────────────────────────────
say "adding remote '${NEW_REMOTE}' → ${REMOTE_URL}"
if git remote get-url "$NEW_REMOTE" >/dev/null 2>&1; then
  git remote set-url "$NEW_REMOTE" "$REMOTE_URL"
else
  git remote add "$NEW_REMOTE" "$REMOTE_URL"
fi

# ─── Push branch → main ────────────────────────────────────────────────
say "pushing ${LOCAL_BRANCH} → ${DEFAULT_BRANCH} on ${OWNER_REPO}"
git push -u "$NEW_REMOTE" "${LOCAL_BRANCH}:${DEFAULT_BRANCH}"

# ─── Create + push the release tag ──────────────────────────────────────
if git rev-parse "$TAG" >/dev/null 2>&1; then
  say "tag ${TAG} exists locally"
else
  git tag -a "$TAG" -m "Release Candidate 1"
  say "tag ${TAG} created"
fi
git push "$NEW_REMOTE" "$TAG"

# ─── Best-effort: set default branch via gh ─────────────────────────────
if command -v gh >/dev/null 2>&1; then
  say "setting default branch to '${DEFAULT_BRANCH}'"
  gh api -X PATCH "repos/${OWNER_REPO}" -f "default_branch=${DEFAULT_BRANCH}" >/dev/null || true
fi

COMMIT_SHA=$(git rev-parse HEAD)

cat <<EOF

──────────────────────────────────────────────────────────────────────────
✔ mirror complete — verification links

  New repo   : https://github.com/${OWNER_REPO}
  main HEAD  : https://github.com/${OWNER_REPO}/commit/${COMMIT_SHA}
  Tag        : https://github.com/${OWNER_REPO}/releases/tag/${TAG}
  Actions    : https://github.com/${OWNER_REPO}/actions
  Branches   : https://github.com/${OWNER_REPO}/settings/branches
  Secrets    : https://github.com/${OWNER_REPO}/settings/secrets/actions

Next:
  1. Wait for the first Actions run at the URL above to go GREEN.
  2. Add the branch-protection rule for 'main' (require PR + require the
     'build-and-test' status check + no bypass).
  3. In Secrets, add REDIS_URL, JWT_SECRET, COPY_SIGNING_KEY,
     DOWNLOAD_URL_SECRET, MAIL_FROM, SMTP_HOST/USER/PASS for the
     production deploy — CI itself uses non-secret defaults.
  4. Keep the old repo intact until step 1 has gone green at least once
     and you have a local backup of the new one.
──────────────────────────────────────────────────────────────────────────
EOF
