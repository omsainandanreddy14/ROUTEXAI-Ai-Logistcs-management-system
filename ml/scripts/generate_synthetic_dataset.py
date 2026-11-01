import argparse
import json
import math
import os
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Comprehensive Indian Logistics City Database
INDIAN_CITIES = [
    {"name": "Delhi", "lat": 28.6139, "lng": 77.2090, "tier": "METRO"},
    {"name": "Mumbai", "lat": 19.0760, "lng": 72.8777, "tier": "METRO"},
    {"name": "Bengaluru", "lat": 12.9716, "lng": 77.5946, "tier": "METRO"},
    {"name": "Hyderabad", "lat": 17.3850, "lng": 78.4867, "tier": "METRO"},
    {"name": "Chennai", "lat": 13.0827, "lng": 80.2707, "tier": "METRO"},
    {"name": "Kolkata", "lat": 22.5726, "lng": 88.3639, "tier": "METRO"},
    {"name": "Pune", "lat": 18.5204, "lng": 73.8567, "tier": "TIER1"},
    {"name": "Ahmedabad", "lat": 23.0225, "lng": 72.5714, "tier": "TIER1"},
    {"name": "Jaipur", "lat": 26.9124, "lng": 75.7873, "tier": "TIER1"},
    {"name": "Lucknow", "lat": 26.8467, "lng": 80.9462, "tier": "TIER1"},
    {"name": "Chandigarh", "lat": 30.7333, "lng": 76.7794, "tier": "TIER1"},
    {"name": "Amritsar", "lat": 31.6340, "lng": 74.8723, "tier": "TIER2"},
    {"name": "Ludhiana", "lat": 30.9010, "lng": 75.8573, "tier": "TIER2"},
    {"name": "Phagwara", "lat": 31.2485, "lng": 75.7006, "tier": "TIER2"},
    {"name": "Coimbatore", "lat": 11.0168, "lng": 76.9558, "tier": "TIER2"},
    {"name": "Vijayawada", "lat": 16.5062, "lng": 80.6480, "tier": "TIER2"},
    {"name": "Visakhapatnam", "lat": 17.6868, "lng": 83.2185, "tier": "TIER2"},
    {"name": "Bhopal", "lat": 23.2599, "lng": 77.4126, "tier": "TIER2"},
    {"name": "Indore", "lat": 22.7196, "lng": 75.8577, "tier": "TIER2"},
    {"name": "Nagpur", "lat": 21.1458, "lng": 79.0882, "tier": "TIER2"},
    {"name": "Surat", "lat": 21.1702, "lng": 72.8311, "tier": "TIER2"},
    {"name": "Mittamadapalle", "lat": 14.3895, "lng": 78.7520, "tier": "TIER2"}
]

