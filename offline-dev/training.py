import os
import numpy as np
import pickle
import spectrochempy as scp
from scipy.signal import savgol_filter
from scipy.stats import binomtest

# Scikit-learn
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_predict, StratifiedKFold
from sklearn.cross_decomposition import PLSRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# TensorFlow / Keras
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense

np.random.seed(42)
tf.random.set_seed(42)

# ==========================================
# 1. DATA ACQUISITION & PREPARATION (III.A)
# ==========================================

def load_spa_files(directory, label):
    """
    Loads .spa files using SpectroChemPy and assigns a binary label.
    Bt = 1, Non-Bt = 0
    """
    spectra = []
    labels = []
    
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Directory not found: {directory}")

    for filename in sorted(os.listdir(directory)):
        if filename.lower().endswith(".spa"):
            filepath = os.path.join(directory, filename)
            dataset = scp.read_omnic(filepath)
            raw = np.asarray(dataset.data)
            if raw.ndim == 1:
                spectrum = raw
            else:
                spectrum = raw[0]
            spectra.append(np.ravel(spectrum).astype(np.float64))
            labels.append(label)

    if not spectra:
        raise ValueError(f"No .spa files found in: {directory}")

    lengths = {spec.shape[0] for spec in spectra}
    if len(lengths) != 1:
        raise ValueError(f"Inconsistent spectral lengths in {directory}: {sorted(lengths)}")

    return np.array(spectra), np.array(labels)

print("Loading dataset...")
bt_dir = os.getenv("BT_DATA_DIR", "./data/Bt_Corn")
non_bt_dir = os.getenv("NON_BT_DATA_DIR", "./data/Non_Bt_Corn")

X_bt, y_bt = load_spa_files(bt_dir, label=1)
X_non_bt, y_non_bt = load_spa_files(non_bt_dir, label=0)

if X_bt.shape[1] != X_non_bt.shape[1]:
    raise ValueError(
        f"Feature mismatch: Bt has {X_bt.shape[1]} points, Non-Bt has {X_non_bt.shape[1]} points"
    )

X = np.vstack([X_bt, X_non_bt])
y = np.concatenate([y_bt, y_non_bt])
print(f"Loaded {X.shape[0]} total spectra with {X.shape[1]} features each.")

# Spectral Preprocessing: Savitzky-Golay Smoothing (III.A.2)
# Window size = 11, Polynomial order = 2
print("Applying Savitzky-Golay Smoothing...")
X_preprocessed = savgol_filter(X, window_length=11, polyorder=2, deriv=0, axis=1)

# Dataset Partitioning: 80:20 Stratified Split (III.A.3)
print("Partitioning dataset...")
X_train, X_test, y_train, y_test = train_test_split(
    X_preprocessed, y, 
    test_size=0.20, 
    stratify=y, 
    random_state=42
)

# ==========================================
# 2. MODEL DEVELOPMENT & BENCHMARKING (III.B)
# ==========================================

def evaluate_model(name, y_true, y_pred):
    """Calculates and prints performance metrics (III.E)"""
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)
    
    print(f"--- {name} Results ---")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1-Score:  {f1:.4f}\n")
    print("Confusion Matrix [ [TN, FP], [FN, TP] ]:")
    print(cm)
    print()

    return {
        "f1": f1,
        "y_pred": y_pred,
        "confusion_matrix": cm,
    }

results = {}


def tune_pls_components(X_train, y_train, cv_splits=10, max_components=30):
    max_valid_components = min(max_components, X_train.shape[1], X_train.shape[0] - 1)
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)

    best_components = 1
    best_f1 = -1.0

    for n_components in range(1, max_valid_components + 1):
        model = PLSRegression(n_components=n_components)
        y_cv_cont = cross_val_predict(model, X_train, y_train, cv=cv, method="predict")
        y_cv_pred = (y_cv_cont.ravel() > 0.5).astype(int)
        score = f1_score(y_train, y_cv_pred, zero_division=0)

        if score > best_f1:
            best_f1 = score
            best_components = n_components

    return best_components, best_f1


def mcnemar_exact_test(y_true, y_pred_a, y_pred_b):
    y_true = np.asarray(y_true)
    y_pred_a = np.asarray(y_pred_a)
    y_pred_b = np.asarray(y_pred_b)

    b = int(np.sum((y_pred_a == y_true) & (y_pred_b != y_true)))
    c = int(np.sum((y_pred_a != y_true) & (y_pred_b == y_true)))

    if (b + c) == 0:
        return b, c, 1.0

    p_value = binomtest(min(b, c), n=b + c, p=0.5, alternative="two-sided").pvalue
    return b, c, float(p_value)

