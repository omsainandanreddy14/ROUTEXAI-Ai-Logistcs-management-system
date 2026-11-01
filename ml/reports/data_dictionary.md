# RouteXAI Synthetic Logistics Dataset — Data Dictionary

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
