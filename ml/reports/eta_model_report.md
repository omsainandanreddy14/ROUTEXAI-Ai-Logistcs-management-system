# RouteXAI Phase 3C — ML-Based ETA Prediction Model Report

> [!IMPORTANT]
> **Dataset Type**: `SYNTHETIC`  
> **Model Status**: Trained & Validated  
> **Target Variable**: `actualDurationMin` (Continuous Transit Time in Minutes)  
> **Notice**: This model is trained on a synthetic logistics dataset explicitly constructed for initial ML feature engineering. It is **never** presented as real operational history.

---

## 1. Executive Summary

Phase 3C establishes a Machine Learning pipeline for high-precision Estimated Time of Arrival (ETA) prediction. The model enhances standard OpenRouteService (ORS) distance/speed baseline ETAs by factoring in cargo weight/volume, vehicle specifications, traffic congestion levels, driver experience, dispatch temporal context, and Open-Meteo weather parameters.

### Performance Summary (Test Set = 2,000 Records)
| Model / Pipeline | Test MAE (min) | Test RMSE (min) | Test MedAE (min) | Test R² Score | Improvement over ORS |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **ORS Baseline** (`expectedDurationMin`) | 49.20 min | 71.83 min | 29.75 min | 0.9961 | Baseline |
| **RandomForestRegressor** | 22.84 min | 37.52 min | 15.09 min | 0.9989 | +53.6% |
| **GradientBoostingRegressor** *(Winning Model)* | **19.96 min** | **28.11 min** | **14.83 min** | **0.9994** | **+59.4%** |

---

## 2. Dataset & Feature Engineering

- **Training Records**: 8,000 synthetic shipments (80%)
- **Test Records**: 2,000 synthetic shipments (20%)
- **Random Seed**: 42
- **Cross-Validation**: 5-Fold Stratified Grouping (`CV MAE: 20.16 ± 0.48 min`)

### Feature Schema (25 Total Input Features)
1. **Numerical Features (18)**:
   - `distanceKm`, `expectedDurationMin`, `vehicleCapacityKg`, `cargoWeightKg`, `cargoVolumeM3`, `packageCount`, `temperatureC`, `humidityPercent`, `rainfallMm`, `windSpeedKmph`, `visibilityKm`, `routeScore`, `driverExperienceYears`, `vehicleAgeYears`, `pickupHour`, `dayOfWeek`, `month`, `isWeekend`
2. **Categorical Features (7)**:
   - `shipmentType`, `priority`, `vehicleType`, `trafficLevel`, `weatherCondition`, `weatherRisk`, `delayRisk`

### Target Leakage Prevention Audit
The following post-delivery columns were strictly **EXCLUDED** from training input features:
- `actualDurationMin` *(Target Variable)*
- `deliveryTimestamp`
- `delayMinutes`
- `delayStatus`

---

## 3. Top Feature Importances (GradientBoosting Pipeline)

1. `expectedDurationMin`: 99.73%
2. `routeScore`: 0.09%
3. `priority_LOW`: 0.07%
4. `priority_URGENT`: 0.03%
5. `delayRisk_LOW`: 0.02%
6. `trafficLevel_SEVERE`: 0.01%
7. `priority_MEDIUM`: 0.01%
8. `weatherRisk_HIGH`: 0.01%

---

## 4. Retraining & Production Strategy

When sufficient real completed RouteXAI shipments are accumulated in MongoDB Atlas:
1. Export real historical shipment logs.
2. Replace synthetic dataset in retraining script.
3. Retrain `GradientBoosting` pipeline and update `ml/models/eta_pipeline.joblib`.
