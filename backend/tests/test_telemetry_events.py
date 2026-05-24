from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError


def test_telemetry_payload_shape(client):
    response = client.get("/telemetry/latest")

    assert response.status_code == 200
    payload = response.json()[0]
    assert {
        "asset_id",
        "latitude",
        "longitude",
        "battery",
        "speed",
        "heading",
        "status",
        "mission_id",
        "timestamp",
    }.issubset(payload.keys())


def test_event_creation_for_mission(client):
    response = client.post(
        "/missions",
        json={
            "name": "Inspect Event Zone",
            "mission_type": "inspect_zone",
            "assigned_asset_id": "drone_002",
            "target_zone": "Zone Event",
            "target_latitude": -26.18,
            "target_longitude": 28.05,
            "priority": "high",
        },
    )

    assert response.status_code == 201
    events = client.get("/events").json()
    assert any(event["event_type"] == "mission_created" for event in events)


def test_websocket_emits_initial_telemetry_snapshot(client):
    with client.websocket_connect("/ws/telemetry") as websocket:
        executor = ThreadPoolExecutor(max_workers=1)
        receive = executor.submit(websocket.receive_json)
        try:
            envelope = receive.result(timeout=2)
        except TimeoutError as exc:
            websocket.close()
            raise AssertionError("telemetry websocket did not emit an initial snapshot") from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    assert envelope["type"] == "telemetry_snapshot"
    assert len(envelope["payload"]) >= 7
    payload = envelope["payload"][0]
    assert {
        "asset_id",
        "latitude",
        "longitude",
        "battery",
        "speed",
        "heading",
        "status",
        "mission_id",
        "timestamp",
    }.issubset(payload.keys())
