# Stratosyn Core MVP

Stratosyn Core is a local autonomous infrastructure cognition simulator. It coordinates simulated autonomous assets, telemetry, missions, anomalies, reasoning events, causality, risk, and replay through a map-first operational command system. This version does not require real drones, hardware, authentication, payments, or external AI APIs.

## Public Demo

The public Vercel build runs the command interface as a deterministic frontend demo when no backend URL is configured. It shows the Sector B incident workflow, replay path, evidence chain, and coordination state without exposing a database or pretending to operate real infrastructure.

The full local system remains FastAPI + WebSocket + SQLite/PostgreSQL. Set `VITE_API_URL` and `VITE_WS_URL` when you want the frontend to connect to the live backend.

## What Is Included

- FastAPI backend with SQLAlchemy and SQLite.
- Asset registry seeded with 3 drones, 1 ground robot, and 2 static cameras.
- Mission engine with approval, start, abort, completion, and safety rejection events.
- One-second telemetry simulator with WebSocket broadcasts.
- Event log for mission lifecycle, safety rejections, battery warnings, and anomalies.
- Persisted operational cognition for telemetry trails, anomaly clusters, mission dependencies, reroute suggestions, replay paths, causal edges, predictions, risk fields, coordination actions, and machine reasoning events.
- Deterministic placeholder endpoint for `POST /ai/parse-mission`.
- React, TypeScript, Vite, Tailwind CSS, MapLibre GL JS, Deck.gl, Framer Motion, Zustand, and D3 command interface.
- Dynamic causality graph, predictive state horizons, risk overlays, autonomous coordination links, and AI reasoning stream.
- Deterministic industrial facility incident scenario for Sector B intrusion response, escalation, multi-asset coordination, and replay.
- Replay Lite using stored telemetry and persisted replay paths when available, with start/end fallback.
- pytest coverage for asset, mission, telemetry, event, replay, and cognition behavior.

## Local Setup

### Backend

```powershell
cd C:\Users\user\stratosyn-mvp\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URL: `http://localhost:8000`

### Frontend

```powershell
cd C:\Users\user\stratosyn-mvp\frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

### Docker Compose

```powershell
cd C:\Users\user\stratosyn-mvp
docker compose up --build
```

### Docker Compose With PostgreSQL

```powershell
cd C:\Users\user\stratosyn-mvp
$env:STRATOSYN_POSTGRES_PASSWORD="choose-a-local-password"
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build
```

Run migrations against the active database URL:

```powershell
cd C:\Users\user\stratosyn-mvp\backend
$env:STRATOSYN_DATABASE_URL="postgresql+psycopg://stratosyn:choose-a-local-password@localhost:5432/stratosyn"
.\.venv\Scripts\python -m alembic upgrade head
```

## Environment Variables

Backend:

- `STRATOSYN_DATABASE_URL`: SQLAlchemy database URL. Default: `sqlite:///./stratosyn.db`
- `STRATOSYN_DISABLE_SIMULATOR`: set to `1` for tests.
- `STRATOSYN_SIM_STEP_DEGREES`: movement step per simulator tick. Default: `0.0025`
- `STRATOSYN_ANOMALY_RATE`: random anomaly probability per active mission tick. Default: `0.08`
- `STRATOSYN_AUTO_ADVANCE_SCENARIOS`: set to `1` to advance scenarios from the simulator loop. Default: `0`, so Demo Mode controls phase timing.

Frontend:

- `VITE_API_URL`: backend REST URL. Default: `http://localhost:8000`
- `VITE_WS_URL`: telemetry WebSocket URL. Default: `ws://localhost:8000/ws/telemetry`
- `VITE_PUBLIC_DEMO`: set to `1` to force the frontend-only public demo.

## Architecture Overview

```text
React Stratosyn Core interface
  | REST actions: assets, missions, events, cognition, orchestration, AI parser
  | WebSocket: live telemetry + cognition state
FastAPI backend
  | SQLAlchemy models, cognition engine, safety services, and persisted operational history
  | one-second simulator + autonomous reasoning cycle
SQLite database
```

See `docs/ARCHITECTURE.md` for more detail.

## API List

Assets:

- `GET /assets`
- `GET /assets/{id}`
- `POST /assets`
- `PATCH /assets/{id}`
- `DELETE /assets/{id}`

Missions:

- `GET /missions`
- `GET /missions/{id}`
- `POST /missions`
- `PATCH /missions/{id}`
- `POST /missions/{id}/approve`
- `POST /missions/{id}/start`
- `POST /missions/{id}/abort`
- `GET /missions/{id}/telemetry`
- `GET /missions/{id}/replay`
- `GET /missions/{id}/waypoints`
- `POST /missions/{id}/waypoints`

