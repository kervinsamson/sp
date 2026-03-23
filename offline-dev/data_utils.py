import os

import numpy as np
import spectrochempy as scp
from scipy.signal import savgol_filter
from sklearn.model_selection import train_test_split


def read_spectrum_file(filepath):
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".spa":
        dataset = scp.read_omnic(filepath)
        raw = np.asarray(dataset.data)
        if raw.ndim == 1:
            spectrum = raw
        else:
            spectrum = raw[0]
        return np.ravel(spectrum).astype(np.float64)

    if ext == ".csv":
        raw = np.genfromtxt(filepath, delimiter=",", dtype=np.float64)

        if raw.ndim == 0:
            raise ValueError(f"Unable to parse CSV spectrum: {filepath}")

        if raw.ndim == 1:
            spectrum = raw
        else:
            finite_cols = [idx for idx in range(raw.shape[1]) if np.isfinite(raw[:, idx]).sum() > 0]
            if not finite_cols:
                raise ValueError(f"CSV has no numeric columns: {filepath}")
            numeric = raw[:, finite_cols]
            if numeric.shape[1] == 1:
                spectrum = numeric[:, 0]
            else:
                spectrum = numeric[:, -1]

        spectrum = np.asarray(spectrum, dtype=np.float64)
        spectrum = spectrum[np.isfinite(spectrum)]

        if spectrum.size == 0:
            raise ValueError(f"CSV produced empty spectrum after cleaning: {filepath}")

        return spectrum

    raise ValueError(f"Unsupported file type: {filepath}")


def load_labeled_spectral_files(directory, label):
    spectra = []
    labels = []

    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Directory not found: {directory}")

    for filename in sorted(os.listdir(directory)):
        if filename.lower().endswith((".spa", ".csv")):
            filepath = os.path.join(directory, filename)
            spectrum = read_spectrum_file(filepath)
            spectra.append(spectrum)
            labels.append(label)

    if not spectra:
        raise ValueError(f"No .spa or .csv files found in: {directory}")

    lengths = {spec.shape[0] for spec in spectra}
    if len(lengths) != 1:
        raise ValueError(f"Inconsistent spectral lengths in {directory}: {sorted(lengths)}")

    return np.array(spectra), np.array(labels)


def load_bt_nonbt_dataset(bt_dir, non_bt_dir):
    x_bt, y_bt = load_labeled_spectral_files(bt_dir, label=1)
    x_non_bt, y_non_bt = load_labeled_spectral_files(non_bt_dir, label=0)

    if x_bt.shape[1] != x_non_bt.shape[1]:
        raise ValueError(
            f"Feature mismatch: Bt has {x_bt.shape[1]} points, Non-Bt has {x_non_bt.shape[1]} points"
        )

    x = np.vstack([x_bt, x_non_bt])
    y = np.concatenate([y_bt, y_non_bt])
    return x, y


def preprocess_and_split(
    x,
    y,
    random_state=42,
    test_size=0.20,
    sg_window_length=11,
    sg_polyorder=2,
    sg_deriv=0,
    sg_axis=1,
):
    x_preprocessed = savgol_filter(
        x,
        window_length=sg_window_length,
        polyorder=sg_polyorder,
        deriv=sg_deriv,
        axis=sg_axis,
    )

    x_train, x_test, y_train, y_test = train_test_split(
        x_preprocessed,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )
    return x_train, x_test, y_train, y_test
