# Phase 3E — Accessibility Intelligence Engine Report & Data Flow Fix

**Project:** RouteXAI — AI-Powered Smart Logistics & Route Intelligence Platform  
**Phase:** Phase 3E — Accessibility Intelligence  
**Implementation Type:** Rule-Based Operational Decision-Support Engine  
**Dataset Dependency:** Synthetic (incorporates Phase 3C ETA and Phase 3D Delay Risk signals trained on synthetic data)  
**Status:** Completed, Audited & Verified  

---

## 1. Bug Investigation & Root Cause Analysis

### Reported Problem:
The AI Accessibility Intelligence panel was returning identical values (Score 83, Cargo Utilization HIGH, Driver Exp 0 yrs, Vehicle Age 3 yrs) for all selected shipments.

### Root Causes Identified & Fixed:

1. **Backend Driver Document Resolution Bug (`accessibilityService.js`)**:
   - `shipment.driver` in MongoDB stores a reference to the `User` schema (`ref: 'User'`).
   - The driver's `experienceYears` field is stored on the decoupled `Driver` schema (`user: shipment.driver._id`).
   - Previously, the code checked `shipment.driver.experienceYears`, which evaluated to `undefined` (falling back to 0 years) because `User` objects do not have an `experienceYears` property.
   - **Fix:** Query `Driver.findOne({ user: driverUserId })` to resolve the actual driver's experience (e.g. 7 years, 5 years, 8 years).

2. **Backend Mongoose ID Type Handling Bug (`accessibilityService.js`)**:
   - `typeof new ObjectId(...)` in Node.js returns `'object'`, NOT `'string'`.
   - The type check `if (typeof shipmentIdOrObj === 'string')` evaluated to `false` when passed an `ObjectId` instance, causing Mongoose `Shipment.findById` to be skipped.
   - **Fix:** Updated ID resolution to support strings, `ObjectId` instances, or Mongoose objects seamlessly:
     ```javascript
     let shipmentId = null;
     if (typeof shipmentIdOrObj === 'string') {
       shipmentId = shipmentIdOrObj;
     } else if (shipmentIdOrObj && shipmentIdOrObj._id) {
       shipmentId = shipmentIdOrObj._id.toString();
     }
     ```

3. **Frontend Stale State Clearing (`RouteIntelligence.jsx`)**:
   - When switching `selectedShipmentId`, previously fetched prediction state was not reset immediately, causing previous accessibility cards to linger during network requests.
   - **Fix:** Reset state immediately (`setAccessibilityData(null); setDelayRiskData(null); setEtaPrediction(null); setEndpointWeather(null);`) upon shipment change and validate `res.data.shipmentId === selectedShipmentId`.

4. **Candidate Route Score Override (`RouteIntelligence.jsx` & `accessibilityController.js`)**:
   - When candidate route tabs (Score 85 vs Score 65) are toggled, candidate `routeScore` is now passed to `GET /api/accessibility/shipment/:shipmentId?routeScore=65` to dynamically re-evaluate Route Suitability.

---

## 2. Backend Debug Logging Output

As required, backend debug logging has been added to `accessibilityService.js`:

```text
[PHASE 3E DEBUG]
shipmentId: 6ab52f5c44b7616aece8fb11
trackingNumber: RTX-100001
routeId: NONE
routeScore: 85
cargoWeightKg: 1500
vehicleId: 6ab52f5c44b7616aece8fae5
vehicleCapacityKg: 12000
vehicleAgeYears: 1
driverId: 6ab52f5c44b7616aece8faf5
driverExperienceYears: 7
weatherRisk: LOW
delayProbability: 30%
baselineEta: 884 min
predictedEta: 906.89 min
accessibilityScore: 96
accessibilityLevel: GOOD
```

---

## 3. Empirical Test Results Across Different Shipments

