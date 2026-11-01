# Phase 3F — AI Route Recommendation Architecture & Multi-Signal Scoring Report

## 1. Overview & Objectives

**Phase 3F — AI Route Recommendation** adds a multi-signal decision-support recommendation engine to `RouteXAI`. It evaluates all available OpenRouteService (ORS) candidate routes for a target shipment and produces an explainable, transparent 0–100 recommendation score.

### Key Principles:
- **Non-Invasive Decision Support**: Recommends optimal routes without forcing automatic dispatch or modifying operational shipment state.
- **Strict Coordinate Preservation**: Evaluates direct customer pickup $\rightarrow$ customer delivery corridors (0 hub waypoints inserted).
- **Multi-Signal Integration**: Fuses outputs from Phase 2 (ORS Routing), Phase 3A (Weather Risk), Phase 3C (AI Predicted ETA), Phase 3D (Delay Risk Classification), and Phase 3E (Accessibility Intelligence).
- **Synthetic Data Disclosure**: Prominently displays `DATASET: SYNTHETIC — Decision Support Only` across UI and API responses.

---

## 2. Multi-Signal Weighting & Scoring Formula

The overall recommendation score $S_{\text{rec}} \in [0, 100]$ is computed as a weighted linear combination of 6 normalized candidate signals:

$$\text{RecommendationScore} = \text{round}\left(S_{\text{quality}} \times 0.25 + S_{\text{eta}} \times 0.20 + S_{\text{delay}} \times 0.20 + S_{\text{accessibility}} \times 0.20 + S_{\text{distance}} \times 0.10 + S_{\text{weather}} \times 0.05, 1\right)$$

### Factor Breakdown Table

| Signal | Weight | Description | Normalization / Scale |
| :--- | :---: | :--- | :--- |
| **Route Quality ($S_{\text{quality}}$)** | **25%** | Base ORS road quality and infrastructure score | Direct candidate score (65–98) |
| **AI ETA Efficiency ($S_{\text{eta}}$)** | **20%** | Candidate-specific transit duration predicted by Phase 3C ML | Relative scaling across candidate ETAs ($100 - \Delta \times 40$) |
| **Delay Risk Score ($S_{\text{delay}}$)** | **20%** | Candidate-specific delay probability predicted by Phase 3D ML | $(1 - \text{delayProbability}) \times 100$ |
| **Accessibility Score ($S_{\text{accessibility}}$)** | **20%** | Payload, vehicle age, driver experience, and route suitability from Phase 3E | Direct Phase 3E accessibility score (0–100) |
| **Distance Efficiency ($S_{\text{distance}}$)** | **10%** | Relative transit distance efficiency across candidate options | Relative scaling across candidate distances ($100 - \Delta \times 30$) |
| **Weather Risk Score ($S_{\text{weather}}$)** | **5%** | Open-Meteo real-time endpoint weather risk from Phase 3A | `LOW` = 100, `MEDIUM` = 60, `HIGH` = 20 |

---

## 3. Safety Filters & Disqualification Rules

To prevent unsafe dispatch recommendations, candidate routes undergo safety validation prior to ranking:

1. **Vehicle & Cargo Incompatibility**: If Phase 3E assessment returns `isIncompatible === true` (e.g. Hazardous payload in non-certified vehicle, or refrigerated cargo in open-top vehicle), the candidate is marked **DISQUALIFIED**.
2. **Critical Overload**: If Phase 3E assessment detects `overloadLevel === 'CRITICAL'` (>100% capacity utilization), the candidate is marked **DISQUALIFIED**.

> **Note**: Disqualified candidates receive an effective recommendation score of `0` and are placed at the bottom of the candidate list with explicit warning banners explaining the disqualification cause.

---

## 4. Recommendation Levels & Classification Thresholds

Scored candidate routes are mapped to four human-readable recommendation levels:

- **`HIGHLY_RECOMMENDED` ($\ge 80.0$)**: Optimal transit corridor with superior ETA efficiency, low delay risk, and full vehicle compatibility.
- **`RECOMMENDED` ($65.0 - 79.9$)**: Favorable transit corridor meeting standard logistics requirements.
- **`CAUTION_RECOMMENDED` ($50.0 - 64.9$)**: Sub-optimal corridor with minor delay risks or elevated distance bypass.
- **`NOT_RECOMMENDED` ($< 50.0$ or Disqualified)**: High operational risk, critical overload, or vehicle incompatibility.

---

## 5. Deterministic Tie-Breaking Strategy

When two candidate routes achieve recommendation scores within 0.1 points of each other, the tie is broken deterministically using the following hierarchy:

1. **Disqualification Priority**: Non-disqualified routes precede disqualified routes.
2. **Recommendation Score**: Higher score.
3. **Predicted ETA**: Faster predicted transit duration ($S_{\text{eta}}$).
4. **Delay Probability**: Lower delay probability ($P_{\text{delay}}$).
5. **Accessibility Score**: Higher Phase 3E accessibility score.
6. **Distance**: Shortest physical distance ($\text{km}$).

---

## 6. Dynamic Explainability Generation

Phase 3F generates human-readable positive (`✓`) and warning (`⚠`) factor notes comparing recommended routes against alternatives:

### Example Explanations:
- `✓ Highest multi-signal recommendation score (88.5/100)`
- `✓ Faster estimated transit time (saves ~12 min vs Route B: Regional Bypass Corridor)`
- `✓ Lower delay probability (18% vs 24%)`
- `✓ Higher operational accessibility rating (85 vs 78)`
- `⚠ Slightly longer bypass distance (+4.2 km)`
- `⚠ Weather caution: MEDIUM risk conditions detected`

---

## 7. System Integration & Verification

### File Artifacts:
- **Backend Service**: [`backend/services/routeRecommendationService.js`](file:///c:/Users/putlu/OneDrive/Desktop/RouteXAI/backend/services/routeRecommendationService.js)
- **Controller**: [`backend/controllers/routeRecommendationController.js`](file:///c:/Users/putlu/OneDrive/Desktop/RouteXAI/backend/controllers/routeRecommendationController.js)
- **Router**: [`backend/routes/routeRecommendationRoutes.js`](file:///c:/Users/putlu/OneDrive/Desktop/RouteXAI/backend/routes/routeRecommendationRoutes.js)
- **Frontend UI**: [`frontend/src/pages/owner/RouteIntelligence.jsx`](file:///c:/Users/putlu/OneDrive/Desktop/RouteXAI/frontend/src/pages/owner/RouteIntelligence.jsx)

### Verification Summary:
- **Backend Server**: Mounted at `GET /api/route-recommendation/shipment/:shipmentId`.
- **Frontend Build**: Verified via `npm run build` with **0 errors**.
