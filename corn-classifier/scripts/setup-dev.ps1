param(
    [switch]$RecreateVenv,
    [switch]$SkipNpmInstall,
    [switch]$SkipPipInstall
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

function Resolve-PythonCommand {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }

    if (Get-Command py -ErrorAction SilentlyContinue) {
        return "py -3"
    }

    throw "Python is not installed or not on PATH. Install Python 3.10+ and retry."
}

$venvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if ($RecreateVenv -and (Test-Path ".venv")) {
    Remove-Item -Recurse -Force ".venv"
}

if (-not (Test-Path $venvPython)) {
    $pythonCommand = Resolve-PythonCommand
    Write-Host "Creating virtual environment at .venv ..."
    Invoke-Expression "$pythonCommand -m venv .venv"
}

if (-not $SkipPipInstall) {
    Write-Host "Installing backend Python dependencies ..."
    & $venvPython -m pip install -r ".\backend\requirements.txt"
}

if (-not $SkipNpmInstall) {
    Write-Host "Installing frontend dependencies ..."
    npm install
}

$envPath = Join-Path $RepoRoot ".env.local"
if (-not (Test-Path $envPath)) {
    @"
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_PREVIEW_API=false
NEXT_PUBLIC_USE_MOCK_ANALYZE_API=true
"@ | Set-Content -Path $envPath -Encoding UTF8
    Write-Host "Created .env.local"
} else {
    Write-Host ".env.local already exists (left unchanged)."
}

Write-Host "Setup complete. Run: npm run dev"
