from __future__ import annotations

from fastapi import APIRouter

from ..schemas import ParsedMissionOut, ParseMissionIn


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse-mission", response_model=ParsedMissionOut)
def parse_mission(payload: ParseMissionIn) -> ParsedMissionOut:
    command = payload.command.lower()
    if "intrusion" in command and "sector b" in command:
        return ParsedMissionOut(
            mission_type="investigate_alert",
            target_zone="Sector B",
            priority="high",
            recommended_asset_type="drone",
            requires_operator_approval=True,
        )
    return ParsedMissionOut()