# ------------------------------------------
# Model 1: Partial Least Squares Discriminant Analysis (PLS-DA)
# Note: Scikit-learn uses PLSRegression. We threshold at 0.5 for classification.
# ------------------------------------------
print("Training PLS-DA...")
best_pls_components, best_pls_cv_f1 = tune_pls_components(X_train, y_train, cv_splits=10)
print(f"Optimal PLS latent variables (10-fold CV): {best_pls_components} (CV F1: {best_pls_cv_f1:.4f})")

pls = PLSRegression(n_components=best_pls_components)
pls.fit(X_train, y_train)

# Predict and threshold for binary classification
pls_y_pred_cont = pls.predict(X_test)
pls_y_pred = (pls_y_pred_cont > 0.5).astype(int).flatten()

results['PLS-DA'] = evaluate_model("PLS-DA", y_test, pls_y_pred)

# ------------------------------------------
# Model 2: Support Vector Machine (SVM)
# ------------------------------------------
print("Training SVM with Grid Search (10-fold CV)...")
svm_param_grid = {
    'C': [0.1, 1, 10, 100],
    'gamma': ['scale', 'auto', 0.01, 0.1],
    'kernel': ['rbf'] # Defined in III.B.1.2
}

svm_cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
svm_grid = GridSearchCV(SVC(probability=True), svm_param_grid, cv=svm_cv, scoring='f1')
svm_grid.fit(X_train, y_train)
best_svm = svm_grid.best_estimator_

svm_y_pred = best_svm.predict(X_test)
print(f"Best SVM Params: {svm_grid.best_params_}")
results['SVM'] = evaluate_model("SVM", y_test, svm_y_pred)

# ------------------------------------------
# Model 3: 1D Convolutional Neural Network (1D-CNN)
# ------------------------------------------
print("Training 1D-CNN...")
# Reshape for 1D-CNN (samples, steps, features)
X_train_cnn = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
X_test_cnn = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

# Architecture as defined in III.B.1.3
cnn_model = Sequential([
    # First Conv Block
    Conv1D(filters=32, kernel_size=3, activation='relu', input_shape=(X_train.shape[1], 1)),
    MaxPooling1D(pool_size=2),
    # Second Conv Block
    Conv1D(filters=64, kernel_size=3, activation='relu'),
    MaxPooling1D(pool_size=2),
    # Flatten
    Flatten(),
    # Two Dense Layers
    Dense(64, activation='relu'),
    Dense(32, activation='relu'),
    # Output Layer (Sigmoid for binary classification)
    Dense(1, activation='sigmoid')
])

# Compile with Adam and Binary Cross-Entropy
cnn_model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

# Train the model
cnn_model.fit(X_train_cnn, y_train, epochs=30, batch_size=16, verbose=0, validation_split=0.1)

# Predict and threshold
cnn_y_pred_prob = cnn_model.predict(X_test_cnn)
cnn_y_pred = (cnn_y_pred_prob > 0.5).astype(int).flatten()

results['1D-CNN'] = evaluate_model("1D-CNN", y_test, cnn_y_pred)

# ==========================================
# 3. MODEL SELECTION & EXPORT (III.D.1)
# ==========================================

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
    if p_value < 0.05:
        print("Performance difference is statistically significant at p < 0.05")
    else:
        print("No statistically significant difference at p < 0.05")

print("Exporting models...")

# Save Scikit-learn models as .pkl files
with open("pls_da_model.pkl", "wb") as f:
    pickle.dump(pls, f)

with open("svm_model.pkl", "wb") as f:
    pickle.dump(best_svm, f)

# Save Keras model as .h5 file
cnn_model.save("1d_cnn_model.h5")

with open("training_metadata.pkl", "wb") as f:
    pickle.dump(
        {
            "best_model_name": best_model_name,
            "class_mapping": {"Bt": 1, "Non-Bt": 0},
            "preprocessing": {
                "method": "savitzky_golay",
                "window_length": 11,
                "polyorder": 2,
                "deriv": 0,
                "axis": 1,
            },
            "pls_best_n_components": best_pls_components,
            "svm_best_params": svm_grid.best_params_,
        },
        f,
    )

if best_model_name == "1D-CNN":
    cnn_model.save("best_model.h5")
elif best_model_name == "SVM":
    with open("best_model.pkl", "wb") as f:
        pickle.dump(best_svm, f)
else:
    with open("best_model.pkl", "wb") as f:
        pickle.dump(pls, f)

print("Offline training complete. Models saved for deployment.")