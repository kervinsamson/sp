# Backend Integration Guide

## Current Structure

The frontend has been refactored into a modular architecture that makes backend integration simple and straightforward.

### Directory Structure

```
app/
├── components/          # Reusable UI components
│   ├── ScreenInput.tsx
│   ├── ScreenProcessing.tsx
│   └── ScreenResult.tsx
├── services/           # API/Backend services
│   └── api.ts         # ⭐ Main integration point
├── types/             # TypeScript type definitions
│   └── index.ts
└── page.tsx           # Main application page
```

## How to Integrate Your Backend

### Step 1: Update API Configuration

In [`app/services/api.ts`](app/services/api.ts), configure mock toggles via env variables:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USE_MOCK_PREVIEW_API = (process.env.NEXT_PUBLIC_USE_MOCK_PREVIEW_API ?? "true") === "true";
const USE_MOCK_ANALYZE_API = (process.env.NEXT_PUBLIC_USE_MOCK_ANALYZE_API ?? "true") === "true";
```

### Step 2: Set Environment Variable (Optional)

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_PREVIEW_API=false
NEXT_PUBLIC_USE_MOCK_ANALYZE_API=true
```

Use `NEXT_PUBLIC_USE_MOCK_PREVIEW_API=false` to enable real spectrum preview from FastAPI while keeping analysis in mock mode.

### Step 3: Backend API Requirements

Your backend should provide this endpoint:

**Endpoint:** `POST /api/analyze`

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `model`: File (your .h5 or .pkl model)
  - `spectral_data`: File (your .spa or .csv data)

**Response (JSON):**
```json
{
  "isBt": true,
  "confidence": 96.7,
  "inferenceTime": 4.2,
  "dataPoints": 601,
  "wavelengthRange": "4000 - 10000 cm⁻¹",
  "spectrum": [
    { "wavelength": 4000, "intensity": 0.6123 },
    { "wavelength": 4010, "intensity": 0.6089 }
  ],
  "spectrumMeta": {
    "xUnit": "cm⁻¹",
    "yUnit": "Absorbance",
    "preprocessing": "Savitzky-Golay smoothing"
  }
}
```

`spectrum` should be normalized for both `.csv` and `.spa` uploads so the frontend can render a single waveform chart implementation.

For immediate chart display right after upload, provide:

**Endpoint:** `POST /api/preview-spectrum`

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `spectral_data`: File (your `.spa` or `.csv` input)

**Response (JSON):**
```json
{
  "dataPoints": 601,
  "wavelengthRange": "4000 - 10000 cm⁻¹",
  "spectrum": [
    { "wavelength": 4000, "intensity": 0.6123 },
    { "wavelength": 4010, "intensity": 0.6089 }
  ],
  "spectrumMeta": {
    "xUnit": "cm⁻¹",
    "yUnit": "Absorbance",
    "preprocessing": "Raw upload preview"
  }
}
```

### Step 4: Uncomment Real API Code

In [`app/services/api.ts`](app/services/api.ts), find the `analyzeSpectralData` function and uncomment the real API implementation:

```typescript
export async function analyzeSpectralData(
  request: AnalysisRequest,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> {
  if (USE_MOCK_API) {
    return mockAnalyzeSpectralData(request, onProgress);
  }

  // Uncomment this section:
  const formData = new FormData();
  formData.append("model", request.modelFile);
  formData.append("spectral_data", request.spectralFile);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  const result: AnalysisResponse = await response.json();
  return result;
}
```

## FastAPI Backend Location

A working backend implementation is included in [`backend/main.py`](backend/main.py).

Start it from `corn-classifier/backend`:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Example FastAPI Backend Structure

```python
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow CORS from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze(
    model: UploadFile = File(...),
    spectral_data: UploadFile = File(...)
):
    # Your ML processing logic here
    
    return {
        "isBt": True,
        "confidence": 96.7,
        "inferenceTime": 4.2,
        "dataPoints": 601,
      "wavelengthRange": "4000 - 10000 cm⁻¹",
      "spectrum": [
        {"wavelength": 4000, "intensity": 0.6123},
        {"wavelength": 4010, "intensity": 0.6089}
      ],
      "spectrumMeta": {
        "xUnit": "cm⁻¹",
        "yUnit": "Absorbance",
        "preprocessing": "Savitzky-Golay smoothing"
      }
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
```

## Benefits of This Architecture

✅ **Separation of Concerns**: UI components are independent of data fetching  
✅ **Easy Testing**: Mock API can be toggled on/off  
✅ **Type Safety**: Full TypeScript support with shared types  
✅ **Maintainable**: Changes to API only require updating one file  
✅ **Flexible**: Easy to add authentication, error handling, etc.  

## Testing

1. **With Mock Data** (default): Just run the app
2. **With Real Backend**: 
   - Start your backend server
   - Set `USE_MOCK_API = false` in `api.ts`
   - Test the full integration

## Additional Features You Can Add

- **Progress Updates**: For long-running tasks, use WebSockets or Server-Sent Events
- **Error Handling**: Enhanced error messages and retry logic
- **Authentication**: Add JWT tokens to API requests
- **File Validation**: Client-side validation before upload
- **Caching**: Cache results for identical inputs
