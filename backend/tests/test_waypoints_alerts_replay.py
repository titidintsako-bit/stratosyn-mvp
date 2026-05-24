from __future__ import annotations

from app.database import SessionLocal
from app.models import TelemetryRecord


def _create_mission(client, mission_id: str = "mission_route_001") -> dict:
    response = client.post(
        "/missions",
        json={
            "id": mission_id,
            "name": "Route Inspect Zone",
            "mission_type": "inspect_zone",
            "assigned_asset_id": "drone_001",
            "target_zone": "Zone Route",
            "target_latitude": -26.19,
            "target_longitude": 28.04,
            "priority": "medium",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_mission_waypoints_can_be_created_and_listed(client):
    mission = _create_mission(client)

    create_response = client.post(
        f"/missions/{mission['id']}/waypoints",
        json={
            "label": "Checkpoint 1",
            "latitude": -26.198,
            "longitude": 28.044,
        },
    )

    assert create_response.status_code == 201
    waypoint = create_response.json()
    assert waypoint["mission_id"] == mission["id"]
    assert waypoint["sequence"] == 1
    assert waypoint["label"] == "Checkpoint 1"
    assert waypoint["reached_at"] is None

    list_response = client.get(f"/missions/{mission['id']}/waypoints")
    assert list_response.status_code == 200
    assert [item["label"] for item in list_response.json()] == ["Checkpoint 1"]


def test_waypoint_creation_rejects_out_of_zone_coordinates(client):
    mission = _create_mission(client)

    response = client.post(
        f"/missions/{mission['id']}/waypoints",
        json={"label": "Invalid", "latitude": -27.0, "longitude": 28.04},
    )

    assert response.status_code == 400
    assert "outside the Johannesburg operating zone" in response.json()["detail"]


def test_warning_event_can_be_acknowledged(client):
    mission = _create_mission(client, "mission_ack_001")
    reject_response = client.post(
        f"/missions/{mission['id']}/waypoints",
        json={"label": "Invalid", "latitude": -27.0, "longitude": 28.04},
    )
    assert reject_response.status_code == 400

    warning_event = next(event for event in client.get("/events").json() if event["severity"] == "warning")
    ack_response = client.post(
        f"/events/{warning_event['id']}/acknowledge",
        json={"acknowledged_by": "operator_demo"},
    )

    assert ack_response.status_code == 200
    acknowledged = ack_response.json()
    assert acknowledged["acknowledged"] is True
    assert acknowledged["acknowledged_by"] == "operator_demo"
    assert acknowledged["acknowledged_at"] is not None


def test_mission_replay_returns_ordered_telemetry_points(client):
    mission = _create_mission(client, "mission_replay_001")
    with SessionLocal() as db:
        db.add_all(
            [
                TelemetryRecord(
                    asset_id="drone_001",
                    mission_id=mission["id"],
                    latitude=-26.204,
                    longitude=28.047,
                    battery=91,
                    speed=10,
                    heading=90,
                    status="mission",
                ),
                TelemetryRecord(
                    asset_id="drone_001",
                    mission_id=mission["id"],
                    latitude=-26.19,
                    longitude=28.04,
                    battery=90,
                    speed=0,
                    heading=90,
                    status="idle",
                ),
            ]
        )
        db.commit()

    response = client.get(f"/missions/{mission['id']}/replay")

    assert response.status_code == 200
    replay = response.json()
    assert replay["mission_id"] == mission["id"]
    assert replay["point_count"] == 2
    assert [point["latitude"] for point in replay["points"]] == [-26.204, -26.19]
