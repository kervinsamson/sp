import numpy as np
from scipy.stats import binomtest
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score


def evaluate_model(name, y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    print(f"--- {name} Results ---")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1-Score:  {f1:.4f}\\n")
    print("Confusion Matrix [ [TN, FP], [FN, TP] ]:")
    print(cm)
    print()

    return {
        "f1": f1,
        "y_pred": y_pred,
        "confusion_matrix": cm,
    }


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
