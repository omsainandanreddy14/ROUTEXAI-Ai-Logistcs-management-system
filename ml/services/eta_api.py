import os
import json
import joblib
import pandas as pd
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="RouteXAI Smart Logistics Intelligence Microservice",
    description="Phase 3C ETA Regression & Phase 3D Delay Risk Classification (Trained on SYNTHETIC dataset)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models and metadata
eta_pipeline = None
eta_metadata = None

delay_pipeline = None
delay_metadata = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")

ETA_MODEL_PATH = os.path.join(MODELS_DIR, "eta_pipeline.joblib")
ETA_METADATA_PATH = os.path.join(MODELS_DIR, "eta_model_metadata.json")

DELAY_MODEL_PATH = os.path.join(MODELS_DIR, "delay_risk_pipeline.joblib")
DELAY_METADATA_PATH = os.path.join(MODELS_DIR, "delay_risk_model_metadata.json")

def load_artifacts():
    global eta_pipeline, eta_metadata, delay_pipeline, delay_metadata
    
    # Load Phase 3C ETA Artifacts
    if os.path.exists(ETA_MODEL_PATH):
        try:
            eta_pipeline = joblib.load(ETA_MODEL_PATH)
            print(f"[ML Service] Loaded Phase 3C ETA model from {ETA_MODEL_PATH}")
        except Exception as e:
            print(f"[ML Service ERROR] Failed to load ETA pipeline: {e}")
            eta_pipeline = None
    if os.path.exists(ETA_METADATA_PATH):
        try:
            with open(ETA_METADATA_PATH, "r", encoding="utf-8") as f:
                eta_metadata = json.load(f)
        except Exception as e:
            print(f"[ML Service ERROR] Failed to load ETA metadata: {e}")

    # Load Phase 3D Delay Risk Artifacts
    if os.path.exists(DELAY_MODEL_PATH):
        try:
            delay_pipeline = joblib.load(DELAY_MODEL_PATH)
            print(f"[ML Service] Loaded Phase 3D Delay Risk model from {DELAY_MODEL_PATH}")
        except Exception as e:
            print(f"[ML Service ERROR] Failed to load Delay Risk pipeline: {e}")
            delay_pipeline = None
    if os.path.exists(DELAY_METADATA_PATH):
        try:
            with open(DELAY_METADATA_PATH, "r", encoding="utf-8") as f:
                delay_metadata = json.load(f)
        except Exception as e:
            print(f"[ML Service ERROR] Failed to load Delay Risk metadata: {e}")

@app.on_event("startup")
def startup_event():
    load_artifacts()

class ETAPredictionRequest(BaseModel):
    distanceKm: float = Field(..., description="Estimated route distance in km")
    expectedDurationMin: float = Field(..., description="Baseline ORS duration in minutes")
    vehicleCapacityKg: float = Field(default=5000.0, description="Vehicle capacity in kg")
    cargoWeightKg: float = Field(default=500.0, description="Cargo weight in kg")
    cargoVolumeM3: float = Field(default=3.0, description="Cargo volume in m3")
    packageCount: int = Field(default=10, description="Total package count")
    temperatureC: float = Field(default=25.0, description="Ambient temperature in C")
    humidityPercent: float = Field(default=60.0, description="Humidity percentage")
    rainfallMm: float = Field(default=0.0, description="Rainfall depth in mm")
    windSpeedKmph: float = Field(default=10.0, description="Wind speed in km/h")
    visibilityKm: float = Field(default=10.0, description="Visibility in km")
    routeScore: float = Field(default=85.0, description="Route quality score 0-100")
    driverExperienceYears: int = Field(default=5, description="Driver experience in years")
    vehicleAgeYears: int = Field(default=3, description="Vehicle age in years")
    pickupHour: int = Field(default=10, description="Hour of pickup dispatch (0-23)")
    dayOfWeek: int = Field(default=2, description="Day of week (0=Monday, 6=Sunday)")
    month: int = Field(default=6, description="Month (1-12)")
    isWeekend: int = Field(default=0, description="1 if weekend, 0 otherwise")
    
    shipmentType: str = Field(default="STANDARD", description="STANDARD, EXPRESS, FRAGILE, PERISHABLE, BULK")
    priority: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH, URGENT")
    vehicleType: str = Field(default="TRUCK", description="BIKE, VAN, MINI_TRUCK, TRUCK, HEAVY_TRUCK")
    trafficLevel: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH, SEVERE")
    weatherCondition: str = Field(default="CLEAR", description="CLEAR, CLOUDY, OVERCAST, RAIN, HEAVY_RAIN, FOG, STORM")
    weatherRisk: str = Field(default="LOW", description="LOW, MEDIUM, HIGH")
    delayRisk: str = Field(default="LOW", description="LOW, MEDIUM, HIGH")

