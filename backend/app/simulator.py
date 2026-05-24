from __future__ import annotations

import asyncio
import math
import os
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import desc
from sqlalchemy.orm import object_session

from .database import SessionLocal
from .cognition import core_cognition_state, deactivate_mission_dependencies, evaluate_cognition_cycle, persist_replay_point
from .models import Asset, Event, Mission, MissionWaypoint, TelemetryRecord
from .orchestration import advance_active_scenarios
from .services import create_event
from .websocket import ConnectionManager


ARRIVAL_THRESHOLD = 0.0015
SIMULATION_STEP_DEGREES = float(os.getenv("STRATOSYN_SIM_STEP_DEGREES", "0.0025"))
ANOMALY_RATE = float(os.getenv("STRATOSYN_ANOMALY_RATE", "0.08"))
AUTO_ADVANCE_SCENARIOS = os.getenv("STRATOSYN_AUTO_ADVANCE_SCENARIOS", "0") == "1"

ANOMALIES = [
    ("signal_fluctuation", "info", "Signal fluctuation detected and self-corrected."),
    ("obstacle_detected", "warning", "Obstacle detected on route; path adjusted."),
    ("mission_delay", "warning", "Mission delay detected due to route correction."),
    ("camera_feed_interrupted", "warning", "Camera feed interrupted for a short interval."),
]


def calculate_heading(latitude: float, longitude: float, target_latitude: float, target_longitude: float) -> float:
    delta_lat = target_latitude - latitude
    delta_lon = target_longitude - longitude
    heading = math.degrees(math.atan2(delta_lon, delta_lat))
    return round((heading + 360) % 360, 2)


def telemetry_payload(asset: Asset, timestamp: datetime | None = None) -> dict:
    return {
        "asset_id": asset.id,
        "latitude": round(asset.latitude, 6),
        "longitude": round(asset.longitude, 6),
        "battery": round(asset.battery, 2),
        "speed": round(asset.speed, 2),
        "heading": round(asset.heading, 2),
        "status": asset.status,
        "mission_id": asset.current_mission_id,
        "timestamp": (timestamp or datetime.now(UTC)).isoformat(),
    }


class TelemetrySimulator:
    def __init__(self, manager: ConnectionManager, interval_seconds: float = 1.0) -> None:
        self.manager = manager
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        if self._task is None:
            return

        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass

    async def run(self) -> None:
        while True:
            await self.tick()
            await asyncio.sleep(self.interval_seconds)

    async def tick(self) -> list[dict]:
        timestamp = datetime.now(UTC)
        payloads: list[dict] = []

        with SessionLocal() as db:
            assets = db.query(Asset).all()
            for asset in assets:
                mission = None
                if asset.current_mission_id:
                    mission = db.get(Mission, asset.current_mission_id)
                record_mission_id = mission.id if mission else asset.current_mission_id

                if mission and mission.status == "running":
                    self._advance_asset(asset, mission)
                    previous_battery = asset.battery
                    asset.battery = max(0, asset.battery - 0.2)
                    if previous_battery >= 25 > asset.battery:
                        create_event(
                            db,
                            "battery_warning",
                            "warning",
                            f"{asset.name} battery dropped below 25%.",
                            asset_id=asset.id,
                            mission_id=mission.id,
                        )

                    self._maybe_complete_mission(db, asset, mission)
                    self._maybe_create_anomaly(db, asset, mission)
                elif asset.status not in {"active", "offline"}:
                    asset.speed = 0

                payload = telemetry_payload(asset, timestamp)
                payloads.append(payload)

                if record_mission_id:
                    db.add(
                        TelemetryRecord(
                            asset_id=asset.id,
                            mission_id=record_mission_id,
                            latitude=asset.latitude,
                            longitude=asset.longitude,
                            battery=asset.battery,
                            speed=asset.speed,
                            heading=asset.heading,
                            status=asset.status,
                            timestamp=timestamp,
                        )
                    )
                    persist_replay_point(db, asset, record_mission_id, timestamp)

            if AUTO_ADVANCE_SCENARIOS:
                advance_active_scenarios(db, timestamp)
            evaluate_cognition_cycle(db, timestamp)
            cognition_payload = core_cognition_state(db)
            db.commit()

        for payload in payloads:
            await self.manager.broadcast({"type": "telemetry", "payload": payload})
        await self.manager.broadcast({"type": "cognition", "payload": cognition_payload})

        return payloads

    def _advance_asset(self, asset: Asset, mission: Mission) -> None:
        target_latitude, target_longitude, _ = self._current_target(mission)
        delta_lat = target_latitude - asset.latitude
        delta_lon = target_longitude - asset.longitude
        distance = math.sqrt(delta_lat**2 + delta_lon**2)

        if distance <= ARRIVAL_THRESHOLD:
            asset.latitude = target_latitude
            asset.longitude = target_longitude
            asset.speed = 0
            asset.heading = calculate_heading(asset.latitude, asset.longitude, target_latitude, target_longitude)
            return

        step = min(SIMULATION_STEP_DEGREES, distance)
        asset.latitude += (delta_lat / distance) * step
        asset.longitude += (delta_lon / distance) * step
        asset.speed = 12 + random.random() * 6
        asset.heading = calculate_heading(asset.latitude, asset.longitude, target_latitude, target_longitude)

    def _maybe_complete_mission(self, db, asset: Asset, mission: Mission) -> None:
        target_latitude, target_longitude, waypoint = self._current_target(mission)
        distance = math.sqrt((target_latitude - asset.latitude) ** 2 + (target_longitude - asset.longitude) ** 2)
        if distance > ARRIVAL_THRESHOLD:
            return

        asset.latitude = target_latitude
        asset.longitude = target_longitude
        if waypoint is not None:
            waypoint.reached_at = datetime.now(UTC)
            asset.speed = 0
            create_event(
                db,
                "waypoint_reached",
                "info",
                f"{asset.name} reached waypoint {waypoint.label}.",
                asset_id=asset.id,
                mission_id=mission.id,
            )
            return

        asset.status = "idle"
        asset.speed = 0
        asset.current_mission_id = None
        mission.status = "completed"
        mission.completed_at = datetime.now(UTC)
        deactivate_mission_dependencies(db, mission.id)
        create_event(
            db,
            "mission_completed",
            "info",
            f"Mission {mission.name} completed by {asset.name}.",
            asset_id=asset.id,
            mission_id=mission.id,
        )

    def _maybe_create_anomaly(self, db, asset: Asset, mission: Mission) -> None:
        if random.random() >= ANOMALY_RATE:
            return

        recent_event = (
            db.query(Event)
            .filter(Event.asset_id == asset.id, Event.timestamp > datetime.now(UTC) - timedelta(seconds=20))
            .order_by(desc(Event.timestamp))
            .first()
        )
        if recent_event is not None:
            return

        event_type, severity, message = random.choice(ANOMALIES)
        create_event(db, event_type, severity, message, asset_id=asset.id, mission_id=mission.id)

    def _current_target(self, mission: Mission) -> tuple[float, float, MissionWaypoint | None]:
        session = object_session(mission)
        unreached = None
        if session is not None:
            unreached = (
                session.query(MissionWaypoint)
                .filter(MissionWaypoint.mission_id == mission.id, MissionWaypoint.reached_at.is_(None))
                .order_by(MissionWaypoint.sequence.asc(), MissionWaypoint.created_at.asc())
                .first()
            )
        if unreached is not None:
            return unreached.latitude, unreached.longitude, unreached
        return mission.target_latitude, mission.target_longitude, None