# Vehicle Specs & Payload Capacity
VEHICLE_SPECS = {
    "BIKE": {"min_cap": 20, "max_cap": 50, "max_dist": 40, "avg_speed": 35.0},
    "VAN": {"min_cap": 300, "max_cap": 1000, "max_dist": 300, "avg_speed": 45.0},
    "MINI_TRUCK": {"min_cap": 1200, "max_cap": 3500, "max_dist": 800, "avg_speed": 50.0},
    "TRUCK": {"min_cap": 5000, "max_cap": 12000, "max_dist": 2500, "avg_speed": 55.0},
    "HEAVY_TRUCK": {"min_cap": 15000, "max_cap": 30000, "max_dist": 4000, "avg_speed": 50.0}
}

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Earth radius in Km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def generate_synthetic_data(num_rows=10000, seed=42):
    random.seed(seed)
    np.random.seed(seed)

    print(f"[RouteXAI Generator] Generating {num_rows:,} synthetic logistics shipment records (Seed: {seed})...")

    records = []
    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 12, 31)
    date_range_days = (end_date - start_date).days

    for i in range(1, num_rows + 1):
        shipment_id = f"RXAI-SYN-{seed}-{i:06d}"
        
        # 1. Location Sampling
        pickup_city = random.choice(INDIAN_CITIES)
        # 30% intra-city, 70% inter-city
        if random.random() < 0.30:
            delivery_city = pickup_city
        else:
            delivery_city = random.choice([c for c in INDIAN_CITIES if c["name"] != pickup_city["name"]])

        # Add realistic coordinate jitter (0.015 to 0.15 degrees ~ 2km to 18km offset)
        if pickup_city["name"] == delivery_city["name"]:
          # Intra-city delivery: add offset ensuring 2km - 25km urban radius
          angle = random.uniform(0, 2 * math.pi)
          radius_deg = random.uniform(0.02, 0.18)
          pickup_lat = round(pickup_city["lat"] + radius_deg * math.sin(angle), 6)
          pickup_lng = round(pickup_city["lng"] + radius_deg * math.cos(angle), 6)
          
          angle2 = random.uniform(0, 2 * math.pi)
          radius_deg2 = random.uniform(0.02, 0.18)
          delivery_lat = round(delivery_city["lat"] + radius_deg2 * math.sin(angle2), 6)
          delivery_lng = round(delivery_city["lng"] + radius_deg2 * math.cos(angle2), 6)
        else:
          pickup_lat = round(pickup_city["lat"] + np.random.normal(0, 0.03), 6)
          pickup_lng = round(pickup_city["lng"] + np.random.normal(0, 0.03), 6)
          
          delivery_lat = round(delivery_city["lat"] + np.random.normal(0, 0.03), 6)
          delivery_lng = round(delivery_city["lng"] + np.random.normal(0, 0.03), 6)

        geo_dist = haversine_distance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)
        while geo_dist < 1.0:
            delivery_lat = round(delivery_lat + random.choice([-0.02, 0.02]), 6)
            delivery_lng = round(delivery_lng + random.choice([-0.02, 0.02]), 6)
            geo_dist = haversine_distance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)

        # Realistic road network factor (1.18 to 1.38)
        road_factor = round(random.uniform(1.18, 1.38), 3)
        distance_km = round(geo_dist * road_factor, 2)

        # 2. Cargo & Shipment Attributes
        shipment_type = random.choices(
            ["STANDARD", "EXPRESS", "FRAGILE", "PERISHABLE", "BULK"],
            weights=[0.40, 0.25, 0.15, 0.10, 0.10]
        )[0]

        priority = random.choices(
            ["LOW", "MEDIUM", "HIGH", "URGENT"],
            weights=[0.20, 0.50, 0.20, 0.10]
        )[0]

        if shipment_type == "BULK":
            package_count = random.randint(15, 120)
            cargo_weight_kg = round(random.uniform(2000, 22000), 2)
        elif shipment_type == "EXPRESS":
            package_count = random.randint(1, 6)
            cargo_weight_kg = round(random.uniform(1, 150), 2)
        elif shipment_type == "PERISHABLE":
            package_count = random.randint(5, 40)
            cargo_weight_kg = round(random.uniform(50, 2500), 2)
        elif shipment_type == "FRAGILE":
            package_count = random.randint(1, 15)
            cargo_weight_kg = round(random.uniform(5, 500), 2)
        else:  # STANDARD
            package_count = random.randint(1, 25)
            cargo_weight_kg = round(random.uniform(10, 4000), 2)

        # Volume correlation
        density_kg_m3 = random.uniform(120, 350)
        cargo_volume_m3 = round(max(0.01, cargo_weight_kg / density_kg_m3), 3)

        # 3. Vehicle Assignment (Strictly Feasible: Weight <= Capacity)
        if cargo_weight_kg <= 40 and distance_km <= 35:
            possible_vehicles = ["BIKE", "VAN"]
        elif cargo_weight_kg <= 750 and distance_km <= 250:
            possible_vehicles = ["VAN", "MINI_TRUCK"]
        elif cargo_weight_kg <= 2500:
            possible_vehicles = ["MINI_TRUCK", "TRUCK"]
        elif cargo_weight_kg <= 9000:
            possible_vehicles = ["TRUCK", "HEAVY_TRUCK"]
        else:
            possible_vehicles = ["HEAVY_TRUCK"]

        vehicle_type = random.choice(possible_vehicles)
        v_spec = VEHICLE_SPECS[vehicle_type]
        vehicle_capacity_kg = round(max(cargo_weight_kg * random.uniform(1.1, 1.5), v_spec["min_cap"]), 2)
        vehicle_age_years = random.randint(0, 12)
        driver_experience_years = random.randint(1, 25)

        # 4. Time Features
        random_days = random.randint(0, date_range_days)
        pickup_dt = start_date + timedelta(days=random_days)
        
        # Hourly distribution with morning/evening rush peaks
        hour_weights = [1, 1, 1, 1, 2, 3, 5, 8, 10, 9, 8, 7, 7, 7, 8, 9, 10, 9, 7, 5, 4, 3, 2, 1]
        pickup_hour = random.choices(range(24), weights=hour_weights)[0]
        pickup_minute = random.randint(0, 59)
        pickup_timestamp_dt = pickup_dt.replace(hour=pickup_hour, minute=pickup_minute, second=0)

        day_of_week = pickup_timestamp_dt.weekday()  # 0=Mon, 6=Sun
        month = pickup_timestamp_dt.month
        is_weekend = 1 if day_of_week >= 5 else 0

        # 5. Traffic Conditions
        if (pickup_hour in [8, 9, 10, 17, 18, 19]) and not is_weekend:
            traffic_level = random.choices(["MEDIUM", "HIGH", "SEVERE"], weights=[0.25, 0.50, 0.25])[0]
        elif (pickup_hour in [11, 12, 13, 14, 15, 16]) and not is_weekend:
            traffic_level = random.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.30, 0.50, 0.20])[0]
        elif is_weekend:
            traffic_level = random.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.50, 0.40, 0.10])[0]
        else:
            traffic_level = random.choices(["LOW", "MEDIUM"], weights=[0.80, 0.20])[0]

        # 6. Weather Conditions (Synthetic Historical)
        # Seasonality influence
        if month in [6, 7, 8, 9]:  # Monsoon
            weather_cond = random.choices(["CLEAR", "CLOUDY", "OVERCAST", "RAIN", "HEAVY_RAIN"], weights=[0.20, 0.20, 0.20, 0.25, 0.15])[0]
        elif month in [12, 1, 2]:  # Winter
            weather_cond = random.choices(["CLEAR", "CLOUDY", "FOG", "OVERCAST"], weights=[0.55, 0.20, 0.15, 0.10])[0]
        else:  # Summer / Spring
            weather_cond = random.choices(["CLEAR", "CLOUDY", "STORM", "RAIN"], weights=[0.70, 0.20, 0.05, 0.05])[0]

        if weather_cond == "CLEAR":
            temp_c = round(random.uniform(20.0, 42.0), 1)
            humidity = round(random.uniform(30.0, 60.0), 1)
            rainfall_mm = 0.0
            wind_speed = round(random.uniform(5.0, 20.0), 1)
            visibility_km = round(random.uniform(8.0, 10.0), 1)
            weather_risk = "LOW"
        elif weather_cond == "CLOUDY":
            temp_c = round(random.uniform(18.0, 38.0), 1)
            humidity = round(random.uniform(50.0, 75.0), 1)
            rainfall_mm = 0.0
            wind_speed = round(random.uniform(8.0, 25.0), 1)
            visibility_km = round(random.uniform(6.0, 9.0), 1)
            weather_risk = "LOW"
        elif weather_cond == "OVERCAST":
            temp_c = round(random.uniform(16.0, 35.0), 1)
            humidity = round(random.uniform(65.0, 85.0), 1)
            rainfall_mm = round(random.uniform(0.1, 2.5), 1)
            wind_speed = round(random.uniform(10.0, 30.0), 1)
            visibility_km = round(random.uniform(5.0, 8.0), 1)
            weather_risk = "MEDIUM"
        elif weather_cond == "RAIN":
            temp_c = round(random.uniform(18.0, 30.0), 1)
            humidity = round(random.uniform(80.0, 95.0), 1)
            rainfall_mm = round(random.uniform(5.0, 35.0), 1)
            wind_speed = round(random.uniform(15.0, 40.0), 1)
            visibility_km = round(random.uniform(3.0, 6.0), 1)
            weather_risk = "MEDIUM"
        elif weather_cond == "HEAVY_RAIN":
            temp_c = round(random.uniform(18.0, 28.0), 1)
            humidity = round(random.uniform(90.0, 100.0), 1)
            rainfall_mm = round(random.uniform(35.0, 110.0), 1)
            wind_speed = round(random.uniform(25.0, 55.0), 1)
            visibility_km = round(random.uniform(1.0, 3.0), 1)
            weather_risk = "HIGH"
        elif weather_cond == "FOG":
            temp_c = round(random.uniform(5.0, 16.0), 1)
            humidity = round(random.uniform(85.0, 100.0), 1)
            rainfall_mm = 0.0
            wind_speed = round(random.uniform(2.0, 12.0), 1)
            visibility_km = round(random.uniform(0.3, 1.5), 1)
            weather_risk = "HIGH"
        else:  # STORM
            temp_c = round(random.uniform(15.0, 32.0), 1)
            humidity = round(random.uniform(85.0, 98.0), 1)
            rainfall_mm = round(random.uniform(40.0, 140.0), 1)
            wind_speed = round(random.uniform(50.0, 90.0), 1)
            visibility_km = round(random.uniform(0.5, 2.5), 1)
            weather_risk = "HIGH"

        # 7. Route Score Calculation (Synthetic 45-98 rating)
        base_score = 95.0
        if traffic_level == "MEDIUM": base_score -= 5
        elif traffic_level == "HIGH": base_score -= 12
        elif traffic_level == "SEVERE": base_score -= 22

        if weather_risk == "MEDIUM": base_score -= 6
        elif weather_risk == "HIGH": base_score -= 16

        route_score = round(max(45.0, min(98.0, base_score + np.random.normal(0, 3))), 1)

        # 8. Synthetic Expected Travel Duration Calculation
        traffic_mult = {"LOW": 1.0, "MEDIUM": 0.88, "HIGH": 0.73, "SEVERE": 0.58}[traffic_level]
        effective_speed = v_spec["avg_speed"] * traffic_mult

        handling_time_min = min(90.0, (package_count * 1.5) + (cargo_weight_kg * 0.01) + 15.0)
        expected_travel_min = (distance_km / effective_speed) * 60.0
        synthetic_expected_duration_min = round(expected_travel_min + handling_time_min, 1)

        # 9. Actual Delivery Duration Calculation (realistic noise + impacts)
        # Impact factors
        traffic_delay = {"LOW": 0.0, "MEDIUM": random.uniform(5, 25), "HIGH": random.uniform(25, 75), "SEVERE": random.uniform(70, 180)}[traffic_level]
        weather_delay = {"LOW": 0.0, "MEDIUM": random.uniform(10, 35), "HIGH": random.uniform(40, 150)}[weather_risk]
        
        priority_factor = {"URGENT": -0.05, "HIGH": -0.02, "MEDIUM": 0.0, "LOW": 0.04}[priority]
        driver_factor = -max(-15.0, (driver_experience_years - 5) * 1.2)  # Exp drivers save time
        
        noise = np.random.normal(0, 12.0)
        
        total_actual_min = (synthetic_expected_duration_min * (1.0 + priority_factor) +
                            traffic_delay + weather_delay + driver_factor + noise)
        
        # Ensure actual duration is physically valid (> 0 and >= 0.7 * expected)
        actual_duration_min = round(max(synthetic_expected_duration_min * 0.75, max(8.0, total_actual_min)), 1)

        # 10. Timestamps & Delay Derivations
        delivery_timestamp_dt = pickup_timestamp_dt + timedelta(minutes=actual_duration_min)
        
        delay_minutes = round(actual_duration_min - synthetic_expected_duration_min, 1)
        
        # Documented threshold: > 20.0 minutes is DELAYED
        delay_status = "DELAYED" if delay_minutes > 20.0 else "ON_TIME"

        # Input feature for ML pipeline: delayRisk (without leaking delayMinutes)
        risk_score_sum = 0
        if traffic_level in ["HIGH", "SEVERE"]: risk_score_sum += 2
        if weather_risk in ["MEDIUM", "HIGH"]: risk_score_sum += 2
        if route_score < 70: risk_score_sum += 1
        if distance_km > 500: risk_score_sum += 1

        if risk_score_sum >= 4:
            delay_risk = "HIGH"
        elif risk_score_sum >= 2:
            delay_risk = "MEDIUM"
        else:
            delay_risk = "LOW"

        record = {
            "shipmentId": shipment_id,
            "shipmentType": shipment_type,
            "priority": priority,
            "packageCount": package_count,
            "cargoWeightKg": cargo_weight_kg,
            "cargoVolumeM3": cargo_volume_m3,
            "pickupCity": pickup_city["name"],
            "pickupLatitude": pickup_lat,
            "pickupLongitude": pickup_lng,
            "deliveryCity": delivery_city["name"],
            "deliveryLatitude": delivery_lat,
            "deliveryLongitude": delivery_lng,
            "distanceKm": distance_km,
            "vehicleType": vehicle_type,
            "vehicleCapacityKg": vehicle_capacity_kg,
            "vehicleAgeYears": vehicle_age_years,
            "driverExperienceYears": driver_experience_years,
            "pickupDate": pickup_timestamp_dt.strftime("%Y-%m-%d"),
            "pickupTimestamp": pickup_timestamp_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "pickupHour": pickup_hour,
            "dayOfWeek": day_of_week,
            "month": month,
            "isWeekend": is_weekend,
            "trafficLevel": traffic_level,
            "temperatureC": temp_c,
            "humidityPercent": humidity,
            "rainfallMm": rainfall_mm,
            "windSpeedKmph": wind_speed,
            "visibilityKm": visibility_km,
            "weatherCondition": weather_cond,
            "weatherRisk": weather_risk,
            "routeScore": route_score,
            "expectedDurationMin": synthetic_expected_duration_min,
            "actualDurationMin": actual_duration_min,
            "deliveryTimestamp": delivery_timestamp_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "delayMinutes": delay_minutes,
            "delayStatus": delay_status,
            "delayRisk": delay_risk,
            "datasetType": "SYNTHETIC"
        }
        records.append(record)

    df = pd.DataFrame(records)
    return df

