import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import scipy.io as sio


BASE_DIR = Path(__file__).resolve().parents[1]


def extract_axis(struct_array):
    if "axisscale" not in struct_array.dtype.names:
        return None

    axis_cell = struct_array["axisscale"][0, 0]
    axis_matrix = np.asarray(axis_cell)

    if axis_matrix.shape[0] > 1 and axis_matrix.shape[1] > 0:
        axis = np.asarray(axis_matrix[1, 0]).ravel()
        if axis.size:
            return axis.astype(np.float64)

    return None


def extract_data(struct_array):
    if "data" not in struct_array.dtype.names:
        return None

    data = np.asarray(struct_array["data"][0, 0])
    if data.ndim != 2:
        return None

    return data.astype(np.float64)


def load_spectral_datasets(mat_path):
    mat = sio.loadmat(str(mat_path))
    datasets = {}

    for name, value in mat.items():
        if name.startswith("__"):
            continue

        arr = np.asarray(value)
        if arr.dtype.names is None:
            continue

        data = extract_data(arr)
        if data is None:
            continue

        axis = extract_axis(arr)
        datasets[name] = {"data": data, "axis": axis}

    return datasets


def main():
    parser = argparse.ArgumentParser(description="Read and plot spectra from corn.mat")
    parser.add_argument("--mat", default="corn.mat", help="Path to corn.mat")
    parser.add_argument("--dataset", default="m5spec", help="Dataset name (e.g. m5spec, mp5spec, mp6spec, m5nbs)")
    parser.add_argument("--sample", type=int, default=0, help="Sample index (0-based)")
    parser.add_argument("--save", default=None, help="Optional PNG output path")
    parser.add_argument("--no-show", action="store_true", help="Do not open plot window")
    args = parser.parse_args()

    mat_path = Path(args.mat)
    if not mat_path.is_absolute():
        mat_path = (BASE_DIR / mat_path).resolve()
    else:
        mat_path = mat_path.resolve()
    if not mat_path.exists():
        raise FileNotFoundError(f"MAT file not found: {mat_path}")

    datasets = load_spectral_datasets(mat_path)
    if not datasets:
        raise ValueError("No spectral datasets found in this MAT file")

    if args.dataset not in datasets:
        available = ", ".join(sorted(datasets.keys()))
        raise ValueError(f"Dataset '{args.dataset}' not found. Available: {available}")

    data = datasets[args.dataset]["data"]
    axis = datasets[args.dataset]["axis"]

    if args.sample < 0 or args.sample >= data.shape[0]:
        raise IndexError(f"Sample index out of range: 0..{data.shape[0]-1}")

    y = np.asarray(data[args.sample], dtype=np.float64)
    if axis is None or axis.size != y.size:
        x = np.arange(y.size, dtype=np.float64)
    else:
        x = np.asarray(axis, dtype=np.float64)

    plt.figure(figsize=(10, 5))
    plt.plot(x, y, linewidth=1.4)
    plt.title(f"{args.dataset} sample {args.sample}")
    plt.xlabel("Wavelength / Wavenumber")
    plt.ylabel("Intensity")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    if args.save:
        save_path = Path(args.save)
        if not save_path.is_absolute():
            save_path = (BASE_DIR / save_path).resolve()
        else:
            save_path = save_path.resolve()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150)
        print(f"Saved plot to: {save_path}")

    if not args.no_show:
        plt.show()


if __name__ == "__main__":
    main()
