# RouteXAI Machine Learning Pipeline — Phase 3C & Phase 3D

> [!IMPORTANT]
> **Dataset Label**: `SYNTHETIC`  
> **Purpose**: Initial Machine Learning pipeline architecture for Phase 3C (ETA Prediction Regression) and Phase 3D (Delay Risk Classification).  
> **Operational Data Notice**: This dataset contains synthetic records generated specifically for offline ML pipeline development and model testing. It is **never** saved into MongoDB Atlas or presented as real RouteXAI operational history.

---

## 1. Directory Structure

```text
ml/
├── data/
│   ├── synthetic/
│   │   ├── routexai_synthetic_logistics.csv         # Primary synthetic logistics dataset (10,000 rows)
│   │   └── routexai_synthetic_logistics_metadata.json # Dataset generation metadata
│   └── processed/
│       └── routexai_ml_dataset.csv                   # Processed dataset ready for ML feature engineering
├── models/
│   ├── eta_pipeline.joblib                           # Phase 3C ETA Regression Model
│   ├── eta_model_metadata.json                       # Phase 3C ETA Model Metadata
│   ├── delay_risk_pipeline.joblib                    # Phase 3D Delay Risk Classification Model
│   └── delay_risk_model_metadata.json               # Phase 3D Delay Risk Model Metadata
├── scripts/
│   ├── train_eta_model.py                            # Phase 3C Model Training Script
│   ├── train_delay_risk_model.py                     # Phase 3D Model Training Script
│   ├── generate_synthetic_dataset.py                 # Reproducible synthetic dataset generator
│   ├── validate_dataset.py                           # 12-point data quality & physics validation script
│   └── analyze_dataset.py                            # Descriptive statistical analyzer & visualization generator
├── services/
│   └── eta_api.py                                    # Unified FastAPI Microservice (/predict/eta, /predict/risk)
├── reports/
│   ├── eta_model_report.md                           # Phase 3C Model Performance Report
│   ├── delay_risk_model_report.md                    # Phase 3D Model Performance Report
│   └── plots/                                        # Generated plots (.png)
│       ├── delay_confusion_matrix.png
│       ├── delay_roc_curve.png
│       └── delay_precision_recall_curve.png
└── README.md
```

---

## 2. Quick-Start Commands

### Phase 3C — Train ETA Model
```bash
python ml/scripts/train_eta_model.py
```

### Phase 3D — Train Delay Risk Classification Model
```bash
python ml/scripts/train_delay_risk_model.py
```

### Start Unified FastAPI Microservice
```bash
python -m uvicorn ml.services.eta_api:app --host 127.0.0.1 --port 8000
```

### Test FastAPI Microservice Endpoints
```bash
# Health Check
curl -s http://127.0.0.1:8000/health

# Test ETA Prediction (Phase 3C)
curl -X POST http://127.0.0.1:8000/predict/eta -H "Content-Type: application/json" -d "{\"distanceKm\": 250.0, \"expectedDurationMin\": 300.0}"

# Test Delay Risk Prediction (Phase 3D)
curl -X POST http://127.0.0.1:8000/predict/risk -H "Content-Type: application/json" -d "{\"distanceKm\": 250.0, \"expectedDurationMin\": 300.0, \"trafficLevel\": \"HIGH\"}"
```

---

## 3. Dataset & Model Overview

- **Total Records**: 10,000 shipments
- **Training Set**: 8,000 records (80%)
- **Test Set**: 2,000 records (20%)
- **Target `delayStatus` Distribution**:
  - `ON_TIME`: 5,392 shipments (**53.92%**)
  - `DELAYED`: 4,608 shipments (**46.08%**)

### Phase 3C ETA Regression
- **Winning Model**: `GradientBoostingRegressor`
- **Test MAE**: `19.96 min` (Baseline ORS MAE: `49.20 min`) — **+59.4% improvement**

### Phase 3D Delay Risk Classification
- **Winning Model**: `GradientBoostingClassifier`
- **Test Accuracy**: `90.65%`
- **Test Precision (DELAYED)**: `91.81%`
- **Test Recall (DELAYED)**: `87.53%`
- **Test F1-Score**: `89.62%`
- **Test ROC-AUC**: `0.9704`

---

## 4. No Target Leakage Protocol

- **Allowed Features**: `distanceKm`, `expectedDurationMin`, `vehicleType`, `vehicleCapacityKg`, `cargoWeightKg`, `cargoVolumeM3`, `packageCount`, `priority`, `trafficLevel`, `temperatureC`, `humidityPercent`, `rainfallMm`, `windSpeedKmph`, `visibilityKm`, `weatherCondition`, `weatherRisk`, `routeScore`, `driverExperienceYears`, `vehicleAgeYears`, `pickupHour`, `dayOfWeek`, `month`, `isWeekend`, `delayRisk`.
- **Excluded Post-Delivery Information**: `actualDurationMin`, `deliveryTimestamp`, `delayMinutes`, `delayStatus` (target).
