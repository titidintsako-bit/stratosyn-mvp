from __future__ import annotations

import asyncio

from app.database import SessionLocal
from app.services import create_event
from app.simulator import TelemetrySimulator
from app.websocket import ConnectionManager


def _start_mission(client, mission_id: str = "mission_cognition_001") -> dict:
    create_response = client.post(
        "/missions",
        json={
            "id": mission_id,
            "name": "Cognition Route Inspection",
            "mission_type": "inspect_zone",
            "assigned_asset_id": "drone_001",
            "target_zone": "Zone Cognition",
            "target_latitude": -26.185,
            "target_longitude": 28.035,
            "priority": "high",
        },
    )
    assert create_response.status_code == 201
    assert client.post(f"/missions/{mission_id}/approve").status_code == 200
    start_response = client.post(f"/missions/{mission_id}/start")
    assert start_response.status_code == 200
    return start_response.json()


def test_operational_state_returns_persisted_cognition_layers(client):
    mission = _start_mission(client)
    simulator = TelemetrySimulator(ConnectionManager(), interval_seconds=0)
    asyncio.run(simulator.tick())
    asyncio.run(simulator.tick())

    with SessionLocal() as db:
        create_event(
            db,
            "obstacle_detected",
            "warning",
            "Obstacle detected on route; reroute analysis requested.",
            asset_id="drone_001",
            mission_id=mission["id"],
        )
        db.commit()

    response = client.get("/cognition/operational-state")

    assert response.status_code == 200
    state = response.json()
    assert {"telemetry_trails", "anomaly_clusters", "mission_dependencies", "reroute_suggestions", "replay_paths"}.issubset(
        state.keys()
    )

    trail = next(item for item in state["telemetry_trails"] if item["asset_id"] == "drone_001")
    assert trail["mission_id"] == mission["id"]
    assert trail["point_count"] >= 2
    assert {"latitude", "longitude", "timestamp"}.issubset(trail["points"][0].keys())

    dependency = next(item for item in state["mission_dependencies"] if item["mission_id"] == mission["id"])
    assert dependency["source_asset_id"] == "drone_001"
    assert dependency["target_asset_id"]
    assert dependency["active"] is True
    assert dependency["strength"] > 0

    cluster = next(item for item in state["anomaly_clusters"] if item["mission_id"] == mission["id"])
    assert cluster["event_type"] == "obstacle_detected"
    assert cluster["severity"] == "warning"
    assert cluster["event_count"] >= 1
    assert cluster["radius"] > 0

    suggestion = next(item for item in state["reroute_suggestions"] if item["mission_id"] == mission["id"])
    assert suggestion["asset_id"] == "drone_001"
    assert suggestion["status"] == "pending"
    assert suggestion["risk_score"] > 0
    assert len(suggestion["suggested_path"]) >= 3

    replay_path = next(item for item in state["replay_paths"] if item["mission_id"] == mission["id"])
    assert replay_path["asset_id"] == "drone_001"
    assert replay_path["point_count"] >= 2
    assert replay_path["path"][0]["latitude"] != replay_path["path"][-1]["latitude"]


def test_mission_replay_uses_persisted_replay_path(client):
    mission = _start_mission(client, "mission_cognition_replay")
    simulator = TelemetrySimulator(ConnectionManager(), interval_seconds=0)
    asyncio.run(simulator.tick())

    response = client.get(f"/cognition/replay-paths/{mission['id']}")

    assert response.status_code == 200
    replay_path = response.json()
    assert replay_path["mission_id"] == mission["id"]
    assert replay_path["asset_id"] == "drone_001"
    assert replay_path["point_count"] >= 1
    assert {"latitude", "longitude", "timestamp"}.issubset(replay_path["path"][0].keys())
