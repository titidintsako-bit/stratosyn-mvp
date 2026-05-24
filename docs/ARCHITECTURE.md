# Stratosyn Core Architecture

Stratosyn Core is a local-first autonomous infrastructure cognition simulator. The backend owns registry state, mission safety checks, event history, persisted operational cognition, dynamic causality, predictions, risk fields, coordination actions, and the simulator loop. The frontend subscribes to live telemetry plus cognition state and uses REST calls for operator actions and replay.

## Runtime Flow

1. `FastAPI` starts, creates SQLite tables, and seeds six simulated assets.
2. The simulator loop runs every second and updates assets with running missions.
3. Telemetry is broadcast to `/ws/telemetry`.
4. Mission lifecycle actions are handled by REST endpoints.
5. Waypoints can be attached to pending or approved missions and become intermediate simulator targets.
6. Every mission creation, approval, start, completion, abort, anomaly, acknowledgement, and rejected action writes or updates event log state.
7. Telemetry records feed persisted telemetry trails and replay paths.
8. Mission starts create persisted dependency links to nearby supporting assets.
9. Anomaly and safety events update anomaly clusters and reroute suggestions.
10. The industrial incident orchestration engine can start a deterministic Sector B intrusion scenario.
11. Each simulator tick advances active scenarios, then evaluates the operational cognition cycle and persists reasoning events, causality edges, prediction states, coordination actions, risk fields, and ecosystem snapshots.
12. The React interface renders the map, mission controls, scenario timeline, events, replay state, causality graph, predictive horizons, risk overlays, and coordination network.

## Safety Rules

The backend enforces all MVP safety checks:

- asset battery must be at least 30 percent,
- asset must not be offline,
- target coordinates must stay inside the Johannesburg operating zone,
- asset cannot be assigned to another active mission,
- aborted missions always emit an event.

## Storage

SQLite is the default for fast local development. PostgreSQL is supported through `docker-compose.postgres.yml`, `psycopg`, and Alembic migrations.

## Replay

Replay uses persisted replay paths derived from mission telemetry. If no replay path exists, the backend can rebuild one from telemetry records, and the frontend can still fall back to mission start and target coordinates.

## Operational Cognition

The cognition API exposes server-owned operational history rather than frontend-only projections:

- telemetry trails from `telemetry_records`,
- anomaly clusters from warning, critical, and anomaly-class events,
- mission dependency links created when missions start,
- reroute suggestions generated from route-affecting anomaly events,
- replay paths persisted from simulator telemetry.

`GET /cognition/core-state` combines these histories with the current machine reasoning layer:

- reasoning events,
- active causality graph nodes and edges,
- 5/15/30 minute prediction states,
- autonomous coordination actions,
- risk fields,
- latest ecosystem snapshot.

The WebSocket emits both telemetry and cognition envelopes so Deck.gl overlays can react to persisted backend state instead of frontend-only mock projections.

## Industrial Incident Scenario

`POST /orchestration/industrial-incident/start` starts a deterministic facility incident from the command `Investigate possible intrusion near Sector B.` The engine decomposes the intent, selects Drone Alpha by proximity/battery/signal/workload/suitability, dispatches it, retasks Camera Grid 2 and sensor nodes, escalates anomaly confidence through motion and thermal validation, creates a Sector C coverage-gap prediction, reroutes Drone Bravo, assigns Ground Robot Delta for physical verification, redistributes camera coverage, and resolves the incident with a replayable timeline.

The scenario writes to the same backend-owned operational state as normal missions: events, mission dependencies, reasoning events, causality edges, risk fields, predictions, coordination actions, telemetry records, and replay paths.
