from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Unit, Institution, Complaint, Alert
from ..schemas import UserInfo
from ..auth import get_current_user
from ..seed import recompute_all_intelligence

router = APIRouter()


@router.get("/overview")
def get_overview(db: Session = Depends(get_db), current_user: UserInfo = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    inst_scores, case_sla_map = recompute_all_intelligence(db, now)

    units = {u.id: u.code for u in db.query(Unit).all()}
    institutions = {i.id: i for i in db.query(Institution).all()}
    complaints = db.query(Complaint).all()

    open_count = 0
    at_risk_count = 0
    breached_count = 0
    resolved_30d = 0
    res_durations = []

    unit_stats = {code: {"code": code, "open": 0, "at_risk": 0, "breached": 0} for code in ("AB", "ACB", "SGC", "VC")}
    cat_counts = {}

    for c in complaints:
        cat_counts[c.category] = cat_counts.get(c.category, 0) + 1
        ucode = units.get(c.unit_id, "ACB")
        sla_state, _, _ = case_sla_map.get(c.id, ("ok", 0.0, 0.0))

        if c.status not in ("Resolved", "Closed"):
            open_count += 1
            unit_stats[ucode]["open"] += 1
            if sla_state == "at_risk":
                at_risk_count += 1
                unit_stats[ucode]["at_risk"] += 1
            elif sla_state == "breached":
                breached_count += 1
                unit_stats[ucode]["breached"] += 1
                unit_stats[ucode]["at_risk"] += 1
        else:
            if c.resolved_at:
                res_utc = c.resolved_at.replace(tzinfo=timezone.utc) if c.resolved_at.tzinfo is None else c.resolved_at
                created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
                if (now - res_utc).days <= 30:
                    resolved_30d += 1
                res_durations.append(max(0.5, (res_utc - created_utc).total_seconds() / 86400.0))

    avg_res_days = round(sum(res_durations) / len(res_durations), 1) if res_durations else 6.4
    high_risk_insts = sum(1 for r in inst_scores.values() if r["score"] >= 60)

    # 12 weeks trend
    trend = []
    for w in range(11, -1, -1):
        wend = now - timedelta(days=w * 7)
        wstart = wend - timedelta(days=7)
        row = {"week_start": wstart.strftime("%d %b"), "AB": 0, "ACB": 0, "SGC": 0, "VC": 0}
        for c in complaints:
            created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
            if wstart <= created_utc < wend:
                ucode = units.get(c.unit_id, "ACB")
                row[ucode] = row.get(ucode, 0) + 1
        trend.append(row)

    # Watchlist top 6
    watchlist_all = []
    for inst_id, rdata in inst_scores.items():
        inst = institutions.get(inst_id)
        if not inst:
            continue
        open_inst = sum(1 for c in complaints if c.institution_id == inst_id and c.status not in ("Resolved", "Closed"))
        watchlist_all.append({
            "id": inst.id,
            "name": inst.name,
            "city": inst.city,
            "state": inst.state,
            "score": rdata["score"],
            "band": rdata["band"],
            "open_cases": open_inst,
            "sparkline": rdata["sparkline"],
        })
    watchlist_all.sort(key=lambda x: (-x["score"], x["name"]))
    watchlist = watchlist_all[:6]

    recent_alerts_q = (
        db.query(Alert)
        .filter(Alert.acknowledged == False)
        .order_by(Alert.created_at.desc(), Alert.id.desc())
        .limit(6)
        .all()
    )
    recent_alerts = [
        {
            "id": a.id,
            "rule": a.rule,
            "severity": a.severity,
            "institution_id": a.institution_id,
            "complaint_id": a.complaint_id,
            "message": a.message,
            "created_at": (a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at).isoformat(),
            "acknowledged": a.acknowledged,
        }
        for a in recent_alerts_q
    ]

    category_split = [{"category": k, "count": v} for k, v in sorted(cat_counts.items(), key=lambda x: -x[1])]

    return {
        "stats": {
            "open": open_count,
            "at_risk": at_risk_count,
            "breached": breached_count,
            "high_risk_institutions": high_risk_insts,
            "resolved_30d": resolved_30d,
            "avg_resolution_days": avg_res_days,
        },
        "trend": trend,
        "unit_workload": list(unit_stats.values()),
        "category_split": category_split,
        "watchlist": watchlist,
        "recent_alerts": recent_alerts,
    }
