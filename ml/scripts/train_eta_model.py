import os
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, median_absolute_error

def main():
    print("=" * 60)
    print("RouteXAI — Phase 3C: ML-Based ETA Prediction Training")
    print("=" * 60)

    # 1. Paths
    dataset_path = os.path.join("ml", "data", "processed", "routexai_ml_dataset.csv")
    models_dir = os.path.join("ml", "models")
    os.makedirs(models_dir, exist_ok=True)

    pipeline_output_path = os.path.join(models_dir, "eta_pipeline.joblib")
    metadata_output_path = os.path.join(models_dir, "eta_model_metadata.json")

    # 2. Load Dataset
    print(f"[1/6] Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    print(f"      Dataset loaded successfully. Shape: {df.shape}")

    # 3. Confirm target & check leakage
    target = "actualDurationMin"
    leakage_cols = ["actualDurationMin", "deliveryTimestamp", "delayMinutes", "delayStatus"]
    
    for col in leakage_cols:
        if col in df.columns and col != target:
            print(f"      [LEAKAGE CHECK] Excluding leakage column: {col}")

    # 4. Feature Selection
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

    cat_features = [
        "shipmentType",
        "priority",
        "vehicleType",
        "trafficLevel",
        "weatherCondition",
        "weatherRisk",
        "delayRisk"
    ]

    all_features = num_features + cat_features
    print(f"      Total Input Features: {len(all_features)} ({len(num_features)} numerical, {len(cat_features)} categorical)")

    X = df[all_features]
    y = df[target]
    ors_baseline = df["expectedDurationMin"]

    # 5. Train / Test Split (80 / 20, seed=42)
    print("[2/6] Splitting data into 80% Train / 20% Test (random_state=42)...")
    X_train, X_test, y_train, y_test, ors_train, ors_test = train_test_split(
        X, y, ors_baseline, test_size=0.20, random_state=42
    )
    print(f"      Train shape: {X_train.shape}, Test shape: {X_test.shape}")

    # 6. Baseline Evaluation (ORS expectedDurationMin vs actualDurationMin)
    baseline_mae = float(mean_absolute_error(y_test, ors_test))
    baseline_rmse = float(np.sqrt(mean_squared_error(y_test, ors_test)))
    baseline_medae = float(median_absolute_error(y_test, ors_test))
    baseline_r2 = float(r2_score(y_test, ors_test))

    print("\n" + "-" * 50)
    print("Baseline ORS (expectedDurationMin) Performance on Test Set:")
    print(f"  - MAE:           {baseline_mae:.2f} min")
    print(f"  - RMSE:          {baseline_rmse:.2f} min")
    print(f"  - MedAE:         {baseline_medae:.2f} min")
    print(f"  - R² Score:      {baseline_r2:.4f}")
    print("-" * 50 + "\n")

    # 7. Build Preprocessing Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features)
        ]
    )

    # 8. Define Candidate Models
    candidate_models = {
        "RandomForest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
        "GradientBoosting": GradientBoostingRegressor(n_estimators=100, random_state=42)
    }

    results = {}
    best_model_name = None
    best_score = float("inf") # MAE based
    best_pipeline = None

    print("[3/6] Training & Evaluating Candidate ML Regressors...")
    for name, model in candidate_models.items():
        print(f"\n      ---> Training {name}...")
        pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("regressor", model)
        ])

        # 5-Fold Cross Validation on Train Set
        cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="neg_mean_absolute_error", n_jobs=-1)
        cv_mae_mean = float(-cv_scores.mean())
        cv_mae_std = float(cv_scores.std())

        # Fit on full train set
        pipeline.fit(X_train, y_train)

        # Predict on Test Set
        y_pred = pipeline.predict(X_test)
        test_mae = float(mean_absolute_error(y_test, y_pred))
        test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        test_medae = float(median_absolute_error(y_test, y_pred))
        test_r2 = float(r2_score(y_test, y_pred))

        print(f"           CV MAE (5-fold): {cv_mae_mean:.2f} ± {cv_mae_std:.2f} min")
        print(f"           Test MAE:        {test_mae:.2f} min")
        print(f"           Test RMSE:       {test_rmse:.2f} min")
        print(f"           Test MedAE:      {test_medae:.2f} min")
        print(f"           Test R²:         {test_r2:.4f}")

        results[name] = {
            "cv_mae_mean": cv_mae_mean,
            "cv_mae_std": cv_mae_std,
            "test_mae": test_mae,
            "test_rmse": test_rmse,
            "test_medae": test_medae,
            "test_r2": test_r2
        }

        if test_mae < best_score:
            best_score = test_mae
            best_model_name = name
            best_pipeline = pipeline

    print(f"\n[4/6] Winning Model: {best_model_name} (Test MAE: {best_score:.2f} min)")

    # 9. Extract Feature Importance
    print("[5/6] Extracting Feature Importances...")
    ohe = best_pipeline.named_steps["preprocessor"].named_transformers_["cat"]
    cat_encoded_cols = list(ohe.get_feature_names_out(cat_features))
    feature_names = num_features + cat_encoded_cols

    regressor = best_pipeline.named_steps["regressor"]
    importances = regressor.feature_importances_

    feature_imp_df = pd.DataFrame({
        "feature": feature_names,
        "importance": importances
    }).sort_values(by="importance", ascending=False)

    top_features = feature_imp_df.head(10).to_dict(orient="records")

    print("\n      Top 10 Feature Importances:")
    for item in top_features:
        print(f"        - {item['feature']:<30}: {item['importance']*100:.2f}%")

    # 10. Save Model & Metadata
    print(f"\n[6/6] Saving winning pipeline to: {pipeline_output_path}")
    joblib.dump(best_pipeline, pipeline_output_path)

    metadata = {
        "model_name": best_model_name,
        "dataset_type": "SYNTHETIC",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "target": target,
        "features": {
            "numerical": num_features,
            "categorical": cat_features,
            "total_raw_count": len(all_features)
        },
        "baseline_ors_metrics": {
            "mae_min": round(baseline_mae, 2),
            "rmse_min": round(baseline_rmse, 2),
            "medae_min": round(baseline_medae, 2),
            "r2_score": round(baseline_r2, 4)
        },
        "model_metrics": {
            "mae_min": round(results[best_model_name]["test_mae"], 2),
            "rmse_min": round(results[best_model_name]["test_rmse"], 2),
            "medae_min": round(results[best_model_name]["test_medae"], 2),
            "r2_score": round(results[best_model_name]["test_r2"], 4),
            "cv_mae_mean_min": round(results[best_model_name]["cv_mae_mean"], 2),
            "cv_mae_std_min": round(results[best_model_name]["cv_mae_std"], 2)
        },
        "all_model_comparison": results,
        "top_features": top_features
    }

    with open(metadata_output_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"      Saved model metadata to: {metadata_output_path}")
    print("\n" + "=" * 60)
    print("Phase 3C Model Training Completed Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
