import argparse
import json
import os
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for headless execution
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

def analyze_dataset(csv_path="ml/data/synthetic/routexai_synthetic_logistics.csv", reports_dir="ml/reports"):
    print(f"\n[RouteXAI Analyzer] Loading dataset for statistical analysis: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset file not found at: {csv_path}")

    df = pd.read_csv(csv_path)
    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs(os.path.join(reports_dir, "plots"), exist_ok=True)

    print(f"[RouteXAI Analyzer] Dataset shape: {df.shape[0]:,} rows, {df.shape[1]} columns")

    # 1. Plot Distance Distribution
    plt.figure(figsize=(8, 5))
    plt.hist(df["distanceKm"], bins=50, color="#06b6d4", edgecolor="#020617", alpha=0.85)
    plt.title("Synthetic Logistics — Road Distance Distribution (Km)", fontsize=12, fontweight="bold")
    plt.xlabel("Distance (Km)")
    plt.ylabel("Shipment Count")
    plt.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "distance_distribution.png"), dpi=150)
    plt.close()

    # 2. Plot Duration Distribution
    plt.figure(figsize=(8, 5))
    plt.hist(df["actualDurationMin"], bins=50, color="#10b981", edgecolor="#020617", alpha=0.85, label="Actual Duration")
    plt.hist(df["expectedDurationMin"], bins=50, color="#6366f1", edgecolor="#020617", alpha=0.5, label="Expected Duration")
    plt.title("Expected vs Actual Duration Distribution (Minutes)", fontsize=12, fontweight="bold")
    plt.xlabel("Duration (Minutes)")
    plt.ylabel("Shipment Count")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "duration_distribution.png"), dpi=150)
    plt.close()

    # 3. Expected vs Actual Scatter
    plt.figure(figsize=(8, 5))
    plt.scatter(df["expectedDurationMin"], df["actualDurationMin"], c=df["delayMinutes"], cmap="coolwarm", alpha=0.4, s=15)
    plt.plot([0, df["expectedDurationMin"].max()], [0, df["expectedDurationMin"].max()], color="red", linestyle="--", label="1:1 On-Time Ideal")
    plt.title("Expected Duration vs Actual Duration (Colored by Delay Min)", fontsize=12, fontweight="bold")
    plt.xlabel("Expected Duration (Minutes)")
    plt.ylabel("Actual Duration (Minutes)")
    plt.colorbar(label="Delay Minutes")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "expected_vs_actual_duration.png"), dpi=150)
    plt.close()

    # 4. Delay Distribution
    plt.figure(figsize=(8, 5))
    plt.hist(df["delayMinutes"], bins=50, color="#f43f5e", edgecolor="#020617", alpha=0.85)
    plt.axvline(20.0, color="black", linestyle="--", linewidth=2, label="Delay Threshold (20.0 min)")
    plt.title("Delay Minutes Distribution", fontsize=12, fontweight="bold")
    plt.xlabel("Delay (Minutes)")
    plt.ylabel("Shipment Count")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "delay_distribution.png"), dpi=150)
    plt.close()

    # 5. Categorical Distributions (Grid of Subplots)
    fig, axes = plt.subplots(2, 3, figsize=(15, 9))
    
    # Vehicle Type
    df["vehicleType"].value_counts().plot(kind="bar", ax=axes[0, 0], color="#06b6d4", edgecolor="#020617")
    axes[0, 0].set_title("Vehicle Type Distribution", fontweight="bold")
    axes[0, 0].tick_params(axis='x', rotation=45)

    # Priority
    df["priority"].value_counts().plot(kind="bar", ax=axes[0, 1], color="#a855f7", edgecolor="#020617")
    axes[0, 1].set_title("Shipment Priority Distribution", fontweight="bold")
    axes[0, 1].tick_params(axis='x', rotation=45)

    # Traffic Level
    df["trafficLevel"].value_counts().plot(kind="bar", ax=axes[0, 2], color="#f59e0b", edgecolor="#020617")
    axes[0, 2].set_title("Traffic Level Distribution", fontweight="bold")
    axes[0, 2].tick_params(axis='x', rotation=45)

    # Weather Condition
    df["weatherCondition"].value_counts().plot(kind="bar", ax=axes[1, 0], color="#3b82f6", edgecolor="#020617")
    axes[1, 0].set_title("Weather Condition Distribution", fontweight="bold")
    axes[1, 0].tick_params(axis='x', rotation=45)

    # Weather Risk
    df["weatherRisk"].value_counts().plot(kind="bar", ax=axes[1, 1], color="#ec4899", edgecolor="#020617")
    axes[1, 1].set_title("Weather Risk Distribution", fontweight="bold")
    axes[1, 1].tick_params(axis='x', rotation=45)

    # Delay Status
    df["delayStatus"].value_counts().plot(kind="bar", ax=axes[1, 2], color=["#10b981", "#ef4444"], edgecolor="#020617")
    axes[1, 2].set_title("Delay Status (Target Class Balance)", fontweight="bold")
    axes[1, 2].tick_params(axis='x', rotation=0)

    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "categorical_distributions.png"), dpi=150)
    plt.close()

    # 6. Delay Rate by Traffic and Weather Risk
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    traffic_delay = df.groupby("trafficLevel")["delayStatus"].apply(lambda x: (x == "DELAYED").mean() * 100)
    traffic_delay.plot(kind="bar", ax=axes[0], color="#f59e0b", edgecolor="#020617")
    axes[0].set_title("Delay Rate (%) by Traffic Level", fontweight="bold")
    axes[0].set_ylabel("Delayed Shipments (%)")
    axes[0].tick_params(axis='x', rotation=0)

    weather_delay = df.groupby("weatherRisk")["delayStatus"].apply(lambda x: (x == "DELAYED").mean() * 100)
    weather_delay.plot(kind="bar", ax=axes[1], color="#ec4899", edgecolor="#020617")
    axes[1].set_title("Delay Rate (%) by Weather Risk", fontweight="bold")
    axes[1].set_ylabel("Delayed Shipments (%)")
    axes[1].tick_params(axis='x', rotation=0)

    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, "plots", "delay_rate_analysis.png"), dpi=150)
    plt.close()

    print(f"[RouteXAI Analyzer] Generated 6 analysis plots in: {os.path.join(reports_dir, 'plots')}")

    # Generate Data Dictionary Markdown
    data_dict_md = """# RouteXAI Synthetic Logistics Dataset — Data Dictionary

> [!IMPORTANT]
> **Dataset Type**: `SYNTHETIC`  
> **Purpose**: Initial ML Architecture Development for Phase 3C (ETA Prediction Regression) & Phase 3D (Delay Classification).  
> **Notice**: This dataset contains synthetic records generated for offline ML engineering and is **never** saved in MongoDB or presented as real operational history.

---

## 1. Column Definitions & Specifications

| Column Name | Datatype | Unit | Role | Origin | Description | Example Value |
|:---|:---|:---|:---|:---|:---|:---|
| `shipmentId` | `string` | — | Identifier | Synthetic ID | Unique synthetic shipment tracking ID | `RXAI-SYN-42-000001` |
| `shipmentType` | `string` | — | Feature | Synthetic Categorical | Logistics cargo classification (`STANDARD`, `EXPRESS`, `FRAGILE`, `PERISHABLE`, `BULK`) | `STANDARD` |
| `priority` | `string` | — | Feature | Synthetic Categorical | Dispatch operational priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) | `MEDIUM` |
| `packageCount` | `integer` | count | Feature | Synthetic Discrete | Total packages in shipment | `6` |
| `cargoWeightKg` | `float` | kg | Feature | Synthetic Continuous | Cargo weight in Kilograms | `450.5` |
| `cargoVolumeM3` | `float` | m³ | Feature | Synthetic Continuous | Cargo volume in Cubic Meters | `2.15` |
| `pickupCity` | `string` | — | Feature | Indian Database | Customer pickup city | `Ludhiana` |
| `pickupLatitude` | `float` | deg | Feature | Synthetic Geo | Customer pickup latitude (-90 to +90) | `30.9010` |
| `pickupLongitude` | `float` | deg | Feature | Synthetic Geo | Customer pickup longitude (-180 to +180) | `75.8573` |
| `deliveryCity` | `string` | — | Feature | Indian Database | Customer delivery city | `Vijayawada` |
| `deliveryLatitude` | `float` | deg | Feature | Synthetic Geo | Customer delivery latitude (-90 to +90) | `16.5062` |
| `deliveryLongitude` | `float` | deg | Feature | Synthetic Geo | Customer delivery longitude (-180 to +180) | `80.6480` |
| `distanceKm` | `float` | km | Feature | Haversine + Factor | Estimated road distance between customer pickup & delivery | `2116.63` |
| `vehicleType` | `string` | — | Feature | Feasibility Match | Category of logistics vehicle assigned (`BIKE`, `VAN`, `MINI_TRUCK`, `TRUCK`, `HEAVY_TRUCK`) | `TRUCK` |
| `vehicleCapacityKg` | `float` | kg | Feature | Vehicle Spec | Vehicle payload capacity in Kilograms (always >= cargoWeightKg) | `10000.0` |
| `vehicleAgeYears` | `integer` | years | Feature | Synthetic Discrete | Vehicle operational age in years | `4` |
| `driverExperienceYears` | `integer` | years | Feature | Synthetic Discrete | Driver commercial driving experience in years | `8` |
| `pickupDate` | `string` | YYYY-MM-DD | Feature | Synthetic Date | Date of shipment pickup | `2025-04-12` |
| `pickupTimestamp` | `string` | ISO Timestamp | Feature | Synthetic Timestamp | Full timestamp of shipment pickup | `2025-04-12 09:30:00` |
| `pickupHour` | `integer` | hour (0-23) | Feature | Derived Timestamp | Hour of pickup dispatch | `9` |
| `dayOfWeek` | `integer` | 0-6 | Feature | Derived Timestamp | Day of week (0=Monday, 6=Sunday) | `5` |
| `month` | `integer` | 1-12 | Feature | Derived Timestamp | Calendar month of pickup | `4` |
| `isWeekend` | `integer` | 0 or 1 | Feature | Derived Timestamp | Weekend flag (1 if Saturday/Sunday else 0) | `1` |
| `trafficLevel` | `string` | — | Feature | Synthetic Categorical | Traffic congestion level (`LOW`, `MEDIUM`, `HIGH`, `SEVERE`) | `MEDIUM` |
| `temperatureC` | `float` | °C | Feature | Synthetic Weather | Ambient temperature in Celsius | `32.5` |
| `humidityPercent` | `float` | % | Feature | Synthetic Weather | Relative humidity percentage | `65.0` |
| `rainfallMm` | `float` | mm | Feature | Synthetic Weather | Precipitation depth in Millimeters | `0.0` |
| `windSpeedKmph` | `float` | km/h | Feature | Synthetic Weather | Wind speed in Km/h | `14.2` |
| `visibilityKm` | `float` | km | Feature | Synthetic Weather | Atmospheric visibility distance in Km | `9.5` |
| `weatherCondition` | `string` | — | Feature | Synthetic Weather | Weather state (`CLEAR`, `CLOUDY`, `OVERCAST`, `RAIN`, `HEAVY_RAIN`, `FOG`, `STORM`) | `CLEAR` |
| `weatherRisk` | `string` | — | Feature | Derived Weather | Route weather risk classification (`LOW`, `MEDIUM`, `HIGH`) | `LOW` |
| `routeScore` | `float` | 0-100 rating | Feature | Synthetic Score | Rule-based route quality and efficiency score | `88.5` |
| `expectedDurationMin` | `float` | min | Feature | Speed Formula | Synthetic baseline expected transit duration | `2340.0` |
| `actualDurationMin` | `float` | min | **ETA Target (3C)** | Synthetic Simulation | Total actual transit duration from pickup to delivery | `2415.5` |
| `deliveryTimestamp` | `string` | ISO Timestamp | **Target Leakage** | `pickup + actual` | Timestamp of shipment delivery (**EXCLUDED from ML features**) | `2025-04-14 01:45:30` |
| `delayMinutes` | `float` | min | **Target Leakage** | `actual - expected` | Delay in minutes (**EXCLUDED from ML features**) | `75.5` |
| `delayStatus` | `string` | — | **Delay Target (3D)** | Derived Label | Delay classification (`ON_TIME`, `DELAYED` if delay > 20 min) | `DELAYED` |
| `delayRisk` | `string` | — | Feature | Input Feature | Expected delay risk pipeline feature (`LOW`, `MEDIUM`, `HIGH`) | `MEDIUM` |
| `datasetType` | `string` | — | Constant | Meta | Dataset label (`SYNTHETIC`) | `SYNTHETIC` |

---

## 2. Feature Scoping & No-Leakage Rules

### Phase 3C: ETA Prediction Model (Regression)
- **Target**: `actualDurationMin`
- **Features Used**: `distanceKm`, `expectedDurationMin`, `vehicleType`, `vehicleCapacityKg`, `cargoWeightKg`, `cargoVolumeM3`, `packageCount`, `priority`, `trafficLevel`, `temperatureC`, `humidityPercent`, `rainfallMm`, `windSpeedKmph`, `visibilityKm`, `weatherCondition`, `weatherRisk`, `routeScore`, `driverExperienceYears`, `vehicleAgeYears`, `pickupHour`, `dayOfWeek`, `month`, `isWeekend`, `delayRisk`.
- **Excluded Features (Target Leakage)**: `actualDurationMin` (target), `deliveryTimestamp`, `delayMinutes`, `delayStatus`.

### Phase 3D: Delay Risk Classification Model (Classification)
- **Target**: `delayStatus` (`ON_TIME` vs `DELAYED`)
- **Features Used**: `distanceKm`, `expectedDurationMin`, `vehicleType`, `vehicleCapacityKg`, `cargoWeightKg`, `packageCount`, `priority`, `trafficLevel`, `temperatureC`, `rainfallMm`, `windSpeedKmph`, `visibilityKm`, `weatherCondition`, `weatherRisk`, `routeScore`, `driverExperienceYears`, `vehicleAgeYears`, `pickupHour`, `dayOfWeek`, `month`, `isWeekend`, `delayRisk`.
- **Excluded Features (Target Leakage)**: `delayStatus` (target), `actualDurationMin`, `delayMinutes`, `deliveryTimestamp`.
"""

    with open(os.path.join(reports_dir, "data_dictionary.md"), "w", encoding="utf-8") as f:
        f.write(data_dict_md)
    print(f"[RouteXAI Analyzer] Data dictionary saved to: {os.path.join(reports_dir, 'data_dictionary.md')}")

    # Generate Statistical Report JSON
    stats_json = {
        "datasetName": "RouteXAI Synthetic Logistics Dataset Report",
        "datasetPath": csv_path,
        "totalRecords": len(df),
        "totalColumns": len(df.columns),
        "missingValues": int(df.isnull().sum().sum()),
        "targetColumns": {
            "etaRegressionTarget": "actualDurationMin",
            "delayClassificationTarget": "delayStatus"
        },
        "classDistributions": {
            "delayStatus": df["delayStatus"].value_counts().to_dict(),
            "vehicleType": df["vehicleType"].value_counts().to_dict(),
            "priority": df["priority"].value_counts().to_dict(),
            "trafficLevel": df["trafficLevel"].value_counts().to_dict(),
            "weatherCondition": df["weatherCondition"].value_counts().to_dict(),
            "weatherRisk": df["weatherRisk"].value_counts().to_dict()
        },
        "numericalStatistics": {
            "distanceKm": {
                "min": round(float(df["distanceKm"].min()), 2),
                "max": round(float(df["distanceKm"].max()), 2),
                "mean": round(float(df["distanceKm"].mean()), 2),
                "median": round(float(df["distanceKm"].median()), 2),
                "std": round(float(df["distanceKm"].std()), 2)
            },
            "expectedDurationMin": {
                "min": round(float(df["expectedDurationMin"].min()), 2),
                "max": round(float(df["expectedDurationMin"].max()), 2),
                "mean": round(float(df["expectedDurationMin"].mean()), 2),
                "median": round(float(df["expectedDurationMin"].median()), 2)
            },
            "actualDurationMin": {
                "min": round(float(df["actualDurationMin"].min()), 2),
                "max": round(float(df["actualDurationMin"].max()), 2),
                "mean": round(float(df["actualDurationMin"].mean()), 2),
                "median": round(float(df["actualDurationMin"].median()), 2)
            },
            "delayMinutes": {
                "min": round(float(df["delayMinutes"].min()), 2),
                "max": round(float(df["delayMinutes"].max()), 2),
                "mean": round(float(df["delayMinutes"].mean()), 2),
                "median": round(float(df["delayMinutes"].median()), 2)
            }
        }
    }

    with open(os.path.join(reports_dir, "dataset_report.json"), "w", encoding="utf-8") as f:
        json.dump(stats_json, f, indent=2)

    print(f"[RouteXAI Analyzer] Statistical dataset report saved to: {os.path.join(reports_dir, 'dataset_report.json')}")
    print("[RouteXAI Analyzer] Phase 3B Dataset Analysis Complete!\n")

def main():
    parser = argparse.ArgumentParser(description="RouteXAI Phase 3B Dataset Analyzer")
    parser.add_argument("--csv", type=str, default="ml/data/synthetic/routexai_synthetic_logistics.csv", help="Path to CSV dataset")
    parser.add_argument("--reports", type=str, default="ml/reports", help="Path to reports output folder")
    
    args = parser.parse_args()
    analyze_dataset(args.csv, args.reports)

if __name__ == "__main__":
    main()
