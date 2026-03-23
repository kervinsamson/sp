# FastAPI Backend (Spectrum Preview)

This backend provides the endpoint used by the frontend to display uploaded `.spa` / `.csv` spectra.

## Endpoints

- `GET /health`
- `POST /api/preview-spectrum` with multipart field `spectral_data`

## Setup

From `corn-classifier/backend`:

```powershell
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend config

In `corn-classifier`, create `.env.local` (or copy `.env.local.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_PREVIEW_API=false
NEXT_PUBLIC_USE_MOCK_ANALYZE_API=true
```

This enables real backend preview while keeping mock analysis enabled.
