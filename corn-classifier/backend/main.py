from __future__ import annotations

import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Literal

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class SpectrumPoint(BaseModel):
    wavelength: float
    intensity: float


class SpectrumMeta(BaseModel):
    xUnit: str | None = None
    yUnit: str | None = None
    preprocessing: str | None = None


class SpectrumPreviewResponse(BaseModel):
    dataPoints: int
    wavelengthRange: str
    spectrum: list[SpectrumPoint]
    spectrumMeta: SpectrumMeta


app = FastAPI(title="Corn Classifier API", version="0.1.0")


def _get_cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_spa(path: Path) -> tuple[np.ndarray, np.ndarray]:
    try:
        import spectrochempy as scp
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail=(
                "Reading .spa files requires spectrochempy. "
                "Install it in your backend environment first."
            ),
        ) from exc

    try:
        dataset = scp.read_omnic(str(path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not parse SPA file: {path.name}. "
                "The file may be corrupted or in an unsupported OMNIC variant."
            ),
        ) from exc

    if dataset is None or getattr(dataset, "data", None) is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not parse SPA file: {path.name}. "
                "No spectral data was found in the uploaded file."
            ),
        )

    y = np.asarray(dataset.data)
    if y.size == 0:
        raise HTTPException(
            status_code=400,
            detail=f"SPA file has no data points: {path.name}",
        )

    y = np.ravel(y if y.ndim == 1 else y[0]).astype(np.float64)
    y = y[np.isfinite(y)]

    if y.size == 0:
        raise HTTPException(
            status_code=400,
            detail=f"SPA file has no valid numeric points: {path.name}",
        )

    x = None
    if hasattr(dataset, "x") and dataset.x is not None:
        try:
            x = np.asarray(dataset.x.data, dtype=np.float64).ravel()
        except Exception:
            x = None

    if x is None or x.size != y.size:
        x = np.arange(y.size, dtype=np.float64)

    return x, y


def _read_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    raw = np.genfromtxt(path, delimiter=",", dtype=np.float64)

    if raw.ndim == 0:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {path.name}")

    if raw.ndim == 1:
        y = raw[np.isfinite(raw)]
        x = np.arange(y.size, dtype=np.float64)
        if y.size == 0:
            raise HTTPException(status_code=400, detail=f"CSV has no valid points: {path.name}")
        return x, y

    finite_cols = [i for i in range(raw.shape[1]) if np.isfinite(raw[:, i]).sum() > 0]
    if not finite_cols:
        raise HTTPException(status_code=400, detail=f"No numeric data in CSV: {path.name}")

    numeric = raw[:, finite_cols]
    if numeric.shape[1] == 1:
        y = numeric[:, 0]
        x = np.arange(y.size, dtype=np.float64)
    else:
        x = numeric[:, 0]
        y = numeric[:, -1]

    valid = np.isfinite(x) & np.isfinite(y)
    x = np.asarray(x[valid], dtype=np.float64)
    y = np.asarray(y[valid], dtype=np.float64)

    if y.size == 0:
        raise HTTPException(status_code=400, detail=f"CSV has no valid points: {path.name}")

    return x, y


def _load_spectrum(path: Path) -> tuple[np.ndarray, np.ndarray]:
    ext = path.suffix.lower()
    if ext == ".spa":
        return _read_spa(path)
    if ext == ".csv":
        return _read_csv(path)
    raise HTTPException(status_code=400, detail="Only .spa and .csv files are supported")


def _to_response(x: np.ndarray, y: np.ndarray, preprocessing: str) -> SpectrumPreviewResponse:
    points = [
        SpectrumPoint(wavelength=float(wavelength), intensity=float(intensity))
        for wavelength, intensity in zip(x.tolist(), y.tolist(), strict=False)
    ]

    if len(points) == 0:
        raise HTTPException(status_code=400, detail="No spectrum points parsed from uploaded file")

    x_min = float(np.min(x))
    x_max = float(np.max(x))
    wavelength_range = f"{x_min:.0f} - {x_max:.0f} cm⁻¹"

    return SpectrumPreviewResponse(
        dataPoints=len(points),
        wavelengthRange=wavelength_range,
        spectrum=points,
        spectrumMeta=SpectrumMeta(
            xUnit="cm⁻¹",
            yUnit="Absorbance",
            preprocessing=preprocessing,
        ),
    )


async def _save_upload_temp(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "uploaded").suffix.lower()
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(await upload.read())
        return Path(temp_file.name)


@app.get("/health")
def health() -> dict[Literal["status"], Literal["ok"]]:
    return {"status": "ok"}


@app.post("/api/preview-spectrum", response_model=SpectrumPreviewResponse)
async def preview_spectrum(spectral_data: UploadFile = File(...)) -> SpectrumPreviewResponse:
    temp_path = await _save_upload_temp(spectral_data)
    try:
        x, y = _load_spectrum(temp_path)
        return _to_response(x, y, preprocessing="Raw upload preview")
    finally:
        temp_path.unlink(missing_ok=True)
