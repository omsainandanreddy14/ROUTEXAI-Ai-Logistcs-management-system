import argparse
import json
import math
import os
import pandas as pd
import numpy as np
from datetime import datetime

def haversine_dist(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def validate_dataset(csv_path="ml/data/synthetic/routexai_synthetic_logistics.csv", report_path="ml/reports/dataset_report.json"):
    print(f"\n[RouteXAI Validator] Loading dataset from: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset file not found at: {csv_path}")

    df = pd.read_csv(csv_path)
    total_records = len(df)
    print(f"[RouteXAI Validator] Validating {total_records:,} records...")

    validation_results = {}
    failures = []

    # 1. Unique Shipment IDs
    dup_ids = df["shipmentId"].duplicated().sum()
    validation_results["duplicateShipmentIds"] = int(dup_ids)
    if dup_ids > 0:
        failures.append(f"Found {dup_ids} duplicate shipment IDs.")

    # 2. Non-negative distance
    neg_dist = (df["distanceKm"] <= 0).sum()
    validation_results["negativeDistance"] = int(neg_dist)
    if neg_dist > 0:
        failures.append(f"Found {neg_dist} records with invalid/negative distance.")

    # 3. Non-negative cargo weight & volume
    neg_weight = (df["cargoWeightKg"] <= 0).sum()
    validation_results["negativeCargoWeight"] = int(neg_weight)
    if neg_weight > 0:
        failures.append(f"Found {neg_weight} records with invalid cargo weight.")

    # 4. Non-negative package count
    neg_pkg = (df["packageCount"] <= 0).sum()
    validation_results["negativePackageCount"] = int(neg_pkg)
    if neg_pkg > 0:
        failures.append(f"Found {neg_pkg} records with invalid package count.")

    # 5. Geographically valid coordinates
    invalid_coords = (
        (df["pickupLatitude"] < -90) | (df["pickupLatitude"] > 90) |
        (df["pickupLongitude"] < -180) | (df["pickupLongitude"] > 180) |
        (df["deliveryLatitude"] < -90) | (df["deliveryLatitude"] > 90) |
        (df["deliveryLongitude"] < -180) | (df["deliveryLongitude"] > 180)
    ).sum()
    validation_results["invalidCoordinates"] = int(invalid_coords)
    if invalid_coords > 0:
        failures.append(f"Found {invalid_coords} records with out-of-bounds coordinates.")

    # 6. Vehicle capacity violation
    capacity_violations = (df["cargoWeightKg"] > df["vehicleCapacityKg"]).sum()
    validation_results["vehicleCapacityViolations"] = int(capacity_violations)
    if capacity_violations > 0:
        failures.append(f"Found {capacity_violations} records where cargo weight exceeds vehicle capacity.")

    # 7. Non-negative duration
    invalid_durations = ((df["expectedDurationMin"] <= 0) | (df["actualDurationMin"] <= 0)).sum()
    validation_results["invalidDurations"] = int(invalid_durations)
    if invalid_durations > 0:
        failures.append(f"Found {invalid_durations} records with non-positive expected or actual duration.")

    # 8. Delivery Timestamp > Pickup Timestamp
    pickup_ts = pd.to_datetime(df["pickupTimestamp"])
    delivery_ts = pd.to_datetime(df["deliveryTimestamp"])
    timestamp_violations = (delivery_ts <= pickup_ts).sum()
    validation_results["timestampSequenceViolations"] = int(timestamp_violations)
    if timestamp_violations > 0:
        failures.append(f"Found {timestamp_violations} records where deliveryTimestamp <= pickupTimestamp.")

    # 9. Delay Minutes Consistency: delayMinutes == actualDurationMin - expectedDurationMin
    calc_delay = (df["actualDurationMin"] - df["expectedDurationMin"]).round(1)
    delay_diff = (calc_delay - df["delayMinutes"].round(1)).abs()
    delay_inconsistent = (delay_diff > 0.1).sum()
    validation_results["delayMinutesInconsistent"] = int(delay_inconsistent)
    if delay_inconsistent > 0:
        failures.append(f"Found {delay_inconsistent} records where delayMinutes does not equal (actual - expected).")

    # 10. Delay Status Consistency (Threshold: delayMinutes > 20.0 -> DELAYED)
    expected_status = df["delayMinutes"].apply(lambda d: "DELAYED" if d > 20.0 else "ON_TIME")
    status_mismatch = (expected_status != df["delayStatus"]).sum()
    validation_results["delayStatusMismatch"] = int(status_mismatch)
    if status_mismatch > 0:
        failures.append(f"Found {status_mismatch} records where delayStatus does not match delay threshold.")

    # 11. Derived time features match pickupTimestamp
    derived_dow = pickup_ts.dt.weekday
    derived_month = pickup_ts.dt.month
    derived_weekend = derived_dow.apply(lambda w: 1 if w >= 5 else 0)

    dow_diff = (derived_dow != df["dayOfWeek"]).sum()
    month_diff = (derived_month != df["month"]).sum()
    weekend_diff = (derived_weekend != df["isWeekend"]).sum()

    time_derived_mismatch = int(dow_diff + month_diff + weekend_diff)
    validation_results["derivedTimeFeatureMismatch"] = time_derived_mismatch
    if time_derived_mismatch > 0:
        failures.append(f"Found {time_derived_mismatch} derived time feature mismatches.")

    # 12. Distance vs Coordinates check (Geodesic check)
    geo_distances = np.array([
        haversine_dist(r["pickupLatitude"], r["pickupLongitude"], r["deliveryLatitude"], r["deliveryLongitude"])
        for _, r in df.iterrows()
    ])
    # Road network ratio should be between 0.95 and 3.0 for valid routes
    ratios = df["distanceKm"].values / np.maximum(0.5, geo_distances)
    distance_anomalies = int(((ratios < 0.95) | (ratios > 3.0)).sum())
    validation_results["distanceAnomalies"] = distance_anomalies
    if distance_anomalies > 0:
        failures.append(f"Found {distance_anomalies} distance vs coordinate anomalies.")

    passed_all = len(failures) == 0

    print("\n--- VALIDATION SUMMARY ---")
    print(f"Total Records Analyzed: {total_records:,}")
    print(f"Validation Status: {'PASSED [SUCCESS]' if passed_all else 'FAILED [ERRORS DETECTED]'}")
    
    if failures:
        print("\nFailures Detected:")
        for f in failures:
            print(f"  - {f}")
    else:
        print("All 12 Data Quality Validation Checks Passed Successfully!")

    # Write report JSON
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    report_data = {
        "validationTimestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "datasetPath": csv_path,
        "totalRecords": total_records,
        "validRecords": total_records if passed_all else total_records - len(failures),
        "invalidRecords": len(failures),
        "validationStatus": "PASSED" if passed_all else "FAILED",
        "validationChecks": validation_results,
        "failures": failures
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    print(f"[RouteXAI Validator] Validation report saved to: {report_path}\n")
    return passed_all

def main():
    parser = argparse.ArgumentParser(description="RouteXAI Phase 3B Dataset Validator")
    parser.add_argument("--csv", type=str, default="ml/data/synthetic/routexai_synthetic_logistics.csv", help="Path to CSV dataset")
    parser.add_argument("--report", type=str, default="ml/reports/dataset_report.json", help="Path to report output JSON")
    
    args = parser.parse_args()
    success = validate_dataset(args.csv, args.report)
    if not success:
        exit(1)

if __name__ == "__main__":
    main()