def main():
    parser = argparse.ArgumentParser(description="RouteXAI Phase 3B Synthetic Logistics Dataset Generator")
    parser.add_argument("--rows", type=int, default=10000, help="Number of synthetic records to generate (default: 10000)")
    parser.add_argument("--seed", type=int, default=42, help="Fixed random seed for reproducibility (default: 42)")
    parser.add_argument("--output", type=str, default="ml/data/synthetic/routexai_synthetic_logistics.csv", help="Output CSV path")
    parser.add_argument("--metadata", type=str, default="ml/data/synthetic/routexai_synthetic_logistics_metadata.json", help="Metadata JSON path")
    
    args = parser.parse_args()

    df = generate_synthetic_data(num_rows=args.rows, seed=args.seed)

    # Make output directories if not exist
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(os.path.dirname(args.metadata), exist_ok=True)
    os.makedirs("ml/data/processed", exist_ok=True)

    # Write primary synthetic CSV
    df.to_csv(args.output, index=False)
    print(f"[RouteXAI Generator] Saved synthetic dataset ({len(df):,} rows) to: {args.output}")

    # Also save copy to ml/data/processed/routexai_ml_dataset.csv for Phase 3C/3D ML processing
    processed_path = "ml/data/processed/routexai_ml_dataset.csv"
    df.to_csv(processed_path, index=False)
    print(f"[RouteXAI Generator] Saved processed ML dataset to: {processed_path}")

    # Write metadata JSON
    delay_count = int((df["delayStatus"] == "DELAYED").sum())
    ontime_count = int((df["delayStatus"] == "ON_TIME").sum())

    metadata = {
        "datasetName": "RouteXAI Synthetic Logistics Dataset",
        "datasetType": "SYNTHETIC",
        "purpose": "Initial ML development for ETA prediction (Phase 3C) and delay-risk prediction (Phase 3D)",
        "generationDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "randomSeed": args.seed,
        "numberOfRecords": len(df),
        "numberOfColumns": len(df.columns),
        "delayThresholdMinutes": 20.0,
        "classDistribution": {
            "ON_TIME": ontime_count,
            "DELAYED": delay_count,
            "onTimePercentage": round((ontime_count / len(df)) * 100, 2),
            "delayedPercentage": round((delay_count / len(df)) * 100, 2)
        },
        "syntheticWarning": "IMPORTANT: This dataset is 100% SYNTHETIC generated for initial ML pipeline architecture testing and MUST NOT be presented as real historical RouteXAI shipment operations or saved in MongoDB."
    }

    with open(args.metadata, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[RouteXAI Generator] Saved metadata to: {args.metadata}")
    print("[RouteXAI Generator] Phase 3B Dataset Generation Complete!\n")

if __name__ == "__main__":
    main()
