from __future__ import annotations

from datetime import timedelta

from app.cognition import evaluate_cognition_cycle
from app.database import SessionLocal

def test_industrial_incident_orchestration_produces_connected_state(client):
    response = client.post(
        "/orchestration/industrial-incident/start",
        json={"command": "Investigate possible intrusion near Sector B."},
    )

    assert response.status_code == 201
    run = response.json()
    assert run["scenario_type"] == "industrial_facility_intrusion"
    assert run["selected_asset_id"] == "drone_001"
    assert run["primary_mission_id"]
    assert run["confidence"] == 38
    assert any(item["phase"] == "asset_selected" and item["asset_id"] == "drone_001" for item in run["timeline"])

    while run["status"] == "running":
        run = client.post(f"/orchestration/scenarios/{run['id']}/advance").json()

    state_response = client.get(f"/orchestration/scenarios/{run['id']}")
    assert state_response.status_code == 200
    final_run = state_response.json()
    phases = {item["phase"] for item in final_run["timeline"]}
    assert final_run["status"] == "completed"
    assert final_run["outcome"] in {"confirmed_intrusion", "false_positive", "unresolved_anomaly"}
    assert final_run["confidence"] >= 79
    assert {
        "intent_parsed",
        "asset_selected",
        "alpha_dispatched",
        "support_retasked",
        "thermal_validation",
        "incident_escalated",
        "bravo_rerouted",
        "ground_robot_assigned",
        "incident_resolved",
    }.issubset(phases)

    events = client.get("/events").json()
    event_types = {event["event_type"] for event in events}
    assert {"motion_validation", "thermal_anomaly_spike", "camera_obstruction", "second_intrusion_path"}.issubset(event_types)

    core_state = client.get("/cognition/core-state").json()
    reasoning_messages = " ".join(event["message"] for event in core_state["reasoning_events"])
    assert "Coverage gap projected in Sector C in 4m" in reasoning_messages
    assert "Drone Alpha signal instability increasing" in reasoning_messages
    assert "Ground verification required before escalation" in reasoning_messages

    edge_types = {edge["edge_type"] for edge in core_state["causality_graph"]["edges"]}
    assert {"anomaly_influence", "priority_arbitration", "risk_propagation", "resource_reallocation"}.issubset(edge_types)

    prediction_types = {prediction["prediction_type"] for prediction in core_state["predictions"]}
    assert {"coverage_gap", "signal_instability", "intrusion_escalation"}.issubset(prediction_types)

    action_types = {action["action_type"] for action in core_state["coordination_actions"]}
    assert {"camera_coverage_rotation", "sensor_frequency_increase", "reroute_negotiation", "ground_verification"}.issubset(
        action_types
    )

    risk_zones = {field["zone_id"] for field in core_state["risk_fields"]}
    assert {"sector_b", "sector_c", "loading_bay"}.issubset(risk_zones)

    replay = client.get(f"/cognition/replay-paths/{run['primary_mission_id']}").json()
    assert replay["point_count"] == 11
    assert [point["phase"] for point in replay["path"]] == [item["phase"] for item in final_run["timeline"]]

    final_assets = {asset["id"]: asset for asset in client.get("/assets").json()}
    assert final_assets["drone_001"]["status"] == "idle"
    assert final_assets["drone_001"]["current_mission_id"] is None
    assert final_assets["drone_002"]["status"] == "idle"
    assert final_assets["robot_001"]["status"] == "idle"
    assert final_assets["camera_002"]["status"] == "active"


def _run_full_demo(client) -> dict:
    start_response = client.post(
        "/orchestration/industrial-incident/start",
        json={"command": "Investigate possible intrusion near Sector B."},
    )
    assert start_response.status_code == 201
    run = start_response.json()
    while run["status"] == "running":
        advance_response = client.post(f"/orchestration/scenarios/{run['id']}/advance")
        assert advance_response.status_code == 200
        run = advance_response.json()
    return run


def test_industrial_reset_clears_scenario_state_and_reseeds_baseline(client):
    run = _run_full_demo(client)
    assert run["outcome"] == "confirmed_intrusion"

    response = client.post("/orchestration/industrial/reset")

    assert response.status_code == 200
    reset = response.json()
    assert reset["status"] == "reset"
    assert reset["active_scenario"] is None
    assert len(reset["assets"]) >= 7

    active_response = client.get("/orchestration/scenarios/active")
    assert active_response.status_code == 200
    assert active_response.json() is None

    assets = {asset["id"]: asset for asset in client.get("/assets").json()}
    assert assets["drone_001"]["name"] == "Drone Alpha"
    assert assets["drone_001"]["status"] == "idle"
    assert assets["camera_002"]["name"] == "Camera Grid 2"
    assert assets["sensor_node_001"]["asset_type"] == "sensor"


def test_industrial_export_contains_persisted_orchestration_evidence(client):
    run = _run_full_demo(client)

    response = client.get("/orchestration/industrial/latest/export")

    assert response.status_code == 200
    exported = response.json()
    assert exported["scenario"]["id"] == run["id"]
    assert exported["scenario"]["outcome"] == "confirmed_intrusion"
    assert exported["scenario"]["confidence"] == 88
    assert len(exported["phases"]) == 11
    assert exported["phases"][-1]["phase"] == "incident_resolved"
    assert len(exported["assets_involved"]) >= 5
    assert any(asset["id"] == "drone_001" for asset in exported["assets_involved"])
    assert any(mission["name"] == "Investigate Sector B Intrusion" for mission in exported["missions_created"])
    assert exported["reasoning_events"]
    assert exported["causality_edges"]
    assert exported["predictions"]
    assert exported["coordination_actions"]
    assert exported["risk_fields"]
    assert exported["replay_path"]["point_count"] == 11
    assert [point["phase"] for point in exported["replay_path"]["path"]] == [item["phase"] for item in exported["phases"]]


def test_completed_industrial_scenario_freezes_reasoning_and_closes_alerts(client):
    run = _run_full_demo(client)
    first_export = client.get("/orchestration/industrial/latest/export").json()
    first_reasoning_count = len(first_export["reasoning_events"])

    with SessionLocal() as db:
        completed_at = run["completed_at"]
        # Move the cognition clock far enough forward that old de-dupe windows
        # would otherwise allow repeated anomaly reasoning to be inserted.
        from datetime import datetime

        next_tick = datetime.fromisoformat(completed_at) + timedelta(seconds=30)
        evaluate_cognition_cycle(db, next_tick)
        evaluate_cognition_cycle(db, next_tick + timedelta(seconds=30))
        db.commit()

    second_export = client.get("/orchestration/industrial/latest/export").json()
    warnings = [event for event in client.get("/events").json() if event["severity"] != "info"]

    assert len(second_export["reasoning_events"]) == first_reasoning_count
    assert all(event["acknowledged"] is True for event in warnings)
