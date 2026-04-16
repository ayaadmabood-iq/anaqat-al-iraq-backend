# ============================================================================
#  Anaqat Al-Iraq — One-shot GitHub deploy script
#  Target account: ayaadmabood-iq
#
#  Run from an elevated or normal PowerShell in this folder:
#      PS> .\deploy-to-github.ps1
#
#  Requirements on your Windows machine (any one of):
#    A) GitHub CLI installed and authenticated:   winget install --id GitHub.cli
#         then:   gh auth login
#       The script will create the remote repo for you automatically.
#    B) Or: create the repo manually first at
#         https://github.com/new  (owner: ayaadmabood-iq,
#                                   name : anaqat-al-iraq-backend,
#                                   visibility: your choice,
#                                   DO NOT initialize with README/LICENSE/.gitignore)
#       Then re-run this script — it will skip creation and just push.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Owner       = 'ayaadmabood-iq'
$RepoName    = 'anaqat-al-iraq-backend'
$Description = 'NestJS backend for Anaqat Al-Iraq — Iraqi clothing store inventory and sales management API (Arabic/English, JWT, TypeORM, PostgreSQL).'
$Branch      = 'main'
$CommitMsg   = 'Initial commit – production-ready version'
$RepoUrlHttps = "https://github.com/$Owner/$RepoName.git"
$RepoUrlWeb   = "https://github.com/$Owner/$RepoName"

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "OK  $msg"  -ForegroundColor Green }
function Warn($msg) { Write-Host "\!\!  $msg"  -ForegroundColor Yellow }
function Die($msg)  { Write-Host "ERR $msg"  -ForegroundColor Red; exit 1 }

# --- sanity ------------------------------------------------------------------
Step 'Verifying working directory'
if (-not (Test-Path -LiteralPath 'package.json')) {
    Die "package.json not found. Run this script from the 'backend' folder."
}
if (-not (Test-Path -LiteralPath '.gitignore')) {
    Die ".gitignore missing. Aborting to avoid leaking files."
}
if (-not (Test-Path -LiteralPath 'LICENSE')) {
    Die 'LICENSE missing.'
}
if (-not (Test-Path -LiteralPath '.env.example')) {
    Die '.env.example missing.'
}

# --- secret leak check -------------------------------------------------------
Step 'Checking that no .env or secret files are tracked'
if (Test-Path -LiteralPath '.env') {
    Ok "'.env' exists locally and is ignored by .gitignore (will NOT be pushed)."
}

# --- git presence ------------------------------------------------------------
Step 'Checking git'
$null = git --version
if ($LASTEXITCODE -ne 0) { Die 'git is not installed or not on PATH.' }

# --- nuke any partial .git from the sandbox attempt --------------------------
if (Test-Path -LiteralPath '.git') {
    Step 'Removing previous .git directory (clean start)'
    Remove-Item -Recurse -Force .git
}

# --- init --------------------------------------------------------------------
Step "Initializing fresh git repo on branch '$Branch'"
git init -b $Branch | Out-Null
git config user.name  "Ayaad M. Abood"
git config user.email "ayaad.m.abood@uobasrah.edu.iq"
git config core.autocrlf input

# --- stage & commit ----------------------------------------------------------
Step 'Staging files'
git add -A

Step 'Verifying .env is NOT staged'
$staged = git diff --cached --name-only
if ($staged -match '^\.env$') { Die 'FATAL: .env is staged. Aborting.' }
if ($staged -match 'node_modules') { Die 'FATAL: node_modules is staged. Aborting.' }
if ($staged -match '^dist/') { Die 'FATAL: dist/ is staged. Aborting.' }

Step 'Creating initial commit'
git commit -m $CommitMsg | Out-Null
Ok  'Commit created.'

# --- create remote repo via gh (optional) ------------------------------------
$ghAvailable = $false
try { $null = gh --version 2>$null; if ($LASTEXITCODE -eq 0) { $ghAvailable = $true } } catch {}

if ($ghAvailable) {
    Step 'Checking if remote repo already exists'
    gh repo view "$Owner/$RepoName" 2>$null 1>$null
    if ($LASTEXITCODE -ne 0) {
        Step "Creating remote repo $Owner/$RepoName via GitHub CLI"
        gh repo create "$Owner/$RepoName" --public --description "$Description" --source . --remote origin --push
        if ($LASTEXITCODE -ne 0) { Die 'gh repo create failed.' }
        Ok 'Repo created and pushed via gh.'
    } else {
        Warn 'Remote repo already exists — will just push.'
        git remote add origin $RepoUrlHttps 2>$null
        git push -u origin $Branch
    }
} else {
    Warn "GitHub CLI ('gh') not found."
    Write-Host ''
    Write-Host "Create the repo manually at: https://github.com/new" -ForegroundColor Yellow
    Write-Host "  Owner:       $Owner"
    Write-Host "  Repository:  $RepoName"
    Write-Host "  Description: $Description"
    Write-Host "  IMPORTANT:   Do NOT initialize with README/LICENSE/.gitignore"
    Write-Host ''
    Read-Host 'Press ENTER once the empty repo is created on GitHub'

    Step 'Adding remote origin'
    git remote remove origin 2>$null
    git remote add origin $RepoUrlHttps

    Step "Pushing to $RepoUrlHttps"
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { Die 'git push failed. Check credentials.' }
}

Ok 'Deployment complete.'
Write-Host ''
Write-Host "Repository URL : $RepoUrlWeb" -ForegroundColor Green
Write-Host "Clone (HTTPS)  : $RepoUrlHttps" -ForegroundColor Green