| Shipment ID / Tracking | Cargo Weight | Vehicle Capacity | Driver Exp | Route Score | Delay Prob | Score | Level | Cargo Compat |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **RTX-100001** | 1,500 kg | 12,000 kg | 7 yrs | 85 | 30.0% | **96** | `GOOD` | `HIGH` |
| **RTX-100002** | 850 kg | 16,000 kg | 5 yrs | 85 | 35.4% | **95** | `GOOD` | `HIGH` |
| **RTX-100003** | 2,400 kg | 3,500 kg | 8 yrs | 85 | 33.6% | **95** | `GOOD` | `HIGH` |
| **RTX-100004** | 3,100 kg | 10,000 kg | 6 yrs | 85 | 35.7% | **91** | `GOOD` | `HIGH` |
| **RTX-100007** (Overload) | 4,200 kg | 3,500 kg | 8 yrs | 85 | 32.5% | **39** | `CRITICAL` | `INCOMPATIBLE` |

### Candidate Route Score Variation Test (RTX-100001):
- `routeScore = 85` $\implies$ Score: **96**, Route Suitability: `HIGH` (20 pts)
- `routeScore = 65` $\implies$ Score: **90**, Route Suitability: `MEDIUM` (14 pts)
- `routeScore = 45` $\implies$ Score: **84**, Route Suitability: `LOW` (8 pts)

---

## 4. Scoring Weights & Rules Summary (Total 100 Points)

| Component | Max Points | Evaluation Rules | Output Status |
| :--- | :---: | :--- | :--- |
| **Vehicle / Cargo Compatibility** | 25 | Utilization ratio = `cargoWeightKg / vehicleCapacityKg`<br>• $\le 70\% \implies 25$ pts (`HIGH`)<br>• $70\% - 90\% \implies 18$ pts (`MEDIUM`)<br>• $90\% - 100\% \implies 10$ pts (`LOW`)<br>• $> 100\% \implies 0$ pts (`INCOMPATIBLE`, Hard Safety Rule) | `COMPATIBLE` / `INCOMPATIBLE` |
| **Route Suitability** | 20 | Candidate `routeScore`<br>• $\ge 80 \implies 20$ pts (`HIGH`)<br>• $60 - 79 \implies 14$ pts (`MEDIUM`)<br>• $< 60 \implies 8$ pts (`LOW`) | `HIGH` / `MEDIUM` / `LOW` |
| **Weather Impact** | 15 | Phase 3A Open-Meteo `weatherRisk`<br>• `LOW` $\implies 15$ pts<br>• `MEDIUM` $\implies 10$ pts<br>• `HIGH` $\implies 4$ pts | `LOW` / `MEDIUM` / `HIGH` |
| **Operational Delay Risk** | 15 | Phase 3D ML `riskLevel`<br>• `LOW` $\implies 15$ pts<br>• `MEDIUM` $\implies 10$ pts<br>• `HIGH` $\implies 4$ pts | `LOW` / `MEDIUM` / `HIGH` |
| **ETA Impact** | 10 | Phase 3C ML duration delta ($\text{predicted} - \text{baseline}$)<br>• $\le 15$ min $\implies 10$ pts<br>• $15 - 45$ min $\implies 6$ pts<br>• $> 45$ min $\implies 2$ pts | `LOW` / `MEDIUM` / `HIGH` |
| **Driver Experience** | 10 | Assigned driver experience<br>• $\ge 3$ yrs $\implies 10$ pts (`EXPERIENCED`)<br>• $1 - 2$ yrs $\implies 7$ pts (`MODERATE`)<br>• $< 1$ yr $\implies 4$ pts (`LIMITED`) | `EXPERIENCED` / `MODERATE` / `LIMITED` |
| **Vehicle Age Factor** | 5 | Assigned vehicle age<br>• $\le 5$ yrs $\implies 5$ pts (`NORMAL`)<br>• $6 - 10$ yrs $\implies 3$ pts (`OLDER`)<br>• $> 10$ yrs $\implies 1$ pt (`HIGH-AGE`) | `NORMAL` / `OLDER` / `HIGH-AGE` |

---

## 5. System Confirmations

- **100% Shipment-Specific**: Each shipment evaluates its own DB properties, assigned driver, vehicle capacity, route score, weather, ETA, and delay risk.
- **Rule-Based**: No fake road closures, bridge restrictions, or random values were created.
- **Phase Integrity Preserved**: Phase 2, 3A, 3C, and 3D remain unchanged.
- **Frontend Build**: `npm run build` succeeds with 0 errors.
