"""
Layer 1 nowcast model: XGBoost classifier for flash flood prediction.

Same features, same train/test split, same evaluation metrics as the
logistic regression baseline -- so results are directly comparable and we
can honestly say how much (if anything) the extra model complexity buys us.
"""

import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
)
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

TRAIN_PATH = Path("data/processed/train.csv")
TEST_PATH = Path("data/processed/test.csv")
MODEL_OUTPUT = Path("models/xgb_nowcast.json")


def main():
    train_df = pd.read_csv(TRAIN_PATH, parse_dates=["date"])
    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    # scale_pos_weight = (# negative examples) / (# positive examples) in TRAIN
    # only -- this is how XGBoost's equivalent of class_weight="balanced" works.
    n_neg = (y_train == 0).sum()
    n_pos = (y_train == 1).sum()
    scale_pos_weight = n_neg / n_pos
    print(f"Train class counts -- no-flood: {n_neg}, flood: {n_pos}, scale_pos_weight: {scale_pos_weight:.2f}")

    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,              # shallow trees -- less overfitting risk with only ~260 flood examples
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="aucpr",      # optimize for precision-recall AUC, not plain accuracy
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print("\n=== Confusion Matrix ===")
    print("         Predicted 0   Predicted 1")
    cm = confusion_matrix(y_test, y_pred)
    print(f"Actual 0    {cm[0][0]:>6}        {cm[0][1]:>6}")
    print(f"Actual 1    {cm[1][0]:>6}        {cm[1][1]:>6}")

    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["No Flood", "Flood"]))

    print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")
    print(f"PR-AUC (average precision): {average_precision_score(y_test, y_proba):.4f}")

    print("\n=== Feature importances (gain-based) ===")
    importances = pd.Series(
        model.feature_importances_, index=FEATURE_COLUMNS
    ).sort_values(ascending=False)
    print(importances)

    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(MODEL_OUTPUT)
    print(f"\nModel saved to {MODEL_OUTPUT}")


if __name__ == "__main__":
    main()