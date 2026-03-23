# offline-dev organization

This folder is organized into:

- **Core training pipeline (root)**
  - `training.py`
  - `training_config.py`
  - `data_utils.py`
  - `evaluation_utils.py`
  - `models/`
  - `config/`
- **Utility + visualization scripts**
  - `scripts/extract_spectra.py`
  - `scripts/split_regression_csv_samples.py`
  - `scripts/plot_regression_samples.py`
  - `scripts/plot_corn_mat.py`
  - `scripts/view_spectra.py`
- **Data/assets**
  - `corn.mat`
  - `corn_mp5_regression_data.csv`
  - `corn_mp5_samples/`
  - `extracted_csv/`
  - `extracted_csv_clean/`
  - `plots/`

## Common commands

From `offline-dev`:

```powershell
python training.py
python scripts/split_regression_csv_samples.py
python scripts/plot_regression_samples.py
python scripts/extract_spectra.py
python scripts/plot_corn_mat.py --dataset mp5spec --sample 0
python scripts/view_spectra.py corn_mp5_samples/sample_0001.csv
```

> Note: moved scripts resolve default paths against the `offline-dev` root.
