# Migrating the project to `al-qasdi-project` — المشروع القصدي

The Claude Code integration in this session does not have permission to
create repositories on the user's GitHub account (the request returns
`403 Resource not accessible by integration`). The user must therefore
create the empty repository themselves; every remaining step is scripted.

## Step 1 — Create the empty repo (30 seconds, on github.com)

1. Sign in to https://github.com/ayaadmabood-iq
2. Open https://github.com/new
3. Repository name: **`al-qasdi-project`**
4. Description: **`المشروع القصدي — منصة معرفية للنشر والبحث والدراسات القرآنية والإنسانية`**
5. Visibility: **Private** (recommended) or **Public** if you want to
   invite reviewers.
6. **Do NOT** initialize with README / .gitignore / license — the current
   repository already has them, and re-initialising creates a merge
   conflict on the first push.
7. Click **Create repository**. Ignore the setup instructions on the
   landing page — the mirror script below covers them.

## Step 2 — Grant the Claude Code integration access to the new repo

The integration is scoped per-repository. On the same GitHub Settings
page where you installed the Claude Code GitHub App, tick
`al-qasdi-project` in the repository selector and save. That lets
subsequent sessions push tags and open PRs against the new repo.

## Step 3 — Mirror the current work to the new repo (one command)

From this session's working tree:

```bash
bash scripts/mirror-to-new-repo.sh \
  https://github.com/ayaadmabood-iq/al-qasdi-project.git
```

The script:
- adds the new remote,
- pushes `claude/project-mvp-design-tuuz11` → `main` on the new repo,
- creates and pushes the tag `v1.0.0-rc1`,
- sets `main` as the default branch (via `gh` if available),
- prints the URLs to check for the first CI run.

## Step 4 — Enable branch protection on `main`

On the new repo → Settings → Branches → Add rule for `main`:

- Require a pull request before merging: **on**
- Require status checks to pass before merging: **on**
  - Add `build-and-test` (the job name from `.github/workflows/ci.yml`)
- Do not allow bypassing the above settings: **on**
- Restrict pushes that create files: leave default

Save. Every subsequent change must go through a PR that runs CI to green.

## Step 5 — Verify

- Open the Actions tab; the first push should have triggered CI.
- Confirm the tag `v1.0.0-rc1` appears in Releases.
- Confirm the audit gate step is not skipped and did not exit non-zero.

## Why the old repo stays until migration is verified

The migration script does NOT delete `anaqat-al-iraq-backend`. Only after
the CI on `al-qasdi-project` has gone green once and you have downloaded
a copy of the new repo, you may **archive** the old one from GitHub
Settings → Danger Zone. Do not delete it.

## What the mirror script guarantees before pushing

The script refuses to run if any of these hold:

- the working tree has uncommitted changes;
- any tracked file matches a secret-shaped pattern (`.env`, `.env.*`
  other than `.env.example`, `storage/keys/**`, `storage/mail-outbox/**`,
  `storage/generated/**`, `storage/transfers/**`, `*.pem`, `*.key`,
  `*.pfx`, `id_rsa`, `id_ed25519`);
- `gh` is installed AND the destination repo is Public (must be Private).

You should still eyeball the last commit's file list before authorising
the push — the guard is safety net, not policy.

## After the push — send back

Once the first CI run is green, please share:

- the repo URL: `https://github.com/ayaadmabood-iq/al-qasdi-project`
- the successful Actions run URL
- the commit SHA on `main`
- the tag URL: `.../releases/tag/v1.0.0-rc1`
- confirmation that branch protection on `main` is enabled

Then we consider `v1.0.0-rc1` formally delivered.
