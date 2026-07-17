#!/usr/bin/env bash
#
# Mirror the current tree to the new repository at $1.
#
# See docs/MIGRATE-TO-NEW-REPO.md for the human context.
#
# Usage:
#   bash scripts/mirror-to-new-repo.sh https://github.com/OWNER/al-qasdi-project.git
#
# Safe to re-run — the remote is upserted, the tag is force-updated only if
# it does not already exist upstream.
#
set -euo pipefail

REMOTE_URL="${1:?usage: mirror-to-new-repo.sh <new-repo-url>}"
NEW_REMOTE="al-qasdi"
DEFAULT_BRANCH="main"
LOCAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TAG="${TAG:-v1.0.0-rc1}"

echo "▶ mirroring branch '$LOCAL_BRANCH' → $REMOTE_URL as '$DEFAULT_BRANCH'"
echo "▶ tag: $TAG"

# 1) Upsert the remote.
if git remote get-url "$NEW_REMOTE" >/dev/null 2>&1; then
  git remote set-url "$NEW_REMOTE" "$REMOTE_URL"
else
  git remote add "$NEW_REMOTE" "$REMOTE_URL"
fi

# 2) Push HEAD to `main`.
git push -u "$NEW_REMOTE" "$LOCAL_BRANCH":"$DEFAULT_BRANCH"

# 3) Create + push the release tag.
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "  tag $TAG already exists locally"
else
  git tag -a "$TAG" -m "Release Candidate 1"
fi
git push "$NEW_REMOTE" "$TAG"

# 4) If gh is available, set default branch + hint at branch protection.
if command -v gh >/dev/null 2>&1; then
  OWNER_REPO="$(echo "$REMOTE_URL" | sed -E 's|^https://github.com/||; s|\.git$||')"
  echo "▶ setting default branch to '$DEFAULT_BRANCH' via gh"
  gh api -X PATCH "repos/${OWNER_REPO}" -f default_branch="$DEFAULT_BRANCH" >/dev/null || true
  echo "▶ open the following URL to add the branch-protection rule:"
  echo "  https://github.com/${OWNER_REPO}/settings/branches"
else
  echo "▶ gh CLI not found — set default branch to '$DEFAULT_BRANCH' from"
  echo "  the new repo's Settings tab and add a branch-protection rule."
fi

echo ""
echo "✔ done. Next steps:"
echo "  • https://github.com/${OWNER_REPO:-your-owner/al-qasdi-project}/actions  (first CI run)"
echo "  • https://github.com/${OWNER_REPO:-your-owner/al-qasdi-project}/tags   (v1.0.0-rc1)"
echo "  • see docs/MIGRATE-TO-NEW-REPO.md for branch-protection + access grants"