class DelayRiskPredictionRequest(BaseModel):
    distanceKm: float = Field(..., description="Estimated route distance in km")
    expectedDurationMin: float = Field(..., description="Baseline ORS duration in minutes")
    vehicleCapacityKg: float = Field(default=5000.0, description="Vehicle capacity in kg")
    cargoWeightKg: float = Field(default=500.0, description="Cargo weight in kg")
    cargoVolumeM3: float = Field(default=3.0, description="Cargo volume in m3")
    packageCount: int = Field(default=10, description="Total package count")
    temperatureC: float = Field(default=25.0, description="Ambient temperature in C")
    humidityPercent: float = Field(default=60.0, description="Humidity percentage")
    rainfallMm: float = Field(default=0.0, description="Rainfall depth in mm")
    windSpeedKmph: float = Field(default=10.0, description="Wind speed in km/h")
    visibilityKm: float = Field(default=10.0, description="Visibility in km")
    routeScore: float = Field(default=85.0, description="Route quality score 0-100")
    driverExperienceYears: int = Field(default=5, description="Driver experience in years")
    vehicleAgeYears: int = Field(default=3, description="Vehicle age in years")
    pickupHour: int = Field(default=10, description="Hour of pickup dispatch (0-23)")
    dayOfWeek: int = Field(default=2, description="Day of week (0=Monday, 6=Sunday)")
    month: int = Field(default=6, description="Month (1-12)")
    isWeekend: int = Field(default=0, description="1 if weekend, 0 otherwise")
    
    shipmentType: str = Field(default="STANDARD", description="STANDARD, EXPRESS, FRAGILE, PERISHABLE, BULK")
    priority: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH, URGENT")
    vehicleType: str = Field(default="TRUCK", description="BIKE, VAN, MINI_TRUCK, TRUCK, HEAVY_TRUCK")
    trafficLevel: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH, SEVERE")
    weatherCondition: str = Field(default="CLEAR", description="CLEAR, CLOUDY, OVERCAST, RAIN, HEAVY_RAIN, FOG, STORM")
    weatherRisk: str = Field(default="LOW", description="LOW, MEDIUM, HIGH")
    delayRisk: str = Field(default="LOW", description="LOW, MEDIUM, HIGH")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "RouteXAI ML Intelligence Microservice",
        "etaModelLoaded": eta_pipeline is not None,
        "etaModelName": eta_metadata.get("model_name", "GradientBoosting") if eta_metadata else None,
        "delayRiskModelLoaded": delay_pipeline is not None,
        "delayRiskModelName": delay_metadata.get("model_name", "GradientBoostingClassifier") if delay_metadata else None,
        "datasetType": "SYNTHETIC"
    }

