import argparse
from pathlib import Path

import numpy as np
import scipy.io as sio


BASE_DIR = Path(__file__).resolve().parents[1]


def _extract_axis_from_struct(struct_array):
	if "axisscale" not in struct_array.dtype.names:
		return None

	axis_cell = struct_array["axisscale"][0, 0]
	axis_matrix = np.asarray(axis_cell)

	if axis_matrix.shape[0] > 1 and axis_matrix.shape[1] > 0:
		candidate = np.asarray(axis_matrix[1, 0]).ravel()
		if candidate.size:
			return candidate.astype(np.float64)

	return None


def _extract_data_from_struct(struct_array):
	if "data" not in struct_array.dtype.names:
		return None

	data = np.asarray(struct_array["data"][0, 0])
	if data.ndim != 2:
		return None

	return data.astype(np.float64)


def _iter_spectral_datasets(mat_dict):
	excluded_names = {"propvals", "information"}

	for name, value in mat_dict.items():
		if name.startswith("__"):
			continue
		if name.lower() in excluded_names:
			continue

		arr = np.asarray(value)
		if arr.dtype.names is None:
			continue

		data = _extract_data_from_struct(arr)
		if data is None:
			continue

		axis = _extract_axis_from_struct(arr)
		yield name, data, axis


def export_mat_spectra_to_csv(mat_file: Path, out_dir: Path):
	mat_dict = sio.loadmat(str(mat_file))
	out_dir.mkdir(parents=True, exist_ok=True)

	exported_count = 0

	for dataset_name, data, axis in _iter_spectral_datasets(mat_dict):
		dataset_dir = out_dir / dataset_name
		dataset_dir.mkdir(parents=True, exist_ok=True)

		n_samples, n_features = data.shape
		if axis is None or axis.size != n_features:
			axis_values = np.arange(n_features, dtype=np.float64)
			axis_label = "feature_index"
		else:
			axis_values = axis
			axis_label = "wavenumber"

		for sample_idx in range(n_samples):
			sample = data[sample_idx]
			rows = np.column_stack((axis_values, sample))

			out_path = dataset_dir / f"sample_{sample_idx + 1:04d}.csv"
			np.savetxt(
				out_path,
				rows,
				delimiter=",",
				header=f"{axis_label},intensity",
				comments="",
				fmt="%.10g",
			)
			exported_count += 1

		print(f"{dataset_name}: exported {n_samples} files to {dataset_dir}")

	if exported_count == 0:
		raise ValueError("No spectral datasets with a 'data' field were found in the MAT file.")

	print(f"Done. Exported {exported_count} CSV files to {out_dir}")


def main():
	parser = argparse.ArgumentParser(
		description="Extract spectra from corn.mat and export one CSV file per sample."
	)
	parser.add_argument(
		"--mat-file",
		default="corn.mat",
		help="Path to input MAT file (default: corn.mat)",
	)
	parser.add_argument(
		"--out-dir",
		default="extracted_csv",
		help="Output directory for exported CSV files (default: extracted_csv)",
	)

	args = parser.parse_args()

	mat_file = Path(args.mat_file)
	out_dir = Path(args.out_dir)

	if not mat_file.is_absolute():
		mat_file = (BASE_DIR / mat_file).resolve()
	if not out_dir.is_absolute():
		out_dir = (BASE_DIR / out_dir).resolve()

	if not mat_file.exists():
		raise FileNotFoundError(f"MAT file not found: {mat_file}")

	export_mat_spectra_to_csv(mat_file, out_dir)


if __name__ == "__main__":
	main()
