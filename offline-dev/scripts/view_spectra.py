import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import spectrochempy as scp


def read_spa(path):
    dataset = scp.read_omnic(str(path))
    y = np.asarray(dataset.data)
    y = np.ravel(y if y.ndim == 1 else y[0]).astype(np.float64)

    x = None
    if hasattr(dataset, "x") and dataset.x is not None:
        try:
            x = np.asarray(dataset.x.data, dtype=np.float64).ravel()
        except Exception:
            x = None

    if x is None or x.size != y.size:
        x = np.arange(y.size, dtype=np.float64)

    return x, y


def read_csv(path):
    raw = np.genfromtxt(path, delimiter=",", dtype=np.float64)

    if raw.ndim == 0:
        raise ValueError(f"Could not parse CSV: {path}")

    if raw.ndim == 1:
        y = raw[np.isfinite(raw)]
        x = np.arange(y.size, dtype=np.float64)
        return x, y

    finite_cols = [i for i in range(raw.shape[1]) if np.isfinite(raw[:, i]).sum() > 0]
    if not finite_cols:
        raise ValueError(f"No numeric data in CSV: {path}")

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
        raise ValueError(f"CSV has no valid points: {path}")

    return x, y


def load_spectrum(path):
    ext = path.suffix.lower()
    if ext == ".spa":
        return read_spa(path)
    if ext == ".csv":
        return read_csv(path)
    raise ValueError("Only .spa and .csv are supported")


def main():
    parser = argparse.ArgumentParser(description="Simple spectrum viewer for .spa/.csv")
    parser.add_argument("path", help="Path to .spa or .csv file")
    args = parser.parse_args()

    path = Path(args.path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    x, y = load_spectrum(path)

    plt.figure(figsize=(10, 5))
    plt.plot(x, y, linewidth=1.5)
    plt.title(path.name)
    plt.xlabel("Wavelength / Wavenumber")
    plt.ylabel("Intensity")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
