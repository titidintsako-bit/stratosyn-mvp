"""add orchestration scenario runs

Revision ID: 0004_orchestration_scenarios
Revises: 0003_stratosyn_core_cognition
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_orchestration_scenarios"
down_revision = "0003_stratosyn_core_cognition"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "orchestration_scenario_runs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("scenario_type", sa.String(length=64), nullable=False),
        sa.Column("command", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(length=64), nullable=False),
        sa.Column("selected_asset_id", sa.String(length=64), nullable=True),
        sa.Column("primary_mission_id", sa.String(length=64), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("outcome", sa.String(length=64), nullable=True),
        sa.Column("timeline", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_orchestration_scenario_runs_phase", "orchestration_scenario_runs", ["phase"])
    op.create_index("ix_orchestration_scenario_runs_primary_mission_id", "orchestration_scenario_runs", ["primary_mission_id"])
    op.create_index("ix_orchestration_scenario_runs_scenario_type", "orchestration_scenario_runs", ["scenario_type"])
    op.create_index("ix_orchestration_scenario_runs_selected_asset_id", "orchestration_scenario_runs", ["selected_asset_id"])
    op.create_index("ix_orchestration_scenario_runs_status", "orchestration_scenario_runs", ["status"])


def downgrade() -> None:
    op.drop_table("orchestration_scenario_runs")
