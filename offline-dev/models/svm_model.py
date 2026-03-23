from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.svm import SVC


def train_and_predict_svm(x_train, y_train, x_test, random_state=42, cv_splits=10, param_grid=None):
    svm_param_grid = param_grid or {
        "C": [0.1, 1, 10, 100],
        "gamma": ["scale", "auto", 0.01, 0.1],
        "kernel": ["rbf"],
    }

    svm_cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=random_state)
    svm_grid = GridSearchCV(SVC(probability=True), svm_param_grid, cv=svm_cv, scoring="f1")
    svm_grid.fit(x_train, y_train)

    best_svm = svm_grid.best_estimator_
    y_pred = best_svm.predict(x_test)

    return best_svm, y_pred, svm_grid.best_params_
