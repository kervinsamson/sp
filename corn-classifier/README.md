# Corn Classifier

Frontend: Next.js (port 3000)  
Backend: FastAPI + Uvicorn (port 8000)

## Prerequisites

- Node.js 20+
- Python 3.10+

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
