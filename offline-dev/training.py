import os
import numpy as np
import pickle
from pathlib import Path
import tensorflow as tf

from data_utils import load_bt_nonbt_dataset, preprocess_and_split
from evaluation_utils import evaluate_model, mcnemar_exact_test
from models.cnn_model import train_and_predict_cnn
from models.pls_da_model import train_and_predict_pls_da
from models.svm_model import train_and_predict_svm
from training_config import load_training_config

np.random.seed(42)
tf.random.set_seed(42)

def main():
    config, config_source = load_training_config()

    seed = config["random"]["seed"]
    np.random.seed(seed)
    tf.random.set_seed(seed)

    paths_cfg = config["paths"]
    sg_cfg = config["preprocessing"]["savitzky_golay"]
    split_cfg = config["split"]
    pls_cfg = config["pls_da"]
    svm_cfg = config["svm"]
    cnn_cfg = config["cnn"]
    alpha = config["statistics"]["mcnemar_alpha"]

    base_dir = Path(__file__).resolve().parent
    bt_dir = Path(os.getenv("BT_DATA_DIR", paths_cfg["bt_data_dir"]))
    non_bt_dir = Path(os.getenv("NON_BT_DATA_DIR", paths_cfg["non_bt_data_dir"]))
    if not bt_dir.is_absolute():
        bt_dir = (base_dir / bt_dir).resolve()
    if not non_bt_dir.is_absolute():
        non_bt_dir = (base_dir / non_bt_dir).resolve()
    output_dir = Path(paths_cfg["output_dir"])
    if not output_dir.is_absolute():
        output_dir = (base_dir / output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Using config: {config_source}")
    print("Loading dataset...")

    x, y = load_bt_nonbt_dataset(str(bt_dir), str(non_bt_dir))
    print(f"Loaded {x.shape[0]} total spectra with {x.shape[1]} features each.")

    print("Applying Savitzky-Golay Smoothing...")
    print("Partitioning dataset...")
    x_train, x_test, y_train, y_test = preprocess_and_split(
        x,
        y,
        random_state=seed,
        test_size=split_cfg["test_size"],
        sg_window_length=sg_cfg["window_length"],
        sg_polyorder=sg_cfg["polyorder"],
        sg_deriv=sg_cfg["deriv"],
        sg_axis=sg_cfg["axis"],
    )

    results = {}

    print("Training PLS-DA...")
    pls, pls_y_pred, best_pls_components, best_pls_cv_f1 = train_and_predict_pls_da(
        x_train,
        y_train,
        x_test,
        cv_splits=pls_cfg["cv_splits"],
        max_components=pls_cfg["max_components"],
        random_state=seed,
    )
    print(
        f"Optimal PLS latent variables ({pls_cfg['cv_splits']}-fold CV): {best_pls_components} "
        f"(CV F1: {best_pls_cv_f1:.4f})"
    )
    results["PLS-DA"] = evaluate_model("PLS-DA", y_test, pls_y_pred)

    print(f"Training SVM with Grid Search ({svm_cfg['cv_splits']}-fold CV)...")
    best_svm, svm_y_pred, svm_best_params = train_and_predict_svm(
        x_train,
        y_train,
        x_test,
        random_state=seed,
        cv_splits=svm_cfg["cv_splits"],
        param_grid=svm_cfg["param_grid"],
    )
    print(f"Best SVM Params: {svm_best_params}")
    results["SVM"] = evaluate_model("SVM", y_test, svm_y_pred)

    print("Training 1D-CNN...")
    cnn_model, cnn_y_pred = train_and_predict_cnn(
        x_train,
        y_train,
        x_test,
        random_state=seed,
        epochs=cnn_cfg["epochs"],
        batch_size=cnn_cfg["batch_size"],
        validation_split=cnn_cfg["validation_split"],
    )
    results["1D-CNN"] = evaluate_model("1D-CNN", y_test, cnn_y_pred)

    best_model_name = max(results, key=lambda model_name: results[model_name]["f1"])
    print(f"Best performing model based on F1-Score: {best_model_name}")

    ranked_models = sorted(results.items(), key=lambda item: item[1]["f1"], reverse=True)
    if len(ranked_models) >= 2:
        top_name, top_metrics = ranked_models[0]
        second_name, second_metrics = ranked_models[1]
        b, c, p_value = mcnemar_exact_test(y_test, top_metrics["y_pred"], second_metrics["y_pred"])
        print(
            f"McNemar exact test ({top_name} vs {second_name}): "
            f"b={b}, c={c}, p-value={p_value:.6f}"
        )
        if p_value < alpha:
            print(f"Performance difference is statistically significant at p < {alpha}")
        else:
            print(f"No statistically significant difference at p < {alpha}")

    print("Exporting models...")

    with open(output_dir / "pls_da_model.pkl", "wb") as f:
        pickle.dump(pls, f)

    with open(output_dir / "svm_model.pkl", "wb") as f:
        pickle.dump(best_svm, f)

    cnn_model.save(output_dir / "1d_cnn_model.h5")

    with open(output_dir / "training_metadata.pkl", "wb") as f:
        pickle.dump(
            {
                "best_model_name": best_model_name,
                "class_mapping": {"Bt": 1, "Non-Bt": 0},
                "preprocessing": {
                    "method": "savitzky_golay",
                    "window_length": sg_cfg["window_length"],
                    "polyorder": sg_cfg["polyorder"],
                    "deriv": sg_cfg["deriv"],
                    "axis": sg_cfg["axis"],
                },
                "pls_best_n_components": best_pls_components,
                "svm_best_params": svm_best_params,
                "config_source": config_source,
            },
            f,
        )

    if best_model_name == "1D-CNN":
        cnn_model.save(output_dir / "best_model.h5")
    elif best_model_name == "SVM":
        with open(output_dir / "best_model.pkl", "wb") as f:
            pickle.dump(best_svm, f)
    else:
        with open(output_dir / "best_model.pkl", "wb") as f:
            pickle.dump(pls, f)

    print("Offline training complete. Models saved for deployment.")


if __name__ == "__main__":
    main()