"""add Stratosyn Core cognition simulation tables

Revision ID: 0003_stratosyn_core_cognition
Revises: 0002_operational_cognition
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_stratosyn_core_cognition"
down_revision = "0002_operational_cognition"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reasoning_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=24), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("asset_id", sa.String(length=64), nullable=True),
        sa.Column("mission_id", sa.String(length=64), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("uncertainty", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reasoning_events_asset_id", "reasoning_events", ["asset_id"])
    op.create_index("ix_reasoning_events_category", "reasoning_events", ["category"])
    op.create_index("ix_reasoning_events_mission_id", "reasoning_events", ["mission_id"])
    op.create_index("ix_reasoning_events_severity", "reasoning_events", ["severity"])
    op.create_index("ix_reasoning_events_timestamp", "reasoning_events", ["timestamp"])

    op.create_table(
        "causality_edges",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("edge_type", sa.String(length=64), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_causality_edges_active", "causality_edges", ["active"])
    op.create_index("ix_causality_edges_edge_type", "causality_edges", ["edge_type"])
    op.create_index("ix_causality_edges_source_id", "causality_edges", ["source_id"])
    op.create_index("ix_causality_edges_source_type", "causality_edges", ["source_type"])
    op.create_index("ix_causality_edges_target_id", "causality_edges", ["target_id"])
    op.create_index("ix_causality_edges_target_type", "causality_edges", ["target_type"])

    op.create_table(
        "prediction_states",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("horizon_minutes", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("prediction_type", sa.String(length=64), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("uncertainty", sa.Float(), nullable=False),
        sa.Column("projected_latitude", sa.Float(), nullable=True),
        sa.Column("projected_longitude", sa.Float(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("projected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prediction_states_entity_id", "prediction_states", ["entity_id"])
    op.create_index("ix_prediction_states_entity_type", "prediction_states", ["entity_type"])
    op.create_index("ix_prediction_states_horizon_minutes", "prediction_states", ["horizon_minutes"])
    op.create_index("ix_prediction_states_prediction_type", "prediction_states", ["prediction_type"])

    op.create_table(
        "coordination_actions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("initiator_asset_id", sa.String(length=64), nullable=True),
        sa.Column("target_asset_id", sa.String(length=64), nullable=True),
        sa.Column("mission_id", sa.String(length=64), nullable=True),
        sa.Column("priority", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_coordination_actions_action_type", "coordination_actions", ["action_type"])
    op.create_index("ix_coordination_actions_initiator_asset_id", "coordination_actions", ["initiator_asset_id"])
    op.create_index("ix_coordination_actions_mission_id", "coordination_actions", ["mission_id"])
    op.create_index("ix_coordination_actions_status", "coordination_actions", ["status"])
    op.create_index("ix_coordination_actions_target_asset_id", "coordination_actions", ["target_asset_id"])

    op.create_table(
        "risk_fields",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("zone_id", sa.String(length=64), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("radius", sa.Float(), nullable=False),
        sa.Column("risk_type", sa.String(length=64), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("uncertainty", sa.Float(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_risk_fields_risk_type", "risk_fields", ["risk_type"])
    op.create_index("ix_risk_fields_zone_id", "risk_fields", ["zone_id"])

    op.create_table(
        "ecosystem_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("system_state", sa.String(length=32), nullable=False),
        sa.Column("operational_load", sa.Float(), nullable=False),
        sa.Column("resource_contention", sa.Float(), nullable=False),
        sa.Column("coverage_continuity", sa.Float(), nullable=False),
        sa.Column("mean_confidence", sa.Float(), nullable=False),
        sa.Column("risk_index", sa.Float(), nullable=False),
        sa.Column("active_reasoning_count", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ecosystem_snapshots_system_state", "ecosystem_snapshots", ["system_state"])
    op.create_index("ix_ecosystem_snapshots_timestamp", "ecosystem_snapshots", ["timestamp"])


def downgrade() -> None:
    op.drop_table("ecosystem_snapshots")
    op.drop_table("risk_fields")
    op.drop_table("coordination_actions")
    op.drop_table("prediction_states")
    op.drop_table("causality_edges")
    op.drop_table("reasoning_events")
