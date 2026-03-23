# Corn Classifier

Frontend: Next.js (port 3000)  
Backend: FastAPI + Uvicorn (port 8000)

## Prerequisites

- Node.js 20+
- Python 3.10+

## From fresh clone (Windows PowerShell)

```powershell
git clone <your-repo-url>
cd corn-classifier
npm install
npm run setup:dev
npm run dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`

## One-command setup (recommended)

From `corn-classifier`:

```powershell
npm run setup:dev
```

Then start development:

```powershell
npm run dev
```

## First-time setup (Windows PowerShell)

From `corn-classifier`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\backend\requirements.txt
npm install
```

If script execution is blocked:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

## Environment file

Create `.env.local` in `corn-classifier`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_PREVIEW_API=false
NEXT_PUBLIC_USE_MOCK_ANALYZE_API=true
```

## Run dev

```powershell
npm run dev
```

This starts both:
- Next.js frontend (`http://localhost:3000`)
- FastAPI backend (`http://localhost:8000`)

## Troubleshooting

- Run commands from `corn-classifier` (repo root), not its parent folder.
- If PowerShell blocks scripts, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

- If setup fails, rerun:

```powershell
npm run setup:dev
```
