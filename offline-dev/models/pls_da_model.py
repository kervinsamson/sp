from sklearn.cross_decomposition import PLSRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict


def tune_pls_components(x_train, y_train, cv_splits=10, max_components=30, random_state=42):
    max_valid_components = min(max_components, x_train.shape[1], x_train.shape[0] - 1)
    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=random_state)

    best_components = 1
    best_f1 = -1.0

    for n_components in range(1, max_valid_components + 1):
        model = PLSRegression(n_components=n_components)
        y_cv_cont = cross_val_predict(model, x_train, y_train, cv=cv, method="predict")
        y_cv_pred = (y_cv_cont.ravel() > 0.5).astype(int)
        score = f1_score(y_train, y_cv_pred, zero_division=0)

        if score > best_f1:
            best_f1 = score
            best_components = n_components

    return best_components, best_f1


def train_and_predict_pls_da(x_train, y_train, x_test, cv_splits=10, max_components=30, random_state=42):
    best_components, best_cv_f1 = tune_pls_components(
        x_train,
        y_train,
        cv_splits=cv_splits,
        max_components=max_components,
        random_state=random_state,
    )

    model = PLSRegression(n_components=best_components)
    model.fit(x_train, y_train)

    y_pred_cont = model.predict(x_test)
    y_pred = (y_pred_cont > 0.5).astype(int).flatten()

    return model, y_pred, best_components, best_cv_f1
