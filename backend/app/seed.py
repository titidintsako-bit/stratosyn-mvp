from __future__ import annotations

from sqlalchemy.orm import Session

from .models import Asset


SEEDED_ASSETS = [
    {
        "id": "drone_001",
        "name": "Drone Alpha",
        "asset_type": "drone",
        "status": "idle",
        "latitude": -26.2041,
        "longitude": 28.0473,
        "battery": 92,
        "speed": 0,
        "heading": 85,
        "capabilities": ["visual_inspection", "thermal_scan", "route_patrol"],
    },
    {
        "id": "drone_002",
        "name": "Drone Bravo",
        "asset_type": "drone",
        "status": "idle",
        "latitude": -26.1976,
        "longitude": 28.0568,
        "battery": 78,
        "speed": 0,
        "heading": 130,
        "capabilities": ["visual_inspection", "high_wind_operation"],
    },
    {
        "id": "drone_003",
        "name": "Drone Ceres",
        "asset_type": "drone",
        "status": "idle",
        "latitude": -26.2144,
        "longitude": 28.0332,
        "battery": 64,
        "speed": 0,
        "heading": 310,
        "capabilities": ["thermal_scan", "return_home", "night_operation"],
    },
    {
        "id": "robot_001",
        "name": "Ground Robot Delta",
        "asset_type": "ground_robot",
        "status": "idle",
        "latitude": -26.2087,
        "longitude": 28.062,
        "battery": 88,
        "speed": 0,
        "heading": 20,
        "capabilities": ["ground_patrol", "obstacle_mapping"],
    },
    {
        "id": "camera_001",
        "name": "Camera Grid 1",
        "asset_type": "camera",
        "status": "active",
        "latitude": -26.2039,
        "longitude": 28.0412,
        "battery": 100,
        "speed": 0,
        "heading": 112,
        "capabilities": ["fixed_video", "motion_detection", "storage_zone_coverage"],
    },
    {
        "id": "camera_002",
        "name": "Camera Grid 2",
        "asset_type": "camera",
        "status": "active",
        "latitude": -26.1988,
        "longitude": 28.0566,
        "battery": 100,
        "speed": 0,
        "heading": 238,
        "capabilities": ["fixed_video", "thermal_validation", "sector_b_coverage"],
    },
    {
        "id": "sensor_node_001",
        "name": "Static Sensor Node B1",
        "asset_type": "sensor",
        "status": "active",
        "latitude": -26.1964,
        "longitude": 28.0514,
        "battery": 96,
        "speed": 0,
        "heading": 0,
        "capabilities": ["motion_sensor", "acoustic_monitoring"],
    },
    {
        "id": "sensor_node_002",
        "name": "Static Sensor Node C1",
        "asset_type": "sensor",
        "status": "active",
        "latitude": -26.2079,
        "longitude": 28.0591,
        "battery": 94,
        "speed": 0,
        "heading": 0,
        "capabilities": ["perimeter_vibration", "motion_sensor"],
    },
]


def seed_data(db: Session) -> None:
    if db.query(Asset).count() > 0:
        return

    for asset_data in SEEDED_ASSETS:
        db.add(Asset(**asset_data))
    db.commit()