@app.post("/predict/eta")
def predict_eta(req: ETAPredictionRequest):
    global eta_pipeline, eta_metadata
    if eta_pipeline is None:
        load_artifacts()
    
    if eta_pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Phase 3C ML Model Pipeline unavailable. Please run training script ml/scripts/train_eta_model.py."
        )

    try:
        feature_dict = {
            "distanceKm": [req.distanceKm],
            "expectedDurationMin": [req.expectedDurationMin],
            "vehicleCapacityKg": [req.vehicleCapacityKg],
            "cargoWeightKg": [req.cargoWeightKg],
            "cargoVolumeM3": [req.cargoVolumeM3],
            "packageCount": [req.packageCount],
            "temperatureC": [req.temperatureC],
            "humidityPercent": [req.humidityPercent],
            "rainfallMm": [req.rainfallMm],
            "windSpeedKmph": [req.windSpeedKmph],
            "visibilityKm": [req.visibilityKm],
            "routeScore": [req.routeScore],
            "driverExperienceYears": [req.driverExperienceYears],
            "vehicleAgeYears": [req.vehicleAgeYears],
            "pickupHour": [req.pickupHour],
            "dayOfWeek": [req.dayOfWeek],
            "month": [req.month],
            "isWeekend": [req.isWeekend],
            "shipmentType": [req.shipmentType.upper()],
            "priority": [req.priority.upper()],
            "vehicleType": [req.vehicleType.upper()],
            "trafficLevel": [req.trafficLevel.upper()],
            "weatherCondition": [req.weatherCondition.upper()],
            "weatherRisk": [req.weatherRisk.upper()],
            "delayRisk": [req.delayRisk.upper()]
        }

        input_df = pd.DataFrame(feature_dict)
        pred_val = float(eta_pipeline.predict(input_df)[0])
        pred_val = max(1.0, pred_val)

        diff = pred_val - req.expectedDurationMin

        return {
            "predictedDurationMin": round(pred_val, 2),
            "predictedDurationHours": round(pred_val / 60.0, 2),
            "baselineDurationMin": round(req.expectedDurationMin, 2),
            "baselineDurationHours": round(req.expectedDurationMin / 60.0, 2),
            "differenceFromBaselineMin": round(diff, 2),
            "model": eta_metadata.get("model_name", "GradientBoosting") if eta_metadata else "GradientBoosting",
            "status": "AVAILABLE",
            "datasetType": "SYNTHETIC",
            "metrics": eta_metadata.get("model_metrics", {}) if eta_metadata else {}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETA prediction error: {str(e)}")

@app.post("/predict/risk")
def predict_delay_risk(req: DelayRiskPredictionRequest):
    global delay_pipeline, delay_metadata
    if delay_pipeline is None:
        load_artifacts()
    
    if delay_pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Phase 3D Delay Risk Model Pipeline unavailable. Please run training script ml/scripts/train_delay_risk_model.py."
        )

    # Input validation
    if req.distanceKm <= 0 or req.expectedDurationMin <= 0:
        raise HTTPException(status_code=400, detail="distanceKm and expectedDurationMin must be greater than zero.")

    if req.cargoWeightKg < 0 or req.vehicleCapacityKg <= 0:
        raise HTTPException(status_code=400, detail="Invalid cargo weight or vehicle capacity parameters.")

    try:
        feature_dict = {
            "distanceKm": [req.distanceKm],
            "expectedDurationMin": [req.expectedDurationMin],
            "vehicleCapacityKg": [req.vehicleCapacityKg],
            "cargoWeightKg": [req.cargoWeightKg],
            "cargoVolumeM3": [req.cargoVolumeM3],
            "packageCount": [req.packageCount],
            "temperatureC": [req.temperatureC],
            "humidityPercent": [req.humidityPercent],
            "rainfallMm": [req.rainfallMm],
            "windSpeedKmph": [req.windSpeedKmph],
            "visibilityKm": [req.visibilityKm],
            "routeScore": [req.routeScore],
            "driverExperienceYears": [req.driverExperienceYears],
            "vehicleAgeYears": [req.vehicleAgeYears],
            "pickupHour": [req.pickupHour],
            "dayOfWeek": [req.dayOfWeek],
            "month": [req.month],
            "isWeekend": [req.isWeekend],
            "shipmentType": [req.shipmentType.upper()],
            "priority": [req.priority.upper()],
            "vehicleType": [req.vehicleType.upper()],
            "trafficLevel": [req.trafficLevel.upper()],
            "weatherCondition": [req.weatherCondition.upper()],
            "weatherRisk": [req.weatherRisk.upper()],
            "delayRisk": [req.delayRisk.upper()]
        }

        input_df = pd.DataFrame(feature_dict)
        
        # Predict Class Probabilities
        probs = delay_pipeline.predict_proba(input_df)[0]
        on_time_prob = float(probs[0])
        delay_prob = float(probs[1])

        prediction = "DELAYED" if delay_prob >= 0.50 else "ON_TIME"

        # Deterministic Risk Level Rule (Requirement 18)
        if delay_prob < 0.30:
            risk_level = "LOW"
        elif delay_prob < 0.60:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        def map_feature_name(feat_name: str) -> str:
            mapping = {
                "cat__delayRisk_LOW": "Synthetic Delay Risk (LOW)",
                "cat__delayRisk_MEDIUM": "Synthetic Delay Risk (MEDIUM)",
                "cat__delayRisk_HIGH": "Synthetic Delay Risk (HIGH)",
                "cat__priority_LOW": "Dispatch Priority (LOW)",
                "cat__priority_HIGH": "Dispatch Priority (HIGH)",
                "cat__priority_MEDIUM": "Dispatch Priority (MEDIUM)",
                "cat__priority_URGENT": "Dispatch Priority (URGENT)",
                "num__routeScore": "Route Quality Score",
                "num__expectedDurationMin": "Expected Transit Time",
                "num__distanceKm": "Route Distance",
                "num__driverExperienceYears": "Driver Experience",
                "cat__trafficLevel_HIGH": "Traffic Congestion (HIGH)",
                "cat__trafficLevel_MEDIUM": "Traffic Congestion (MEDIUM)",
                "cat__trafficLevel_LOW": "Traffic Congestion (LOW)",
                "cat__weatherRisk_LOW": "Weather Risk (LOW)",
                "cat__weatherRisk_HIGH": "Weather Risk (HIGH)",
                "cat__weatherRisk_MEDIUM": "Weather Risk (MEDIUM)",
                "num__visibilityKm": "Atmospheric Visibility",
                "num__rainfallMm": "Precipitation Depth",
                "num__temperatureC": "Ambient Temperature",
                "num__vehicleAgeYears": "Vehicle Age",
                "num__cargoWeightKg": "Cargo Weight",
                "num__vehicleCapacityKg": "Vehicle Capacity",
                "num__packageCount": "Package Count"
            }
            if feat_name in mapping:
                return mapping[feat_name]
            clean = feat_name.replace("num__", "").replace("cat__", "").replace("_", " ")
            return clean.title()

        key_factors = []
        if delay_metadata and "top_features" in delay_metadata:
            for item in delay_metadata["top_features"][:5]:
                raw_feat = item.get("feature", "")
                imp_val = round(float(item.get("importance", 0.0)) * 100.0, 2)
                key_factors.append({
                    "feature": map_feature_name(raw_feat),
                    "rawFeature": raw_feat,
                    "importance": imp_val
                })

        model_name = delay_metadata.get("model_name", "GradientBoostingClassifier") if delay_metadata else "GradientBoostingClassifier"
        model_version = delay_metadata.get("model_version", "1.0.0") if delay_metadata else "1.0.0"

        return {
            "prediction": prediction,
            "delayProbability": round(delay_prob * 100.0, 1),
            "onTimeProbability": round(on_time_prob * 100.0, 1),
            "delayProbabilityRaw": round(delay_prob, 4),
            "onTimeProbabilityRaw": round(on_time_prob, 4),
            "riskLevel": risk_level,
            "model": model_name,
            "modelVersion": model_version,
            "status": "AVAILABLE",
            "datasetType": "SYNTHETIC",
            "metrics": delay_metadata.get("model_metrics", {}) if delay_metadata else {},
            "keyFactors": key_factors
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delay Risk prediction error: {str(e)}")
