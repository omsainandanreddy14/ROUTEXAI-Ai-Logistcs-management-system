import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    roc_curve,
    precision_recall_curve
)

def main():
    print("=" * 70)
    print("RouteXAI — Phase 3D: ML-Based Delay Risk Prediction Training")
    print("=" * 70)

    # 1. Paths
    dataset_path = os.path.join("ml", "data", "processed", "routexai_ml_dataset.csv")
    models_dir = os.path.join("ml", "models")
    plots_dir = os.path.join("ml", "reports", "plots")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)

    pipeline_output_path = os.path.join(models_dir, "delay_risk_pipeline.joblib")
    metadata_output_path = os.path.join(models_dir, "delay_risk_model_metadata.json")

    # 2. Load & Inspect Dataset
    print(f"\n[1/7] Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    total_rows, total_cols = df.shape
    print(f"      Total rows: {total_rows}, Total columns: {total_cols}")

    target_col = "delayStatus"
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset!")

    # Check target values & class counts
    val_counts = df[target_col].value_counts(dropna=False)
    val_percs = df[target_col].value_counts(normalize=True, dropna=False) * 100
    missing_target = df[target_col].isnull().sum()

    print("\n      Target Class Distribution ('delayStatus'):")
    for cls_name, count in val_counts.items():
        perc = val_percs[cls_name]
        print(f"        - {cls_name:<10}: {count} records ({perc:.2f}%)")

    if missing_target > 0:
        raise ValueError(f"Missing values found in target: {missing_target}")

    valid_labels = {"ON_TIME", "DELAYED"}
    found_labels = set(df[target_col].unique())
    unexpected_labels = found_labels - valid_labels
    if unexpected_labels:
        raise ValueError(f"Unexpected target labels found: {unexpected_labels}")

    # 3. Define Feature Collections & Leakage Audit
    num_features = [
        "distanceKm",
        "expectedDurationMin",
        "vehicleCapacityKg",
        "cargoWeightKg",
        "cargoVolumeM3",
        "packageCount",
        "temperatureC",
        "humidityPercent",
        "rainfallMm",
        "windSpeedKmph",
        "visibilityKm",
        "routeScore",
        "driverExperienceYears",
        "vehicleAgeYears",
        "pickupHour",
        "dayOfWeek",
        "month",
        "isWeekend"
    ]

    cat_features_base = [
        "shipmentType",
        "priority",
        "vehicleType",
        "trafficLevel",
        "weatherCondition",
        "weatherRisk"
    ]

    # Target Leakage Audit
    leakage_cols = ["actualDurationMin", "deliveryTimestamp", "delayMinutes", "delayStatus"]
    print("\n[2/7] Target Leakage Exclusions Audit:")
    for col in leakage_cols:
        print(f"      [EXCLUDED LEAKAGE COL]: {col}")

    # Binary target encoding: DELAYED = 1, ON_TIME = 0
    y = (df[target_col] == "DELAYED").astype(int)

    # Helper function to evaluate pipeline
    def evaluate_model_pipeline(model, X_tr, X_te, y_tr, y_te, cat_cols):
        preprocessor = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), num_features),
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols)
            ]
        )
        pipe = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("classifier", model)
        ])

        # 5-Fold Stratified CV on Train set
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_res = cross_validate(pipe, X_tr, y_tr, cv=skf, scoring=["accuracy", "f1", "roc_auc"])
        cv_acc = float(cv_res["test_accuracy"].mean())
        cv_f1 = float(cv_res["test_f1"].mean())
        cv_auc = float(cv_res["test_roc_auc"].mean())

        # Fit on full train set
        pipe.fit(X_tr, y_tr)

        # Predict on Test set
        y_pred = pipe.predict(X_te)
        y_prob = pipe.predict_proba(X_te)[:, 1] if hasattr(pipe, "predict_proba") else y_pred

        acc = float(accuracy_score(y_te, y_pred))
        prec = float(precision_score(y_te, y_pred, pos_label=1))
        rec = float(recall_score(y_te, y_pred, pos_label=1))
        f1 = float(f1_score(y_te, y_pred, pos_label=1))
        auc = float(roc_auc_score(y_te, y_prob))
        cm = confusion_matrix(y_te, y_pred).tolist()

        return {
            "pipeline": pipe,
            "cv_metrics": {"accuracy": cv_acc, "f1": cv_f1, "roc_auc": cv_auc},
            "test_metrics": {
                "accuracy": round(acc, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1": round(f1, 4),
                "roc_auc": round(auc, 4)
            },
            "confusion_matrix": cm,
            "y_pred": y_pred,
            "y_prob": y_prob
        }

    # 4. Train / Test Split (80 / 20, random_state=42, stratify=y)
    print("\n[3/7] Splitting dataset (80% Train / 20% Test, random_state=42, stratify=y)...")
    
    # Candidate Features for main comparison (Experiment B: including delayRisk)
    cat_features_with_delay = cat_features_base + ["delayRisk"]
    all_features_B = num_features + cat_features_with_delay

    X_B = df[all_features_B]
    X_train_B, X_test_B, y_train, y_test = train_test_split(
        X_B, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"      Train set shape: {X_train_B.shape}, Test set shape: {X_test_B.shape}")

    # 5. Model Comparison (Experiment B: WITH delayRisk)
    print("\n[4/7] Training & Comparing Candidate Classifiers (WITH delayRisk)...")
    candidate_models = {
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "RandomForestClassifier": RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced", n_jobs=-1),
        "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=100, random_state=42)
    }

    comparison_results = {}
    best_model_name = None
    best_f1_score = -1.0
    best_eval = None

    for name, model in candidate_models.items():
        print(f"\n      ---> Evaluating {name}...")
        eval_res = evaluate_model_pipeline(model, X_train_B, X_test_B, y_train, y_test, cat_features_with_delay)
        m = eval_res["test_metrics"]
        cv_m = eval_res["cv_metrics"]

        print(f"           CV (5-Fold): Acc={cv_m['accuracy']:.4f}, F1={cv_m['f1']:.4f}, AUC={cv_m['roc_auc']:.4f}")
        print(f"           Test Set:    Acc={m['accuracy']:.4f}, Prec={m['precision']:.4f}, Rec={m['recall']:.4f}, F1={m['f1']:.4f}, AUC={m['roc_auc']:.4f}")

        comparison_results[name] = eval_res

        if m["f1"] > best_f1_score:
            best_f1_score = m["f1"]
            best_model_name = name
            best_eval = eval_res

    print(f"\n      [SELECTED MODEL]: {best_model_name} (Test F1-Score: {best_f1_score:.4f})")

    # 6. Dedicated Experiment A vs B (WITHOUT vs WITH delayRisk)
    print("\n[5/7] Running Dedicated DelayRisk Feature Experiment:")
    print("      Experiment A: Training best model WITHOUT delayRisk feature...")
    cat_features_no_delay = cat_features_base
    all_features_A = num_features + cat_features_no_delay
    X_A = df[all_features_A]
    X_train_A, X_test_A, _, _ = train_test_split(
        X_A, y, test_size=0.20, random_state=42, stratify=y
    )

    from sklearn.base import clone
    exp_A_model = clone(candidate_models[best_model_name])
    exp_A_res = evaluate_model_pipeline(exp_A_model, X_train_A, X_test_A, y_train, y_test, cat_features_no_delay)
    exp_A_m = exp_A_res["test_metrics"]
    exp_B_m = best_eval["test_metrics"]

    print("\n" + "=" * 60)
    print("EXPERIMENT COMPARISON SUMMARY:")
    print(f"  Metric       | Exp A (WITHOUT delayRisk) | Exp B (WITH delayRisk)")
    print(f"  -------------+---------------------------+-----------------------")
    print(f"  Accuracy     | {exp_A_m['accuracy']:<25} | {exp_B_m['accuracy']}")
    print(f"  Precision    | {exp_A_m['precision']:<25} | {exp_B_m['precision']}")
    print(f"  Recall       | {exp_A_m['recall']:<25} | {exp_B_m['recall']}")
    print(f"  F1-Score     | {exp_A_m['f1']:<25} | {exp_B_m['f1']}")
    print(f"  ROC-AUC      | {exp_A_m['roc_auc']:<25} | {exp_B_m['roc_auc']}")
    print("=" * 60 + "\n")

    # 7. Generate & Save Evaluation Plots for Selected Model
    print("[6/7] Generating and Saving Evaluation Plots...")
    
    # 7a. Confusion Matrix Plot
    cm_display = ConfusionMatrixDisplay(
        confusion_matrix=np.array(best_eval["confusion_matrix"]),
        display_labels=["ON_TIME", "DELAYED"]
    )
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_display.plot(ax=ax, cmap="Blues", values_format="d")
    ax.set_title(f"Confusion Matrix — {best_model_name}\n(Target: delayStatus)")
    plt.tight_layout()
    cm_path = os.path.join(plots_dir, "delay_confusion_matrix.png")
    plt.savefig(cm_path, dpi=300)
    plt.close()
    print(f"      Saved Confusion Matrix plot to: {cm_path}")

    # 7b. ROC Curve Plot
    fpr, tpr, _ = roc_curve(y_test, best_eval["y_prob"])
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, color="darkorange", lw=2, label=f"ROC curve (AUC = {best_eval['test_metrics']['roc_auc']:.4f})")
    plt.plot([0, 1], [0, 1], color="navy", lw=2, linestyle="--")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(f"ROC Curve — {best_model_name}")
    plt.legend(loc="lower right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    roc_path = os.path.join(plots_dir, "delay_roc_curve.png")
    plt.savefig(roc_path, dpi=300)
    plt.close()
    print(f"      Saved ROC Curve plot to: {roc_path}")

    # 7c. Precision-Recall Curve Plot
    prec_pts, rec_pts, _ = precision_recall_curve(y_test, best_eval["y_prob"])
    plt.figure(figsize=(6, 5))
    plt.plot(rec_pts, prec_pts, color="purple", lw=2, label=f"PR curve (F1 = {best_eval['test_metrics']['f1']:.4f})")
    plt.xlabel("Recall (DELAYED Class)")
    plt.ylabel("Precision (DELAYED Class)")
    plt.title(f"Precision-Recall Curve — {best_model_name}")
    plt.legend(loc="lower left")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    pr_path = os.path.join(plots_dir, "delay_precision_recall_curve.png")
    plt.savefig(pr_path, dpi=300)
    plt.close()
    print(f"      Saved Precision-Recall Curve plot to: {pr_path}")

    # Extract Feature Importances
    winning_pipe = best_eval["pipeline"]
    prep = winning_pipe.named_steps["preprocessor"]
    try:
        feature_names = list(prep.get_feature_names_out())
    except Exception:
        ohe = prep.named_transformers_["cat"]
        cat_encoded_cols = list(ohe.get_feature_names_out(cat_features_with_delay))
        feature_names = num_features + cat_encoded_cols

    clf = winning_pipe.named_steps["classifier"]
    if hasattr(clf, "feature_importances_"):
        importances = clf.feature_importances_
        min_len = min(len(feature_names), len(importances))
        feature_imp_df = pd.DataFrame({
            "feature": feature_names[:min_len],
            "importance": importances[:min_len]
        }).sort_values(by="importance", ascending=False)
        top_features = feature_imp_df.head(10).to_dict(orient="records")
    else:
        top_features = []

    print("\n      Top 10 Feature Importances:")
    for item in top_features:
        print(f"        - {item['feature']:<30}: {item['importance']*100:.2f}%")

    # 8. Save Final Model & Metadata
    print(f"\n[7/7] Saving final model pipeline to: {pipeline_output_path}")
    joblib.dump(winning_pipe, pipeline_output_path)

    metadata = {
        "model_name": best_model_name,
        "model_version": "1.0.0",
        "dataset_path": dataset_path,
        "dataset_type": "SYNTHETIC",
        "target": target_col,
        "positive_class": "DELAYED",
        "train_samples": len(X_train_B),
        "test_samples": len(X_test_B),
        "class_distribution": {
            "ON_TIME_count": int(val_counts.get("ON_TIME", 0)),
            "DELAYED_count": int(val_counts.get("DELAYED", 0)),
            "ON_TIME_percent": round(float(val_percs.get("ON_TIME", 0)), 2),
            "DELAYED_percent": round(float(val_percs.get("DELAYED", 0)), 2)
        },
        "features": {
            "numerical": num_features,
            "categorical": cat_features_with_delay,
            "total_raw_count": len(all_features_B)
        },
        "excluded_leakage_features": leakage_cols,
        "risk_thresholds": {
            "LOW": "< 0.30",
            "MEDIUM": "0.30 to < 0.60",
            "HIGH": ">= 0.60"
        },
        "model_metrics": best_eval["test_metrics"],
        "confusion_matrix": best_eval["confusion_matrix"],
        "experiment_comparison": {
            "experiment_A_without_delayRisk": exp_A_m,
            "experiment_B_with_delayRisk": exp_B_m
        },
        "all_model_comparison": {
            k: v["test_metrics"] for k, v in comparison_results.items()
        },
        "top_features": top_features
    }

    with open(metadata_output_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"      Saved model metadata to: {metadata_output_path}")
    print("\n" + "=" * 70)
    print("Phase 3D Delay Risk Model Training Completed Successfully!")
    print("=" * 70)

if __name__ == "__main__":
    main()
