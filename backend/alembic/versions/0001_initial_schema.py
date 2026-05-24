"""initial Stratosyn schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("asset_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("battery", sa.Float(), nullable=False),
        sa.Column("speed", sa.Float(), nullable=False),
        sa.Column("heading", sa.Float(), nullable=False),
        sa.Column("current_mission_id", sa.String(length=64), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assets_asset_type", "assets", ["asset_type"])
    op.create_index("ix_assets_current_mission_id", "assets", ["current_mission_id"])
    op.create_index("ix_assets_status", "assets", ["status"])

    op.create_table(
        "missions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("mission_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("assigned_asset_id", sa.String(length=64), nullable=True),
        sa.Column("target_zone", sa.String(length=120), nullable=False),
        sa.Column("target_latitude", sa.Float(), nullable=False),
        sa.Column("target_longitude", sa.Float(), nullable=False),
        sa.Column("priority", sa.String(length=32), nullable=False),
        sa.Column("start_latitude", sa.Float(), nullable=True),
        sa.Column("start_longitude", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_missions_assigned_asset_id", "missions", ["assigned_asset_id"])
    op.create_index("ix_missions_mission_type", "missions", ["mission_type"])
    op.create_index("ix_missions_status", "missions", ["status"])

    op.create_table(
        "mission_waypoints",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("mission_id", sa.String(length=64), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("reached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mission_waypoints_mission_id", "mission_waypoints", ["mission_id"])
    op.create_index("ix_mission_waypoints_sequence", "mission_waypoints", ["sequence"])

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=24), nullable=False),
        sa.Column("asset_id", sa.String(length=64), nullable=True),
        sa.Column("mission_id", sa.String(length=64), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(length=120), nullable=True),
    )
    op.create_index("ix_events_asset_id", "events", ["asset_id"])
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_mission_id", "events", ["mission_id"])
    op.create_index("ix_events_severity", "events", ["severity"])
    op.create_index("ix_events_timestamp", "events", ["timestamp"])

    op.create_table(
        "telemetry_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.String(length=64), nullable=False),
        sa.Column("mission_id", sa.String(length=64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("battery", sa.Float(), nullable=False),
        sa.Column("speed", sa.Float(), nullable=False),
        sa.Column("heading", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_telemetry_records_asset_id", "telemetry_records", ["asset_id"])
    op.create_index("ix_telemetry_records_mission_id", "telemetry_records", ["mission_id"])
    op.create_index("ix_telemetry_records_timestamp", "telemetry_records", ["timestamp"])


def downgrade() -> None:
    op.drop_table("telemetry_records")
    op.drop_table("events")
    op.drop_table("mission_waypoints")
    op.drop_table("missions")
    op.drop_table("assets")
