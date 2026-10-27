from datetime import datetime, timedelta
from typing import Tuple

SLA_DAYS = {
    "Critical": 3,
    "High": 7,
    "Medium": 15,
    "Low": 30,
}

STATUS_ADJ = {
    "New": 0.10,
    "Assigned": 0.00,
    "In Review": -0.10,
    "Awaiting Institution": 0.15,
    "Escalated": -0.05,
}


def compute_due_at(created_at: datetime, severity: str) -> datetime:
    days = SLA_DAYS.get(severity, 15)
    return created_at + timedelta(days=days)


def compute_sla_state(
    created_at: datetime,
    due_at: datetime,
    status: str,
    open_cases_in_unit: int,
    now: datetime,
) -> Tuple[str, float, float]:
    """
    Returns (sla_state, breach_probability, elapsed_ratio)
    sla_state in ('ok', 'at_risk', 'breached', 'closed')
    """
    total_sec = max(1.0, (due_at - created_at).total_seconds())
    elapsed_raw = (now - created_at).total_seconds() / total_sec
    elapsed = max(0.0, min(1.0, elapsed_raw))

    if status in ("Resolved", "Closed"):
        return "closed", 0.0, round(elapsed, 3)

    if now > due_at:
        return "breached", 1.0, 1.0

    load = min(1.0, open_cases_in_unit / 25.0)
    adj = STATUS_ADJ.get(status, 0.0)
    p = max(0.0, min(1.0, 0.6 * elapsed + 0.2 * load + adj))
    p_rounded = round(p, 2)

    if p >= 0.60:
        return "at_risk", p_rounded, round(elapsed, 3)
    return "ok", p_rounded, round(elapsed, 3)
