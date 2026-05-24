from __future__ import annotations


def _mission_payload(asset_id: str = "drone_001") -> dict:
    return {
        "id": "mission_test_001",
        "name": "Inspect Zone A",
        "mission_type": "inspect_zone",
        "assigned_asset_id": asset_id,
        "target_zone": "Zone A",
        "target_latitude": -26.185,
        "target_longitude": 28.035,
        "priority": "medium",
    }


def test_mission_creation(client):
    response = client.post("/missions", json=_mission_payload())

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["assigned_asset_id"] == "drone_001"


def test_mission_approval(client):
    create_response = client.post("/missions", json=_mission_payload())
    mission_id = create_response.json()["id"]

    response = client.post(f"/missions/{mission_id}/approve")

    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_mission_rejection_when_battery_below_30(client):
    client.patch("/assets/drone_001", json={"battery": 22})

    response = client.post("/missions", json=_mission_payload())

    assert response.status_code == 400
    assert "battery is below 30%" in response.json()["detail"]

    events = client.get("/events").json()
    assert any(event["event_type"] == "mission_rejected" for event in events)


def test_mission_start_requires_approval(client):
    create_response = client.post("/missions", json=_mission_payload())
    mission_id = create_response.json()["id"]

    response = client.post(f"/missions/{mission_id}/start")

    assert response.status_code == 400
    assert "not approved" in response.json()["detail"]
