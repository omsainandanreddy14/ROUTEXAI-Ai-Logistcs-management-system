# RouteXAI Phase 3D — ML-Based Delay Risk Prediction Model Report

> [!IMPORTANT]
> **Dataset Type**: `SYNTHETIC`  
> **Model Status**: Trained, Evaluated & Deployed  
> **Target Variable**: `delayStatus` (`ON_TIME` vs `DELAYED`)  
> **Notice**: The current delay-risk model is trained and evaluated on synthetic logistics data. The reported classification metrics demonstrate the behavior of the ML pipeline on this synthetic dataset and should not be interpreted as real-world RouteXAI operational performance.

---

## 1. Executive Summary

Phase 3D implements a Machine Learning classification pipeline for real-time shipment delay risk assessment. Using pre-delivery features available before shipment completion, the model calculates the probability of transit delay (`delayStatus` = `DELAYED`), determines the predicted classification status, and assigns an operational risk level (`LOW`, `MEDIUM`, `HIGH`).

### Classification Performance Summary (Test Set = 2,000 Records, Stratified 80/20 Split)
| Model / Pipeline | Accuracy | Precision (DELAYED) | Recall (DELAYED) | F1-Score (DELAYED) | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **LogisticRegression** *(Balanced)* | 86.60% | 84.57% | 86.77% | 85.65% | 0.9426 |
| **RandomForestClassifier** *(Balanced)* | 90.40% | 90.56% | 88.39% | 89.46% | 0.9653 |
| **GradientBoostingClassifier** *(Winning Model)* | **90.65%** | **91.81%** | **87.53%** | **89.62%** | **0.9704** |

---

## 2. Dataset & Target Specification

- **Dataset Path**: `ml/data/processed/routexai_ml_dataset.csv`
- **Total Records**: 10,000 shipments
- **Training Set (80%)**: 8,000 records
- **Test Set (20%)**: 2,000 records (Stratified split with `random_state=42`)
- **Target Variable**: `delayStatus`
- **Positive Class**: `DELAYED`

### Exact Class Distribution
- **`ON_TIME`**: 5,392 records (**53.92%**)
- **`DELAYED`**: 4,608 records (**46.08%**)
- **Missing / Invalid Values**: 0 (0.0%)

---

## 3. Target Leakage Prevention Audit

The following post-delivery columns were strictly **EXCLUDED** from all training input features:
- `actualDurationMin`
- `deliveryTimestamp`
- `delayMinutes`
- `delayStatus` *(Target Variable)*

### Input Feature Schema (25 Pre-Delivery Features)
- **Numerical Features (18)**: `distanceKm`, `expectedDurationMin`, `vehicleCapacityKg`, `cargoWeightKg`, `cargoVolumeM3`, `packageCount`, `temperatureC`, `humidityPercent`, `rainfallMm`, `windSpeedKmph`, `visibilityKm`, `routeScore`, `driverExperienceYears`, `vehicleAgeYears`, `pickupHour`, `dayOfWeek`, `month`, `isWeekend`
- **Categorical Features (7)**: `shipmentType`, `priority`, `vehicleType`, `trafficLevel`, `weatherCondition`, `weatherRisk`, `delayRisk`

---

## 4. Dedicated Experiment: Delay Risk Feature Audit

We conducted a dedicated experiment to test whether including the synthetic `delayRisk` feature distorts classification performance:

| Metric | Experiment A (WITHOUT `delayRisk`) | Experiment B (WITH `delayRisk`) | Impact |
| :--- | :---: | :---: | :---: |
| **Accuracy** | 90.40% | 90.65% | +0.25% |
| **Precision** | 91.76% | 91.81% | +0.05% |
| **Recall** | 86.98% | 87.53% | +0.55% |
| **F1-Score** | 89.31% | 89.62% | +0.31% |
| **ROC-AUC** | 0.9687 | 0.9704 | +0.0017 |

**Conclusion**: The model performs robustly even without `delayRisk` (90.40% accuracy vs 90.65%), proving that it relies primarily on raw spatial, temporal, cargo, traffic, and weather features rather than synthetically derived risk flags.

---

## 5. Confusion Matrix & ROC Curve Analysis

### Confusion Matrix (Test Set = 2,000 Records)
```
                  Predicted ON_TIME    Predicted DELAYED
Actual ON_TIME           1006                 72
Actual DELAYED            115                807
```
- **True Positives (TP)**: 807
- **True Negatives (TN)**: 1006
- **False Positives (FP)**: 72
- **False Negatives (FN)**: 115

### Why Recall Matters
A false negative means an actual delay occurs without being flagged by the model. High recall (87.53%) ensures that 7 out of 8 potential logistics delays are proactively identified prior to dispatch.

---

## 6. Top Feature Importances (GradientBoostingClassifier)

1. `routeScore`: 42.38%
2. `priority_LOW`: 17.72%
3. `expectedDurationMin`: 9.33%
4. `distanceKm`: 4.25%
5. `trafficLevel_HIGH`: 4.04%
6. `priority_URGENT`: 3.91%
7. `priority_HIGH`: 3.68%
8. `driverExperienceYears`: 3.36%

---

## 7. Deterministic Operational Risk Level Thresholds

The predicted delay probability `P(DELAYED)` is mapped to project-defined operational risk levels:

- **`LOW`**: Delay Probability `< 30%` (Optimal transit corridor)
- **`MEDIUM`**: Delay Probability `30% to < 60%` (Standard transit corridor)
- **`HIGH`**: Delay Probability `>= 60%` (High delay likelihood — dispatch attention recommended)

---

## 8. Retraining Strategy for Future Real Data

When sufficient real completed RouteXAI shipments become available:
1. Export real historical shipment logs from MongoDB.
2. Run `ml/scripts/train_delay_risk_model.py`.
3. Re-evaluate metrics and update `ml/models/delay_risk_pipeline.joblib`.
