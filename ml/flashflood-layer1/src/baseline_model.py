"""
Baseline model for the flash flood nowcast (Layer 1) task.

Deliberately simple (logistic regression) -- the point of a baseline is NOT
to be good, it's to give us a floor to compare XGBoost against later. If
XGBoost barely beats this, that's important information, not a failure.

Because flash floods are rare (~3% positive class), accuracy is not used --
it's misleading here (always-predict-"no-flood" gets ~97% "accuracy" while
being useless). We report precision, recall, F1, ROC-AUC, and PR-AUC instead.
"""

import pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
)
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

TRAIN_PATH = Path("data/processed/train.csv")
TEST_PATH = Path("data/processed/test.csv")


def main():
    train_df = pd.read_csv(TRAIN_PATH, parse_dates=["date"])
    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    # Logistic regression is sensitive to feature scale (rainfall_mm ranges
    # 0-300+, is_monsoon is 0/1) -- scale using TRAIN stats only, then apply
    # the same transform to test. Fitting the scaler on test data would itself
    # be a (small) form of leakage.
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # class_weight="balanced" reweights the loss so the rare flood class isn't
    # ignored -- without this, logistic regression will often just predict
    # "no flood" for everything and still look "accurate".
    model = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    print("=== Confusion Matrix ===")
    print("         Predicted 0   Predicted 1")
    cm = confusion_matrix(y_test, y_pred)
    print(f"Actual 0    {cm[0][0]:>6}        {cm[0][1]:>6}")
    print(f"Actual 1    {cm[1][0]:>6}        {cm[1][1]:>6}")

    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["No Flood", "Flood"]))

    print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")
    print(f"PR-AUC (average precision): {average_precision_score(y_test, y_proba):.4f}")

    # Feature coefficients -- crude but informative interpretability check
    # for the baseline (we'll do this properly with SHAP once XGBoost is in).
    coefs = pd.Series(model.coef_[0], index=FEATURE_COLUMNS).sort_values(key=abs, ascending=False)
    print("\n=== Top features by |coefficient| (standardized) ===")
    print(coefs)


if __name__ == "__main__":
    main()