Events:

- `GET /events`
- `GET /events?asset_id=drone_001`
- `GET /events?mission_id=mission_001`
- `POST /events/{id}/acknowledge`

Telemetry:

- `GET /telemetry/latest`
- `WS /ws/telemetry`

Cognition:

- `GET /cognition/core-state`
- `GET /cognition/operational-state`
- `GET /cognition/telemetry-trails`
- `GET /cognition/anomaly-clusters`
- `GET /cognition/mission-dependencies`
- `GET /cognition/reroute-suggestions`
- `GET /cognition/replay-paths`
- `GET /cognition/replay-paths/{mission_id}`

Orchestration:

- `POST /orchestration/industrial-incident/start`
- `POST /orchestration/industrial/reset`
- `GET /orchestration/industrial/latest/export`
- `GET /orchestration/scenarios/active`
- `GET /orchestration/scenarios`
- `GET /orchestration/scenarios/{id}`
- `POST /orchestration/scenarios/{id}/advance`

AI placeholder:

- `POST /ai/parse-mission`

## WebSocket Payload Example

Telemetry:

```json
{
  "type": "telemetry",
  "payload": {
    "asset_id": "drone_001",
    "latitude": -26.2041,
    "longitude": 28.0473,
    "battery": 84,
    "speed": 12,
    "heading": 92,
    "status": "mission",
    "mission_id": "mission_001",
    "timestamp": "2026-05-13T12:00:00+00:00"
  }
}
```

Cognition:

```json
{
  "type": "cognition",
  "payload": {
    "reasoning_events": [],
    "causality_graph": { "nodes": [], "edges": [] },
    "predictions": [],
    "coordination_actions": [],
    "risk_fields": [],
    "ecosystem": null
  }
}
```

## Investor Demo Mode

1. Start the backend and frontend using the commands above.
2. Open `http://localhost:5173`.
3. Click `Demo Mode` in the Industrial Incident Orchestration panel.
4. Watch the 11-phase Sector B intrusion scenario advance automatically.
5. The scenario ends as `confirmed_intrusion`, loads replay automatically, and exposes the persisted proof state through `GET /orchestration/industrial/latest/export`.

The demo proves that Stratosyn is more than a dashboard by showing deterministic orchestration:

- mission intent decomposition,
- asset selection from proximity, battery, signal health, workload, and capability,
- camera and sensor retasking,
- confidence evolution from `38%` to `88%`,
- signal degradation and camera obstruction,
- Drone Bravo rerouting,
- Ground Robot Delta verification,
- causality propagation into risk fields, predictions, and coordination actions,
- replayable operational history.

What is deterministic simulation:

- all assets, telemetry, missions, confidence changes, predictions, causality edges, and replay paths are simulated locally;
- the scenario is scripted for repeatable investor demos;
- reset/export endpoints exist so the proof state can be inspected without backend logs.

What is not real yet:

- no real drones or hardware integration,
- no real AI/LLM calls,
- no production geospatial operations engine,
- no authentication or operator audit model.

## Vercel Deployment

This repo is configured so Vercel builds the frontend from `frontend/` and serves `frontend/dist`.

```powershell
cd C:\Users\user\stratosyn-mvp
vercel deploy . -y
```

For a public portfolio demo, do not set `VITE_API_URL`; the app will use the deterministic frontend simulation. For a full-stack environment, host the FastAPI backend separately and configure:

```text
VITE_API_URL=https://your-backend.example.com
VITE_WS_URL=wss://your-backend.example.com/ws/telemetry
```

## Tests

```powershell
cd C:\Users\user\stratosyn-mvp\backend
pytest -q
```

## Next Build Modules

- Geofence corridor validation for waypoint routes.
- Operator controls to accept or reject autonomous coordination actions.
- Incident-grade replay comparing predicted and actual outcomes.
- Scenario scripting DSL for more deterministic facility incidents.
- Persistent operator accounts and audit trails.
- Real LLM mission parser behind the existing placeholder contract.
- Alert assignment, acknowledgement notes, and resolution states.
- Replay export with telemetry compression.
- Asset health scoring and fleet readiness policy simulation.

## Known MVP Limitations

- SQLite is used by default for local speed; PostgreSQL is available through the compose override and Alembic migration.
- Asset movement is simulated and accelerated for demo usefulness.
- The reasoning stream and mission parser are deterministic simulator logic and do not call an LLM.
- Replay stores telemetry-derived path points and exposes a scrubber, but it is not a full forensic replay timeline.
- `npm audit --omit=dev` currently reports 0 production vulnerabilities.
