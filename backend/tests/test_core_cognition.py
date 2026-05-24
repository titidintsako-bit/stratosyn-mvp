from __future__ import annotations

import asyncio

from app.simulator import TelemetrySimulator
from app.websocket import ConnectionManager


def _start_core_mission(client, mission_id: str = "mission_core_cognition") -> dict:
    create_response = client.post(
        "/missions",
        json={
            "id": mission_id,
            "name": "Core Cognition Inspection",
            "mission_type": "inspect_zone",
            "assigned_asset_id": "drone_002",
            "target_zone": "Sector 4",
            "target_latitude": -26.182,
            "target_longitude": 28.058,
            "priority": "high",
        },
    )
    assert create_response.status_code == 201
    assert client.post(f"/missions/{mission_id}/approve").status_code == 200
    start_response = client.post(f"/missions/{mission_id}/start")
    assert start_response.status_code == 200
    return start_response.json()


def test_core_cognition_state_contains_reasoning_graph_predictions_and_ecosystem(client):
    mission = _start_core_mission(client)
    simulator = TelemetrySimulator(ConnectionManager(), interval_seconds=0)
    asyncio.run(simulator.tick())

    response = client.get("/cognition/core-state")

    assert response.status_code == 200
    state = response.json()
    assert {"reasoning_events", "causality_graph", "predictions", "coordination_actions", "risk_fields", "ecosystem"}.issubset(
        state.keys()
    )

    assert state["reasoning_events"]
    assert any("confidence" in event and event["confidence"] > 0 for event in state["reasoning_events"])
    assert any(mission["id"] in event["message"] or "Sector 4" in event["message"] for event in state["reasoning_events"])

    graph = state["causality_graph"]
    assert any(node["node_type"] == "asset" and node["id"] == "drone_002" for node in graph["nodes"])
    assert any(node["node_type"] == "mission" and node["id"] == mission["id"] for node in graph["nodes"])
    assert any(edge["source_id"] == "drone_002" and edge["target_id"] == mission["id"] for edge in graph["edges"])

    horizons = {prediction["horizon_minutes"] for prediction in state["predictions"]}
    assert {5, 15, 30}.issubset(horizons)
    assert any(prediction["prediction_type"] == "battery_exhaustion" for prediction in state["predictions"])
    assert all(0 <= prediction["probability"] <= 100 for prediction in state["predictions"])
    assert all(0 <= prediction["confidence"] <= 100 for prediction in state["predictions"])

    assert state["coordination_actions"]
    assert any(action["mission_id"] == mission["id"] for action in state["coordination_actions"])

    assert state["risk_fields"]
    assert all("risk_score" in field and 0 <= field["risk_score"] <= 100 for field in state["risk_fields"])

    ecosystem = state["ecosystem"]
    assert ecosystem["system_state"] in {"nominal", "coordinating", "stressed", "critical"}
    assert 0 <= ecosystem["mean_confidence"] <= 100
    assert 0 <= ecosystem["risk_index"] <= 100
