"""add persisted operational cognition layers

Revision ID: 0002_operational_cognition
Revises: 0001_initial_schema
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_operational_cognition"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anomaly_clusters",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=24), nullable=False),
        sa.Column("asset_id", sa.String(length=64), nullable=True),
        sa.Column("mission_id", sa.String(length=64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("radius", sa.Float(), nullable=False),
        sa.Column("event_count", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_anomaly_clusters_asset_id", "anomaly_clusters", ["asset_id"])
    op.create_index("ix_anomaly_clusters_event_type", "anomaly_clusters", ["event_type"])
    op.create_index("ix_anomaly_clusters_last_seen_at", "anomaly_clusters", ["last_seen_at"])
    op.create_index("ix_anomaly_clusters_mission_id", "anomaly_clusters", ["mission_id"])
    op.create_index("ix_anomaly_clusters_severity", "anomaly_clusters", ["severity"])
    op.create_index("ix_anomaly_clusters_status", "anomaly_clusters", ["status"])

    op.create_table(
        "mission_dependencies",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("mission_id", sa.String(length=64), nullable=False),
        sa.Column("source_asset_id", sa.String(length=64), nullable=False),
        sa.Column("target_asset_id", sa.String(length=64), nullable=False),
        sa.Column("dependency_type", sa.String(length=64), nullable=False),
        sa.Column("strength", sa.Float(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mission_dependencies_active", "mission_dependencies", ["active"])
    op.create_index("ix_mission_dependencies_mission_id", "mission_dependencies", ["mission_id"])
    op.create_index("ix_mission_dependencies_source_asset_id", "mission_dependencies", ["source_asset_id"])
    op.create_index("ix_mission_dependencies_target_asset_id", "mission_dependencies", ["target_asset_id"])

    op.create_table(
        "reroute_suggestions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("mission_id", sa.String(length=64), nullable=False),
        sa.Column("asset_id", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("suggested_path", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_reroute_suggestions_asset_id", "reroute_suggestions", ["asset_id"])
    op.create_index("ix_reroute_suggestions_mission_id", "reroute_suggestions", ["mission_id"])
    op.create_index("ix_reroute_suggestions_status", "reroute_suggestions", ["status"])

    op.create_table(
        "replay_paths",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("mission_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("asset_id", sa.String(length=64), nullable=True),
        sa.Column("path", sa.JSON(), nullable=False),
        sa.Column("point_count", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_replay_paths_asset_id", "replay_paths", ["asset_id"])
    op.create_index("ix_replay_paths_mission_id", "replay_paths", ["mission_id"])


def downgrade() -> None:
    op.drop_table("replay_paths")
    op.drop_table("reroute_suggestions")
    op.drop_table("mission_dependencies")
    op.drop_table("anomaly_clusters")
