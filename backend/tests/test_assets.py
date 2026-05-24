from __future__ import annotations


def test_asset_creation(client):
    response = client.post(
        "/assets",
        json={
            "id": "sensor_test_001",
            "name": "Test Sensor",
            "asset_type": "sensor",
            "status": "idle",
            "latitude": -26.2,
            "longitude": 28.05,
            "battery": 99,
            "speed": 0,
            "heading": 0,
            "capabilities": ["air_quality"],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "sensor_test_001"
    assert data["asset_type"] == "sensor"
