from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone

SEVERITY_WEIGHTS = {
    "Low": 0.25,
    "Medium": 0.50,
    "High": 0.75,
    "Critical": 1.00,
}


def get_risk_band(score: int) -> str:
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 35:
        return "Watch"
    return "Low"


def compute_risk_for_window(
    complaints: List[Dict[str, Any]],
    cluster_sizes: Dict[int, int],
    window_end: datetime,
) -> Dict[str, Any]:
    window_start = window_end - timedelta(days=90)
    in_window = [
        c for c in complaints
        if window_start <= c["created_at"] <= window_end
    ]
    n = len(in_window)
    if n == 0:
        factors = [
            {"key": "V", "label": "Volume", "weight": 0.30, "value": 0.0, "points": 0.0, "explanation": "No complaints filed in the last 90 days."},
            {"key": "S", "label": "Severity", "weight": 0.25, "value": 0.0, "points": 0.0, "explanation": "No active severity weight recorded."},
            {"key": "R", "label": "Repetition", "weight": 0.20, "value": 0.0, "points": 0.0, "explanation": "No repeated complaint clusters detected."},
            {"key": "A", "label": "Ageing", "weight": 0.15, "value": 0.0, "points": 0.0, "explanation": "No open complaints past SLA deadline."},
            {"key": "X", "label": "Spread", "weight": 0.10, "value": 0.0, "points": 0.0, "explanation": "0 of 4 AICTE units involved."},
        ]
        return {"score": 0, "band": "Low", "factors": factors, "total_90d": 0}

    v_val = min(1.0, n / 12.0)
    s_val = sum(SEVERITY_WEIGHTS.get(c["severity"], 0.25) for c in in_window) / n

    clustered_count = sum(
        1 for c in in_window
        if cluster_sizes.get(c["id"], 1) >= 2
    )
    r_val = clustered_count / n

    open_in_window = [
        c for c in in_window
        if c["status"] not in ("Resolved", "Closed") and (c.get("resolved_at") is None or c["resolved_at"] > window_end)
    ]
    if len(open_in_window) == 0:
        a_val = 0.0
        breached_open = 0
    else:
        breached_open = sum(1 for c in open_in_window if window_end > c["due_at"])
        a_val = breached_open / len(open_in_window)

    distinct_units = len(set(c["unit_code"] for c in in_window))
    x_val = distinct_units / 4.0

    raw_score = 100.0 * (0.30 * v_val + 0.25 * s_val + 0.20 * r_val + 0.15 * a_val + 0.10 * x_val)
    score = max(0, min(100, int(round(raw_score))))

    crit_high = sum(1 for c in in_window if c["severity"] in ("Critical", "High"))
    factors = [
        {
            "key": "V",
            "label": "Volume",
            "weight": 0.30,
            "value": round(v_val, 3),
            "points": round(30.0 * v_val, 1),
            "explanation": f"{n} complaints filed in the 90-day window against the 12-case ceiling.",
        },
        {
            "key": "S",
            "label": "Severity",
            "weight": 0.25,
            "value": round(s_val, 3),
            "points": round(25.0 * s_val, 1),
            "explanation": f"{crit_high} of {n} recent cases are graded High or Critical severity.",
        },
        {
            "key": "R",
            "label": "Repetition",
            "weight": 0.20,
            "value": round(r_val, 3),
            "points": round(20.0 * r_val, 1),
            "explanation": f"{clustered_count} of {n} complaints belong to recurring similarity clusters.",
        },
        {
            "key": "A",
            "label": "Ageing",
            "weight": 0.15,
            "value": round(a_val, 3),
            "points": round(15.0 * a_val, 1),
            "explanation": f"{breached_open} of {len(open_in_window)} open complaints have breached SLA deadlines." if open_in_window else "No open complaints in window.",
        },
        {
            "key": "X",
            "label": "Spread",
            "weight": 0.10,
            "value": round(x_val, 3),
            "points": round(10.0 * x_val, 1),
            "explanation": f"Cases span {distinct_units} of 4 AICTE bureaus and cells.",
        },
    ]

    return {
        "score": score,
        "band": get_risk_band(score),
        "factors": factors,
        "total_90d": n,
    }


def compute_institution_risk(
    complaints: List[Dict[str, Any]],
    cluster_sizes: Dict[int, int],
    now: datetime,
) -> Dict[str, Any]:
    current = compute_risk_for_window(complaints, cluster_sizes, now)
    history = []
    for w in range(11, -1, -1):
        wend = now - timedelta(days=7 * w)
        wres = compute_risk_for_window(complaints, cluster_sizes, wend)
        history.append({
            "week": (wend).strftime("%d %b"),
            "score": wres["score"],
        })
    current["history"] = history
    current["sparkline"] = [h["score"] for h in history]
    return current
