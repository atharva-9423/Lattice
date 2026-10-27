from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Unit, Institution, Complaint, CaseLink
from ..schemas import UserInfo
from ..auth import get_current_user
from ..seed import recompute_all_intelligence

router = APIRouter()


@router.get("/institutions")
def list_institutions(
    q: Optional[str] = None,
    band: Optional[str] = None,
    sort: str = "score_desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    inst_scores, _ = recompute_all_intelligence(db, now)
    institutions = db.query(Institution).all()
    complaints = db.query(Complaint).all()

    open_by_inst = {}
    for c in complaints:
        if c.status not in ("Resolved", "Closed"):
            open_by_inst[c.institution_id] = open_by_inst.get(c.institution_id, 0) + 1

    items = []
    for inst in institutions:
        rdata = inst_scores.get(inst.id, {"score": 0, "band": "Low", "total_90d": 0, "sparkline": [0] * 12})
        if q:
            ql = q.lower()
            if ql not in inst.name.lower() and ql not in inst.city.lower() and ql not in inst.state.lower():
                continue
        if band and band != "All" and rdata["band"] != band:
            continue

        items.append({
            "id": inst.id,
            "name": inst.name,
            "city": inst.city,
            "state": inst.state,
            "type": inst.type,
            "established_year": inst.established_year,
            "intake": inst.intake,
            "score": rdata["score"],
            "band": rdata["band"],
            "open_cases": open_by_inst.get(inst.id, 0),
            "total_90d": rdata["total_90d"],
            "sparkline": rdata["sparkline"],
        })

    if sort == "name_asc":
        items.sort(key=lambda x: x["name"])
    else:
        items.sort(key=lambda x: (-x["score"], x["name"]))

    total = len(items)
    start = (page - 1) * page_size
    return {
        "items": items[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/institutions/{institution_id}")
def get_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    inst_scores, case_sla_map = recompute_all_intelligence(db, now)
    rdata = inst_scores.get(inst.id)
    units = {u.id: u.code for u in db.query(Unit).all()}

    c_list = (
        db.query(Complaint)
        .filter(Complaint.institution_id == inst.id)
        .order_by(Complaint.created_at.desc())
        .all()
    )

    units_involved = sorted(list(set(units.get(c.unit_id, "ACB") for c in c_list)))
    recent_30 = [
        c for c in c_list
        if (now - (c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at)).days <= 30
    ]
    recent_units = set(units.get(c.unit_id, "ACB") for c in recent_30)
    dup_count = db.query(CaseLink).filter(CaseLink.institution_id == inst.id, CaseLink.type == "Duplicate").count()

    pattern_summary = None
    if rdata["score"] >= 60:
        dup_clause = f"; {dup_count * 2} cases form near-duplicate clusters" if dup_count > 0 else ""
        pattern_summary = (
            f"{len(recent_30)} complaints filed across {len(recent_units)} units in the last 30 days{dup_clause}."
        )

    complaints_out = []
    for c in c_list:
        sla_state, prob, _ = case_sla_map.get(c.id, ("ok", 0.0, 0.0))
        created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
        due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
        complaints_out.append({
            "id": c.id,
            "ref": c.ref,
            "title": c.title,
            "category": c.category,
            "severity": c.severity,
            "status": c.status,
            "unit_code": units.get(c.unit_id, "ACB"),
            "created_at": created_utc.isoformat(),
            "due_at": due_utc.isoformat(),
            "sla_state": sla_state,
            "breach_probability": prob,
        })

    return {
        "id": inst.id,
        "name": inst.name,
        "city": inst.city,
        "state": inst.state,
        "type": inst.type,
        "established_year": inst.established_year,
        "intake": inst.intake,
        "score": rdata["score"],
        "band": rdata["band"],
        "pattern_summary": pattern_summary,
        "factors": rdata["factors"],
        "history": rdata["history"],
        "sparkline": rdata["sparkline"],
        "units_involved": units_involved,
        "complaints": complaints_out,
    }


@router.get("/institutions/{institution_id}/graph")
def get_institution_graph(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    recompute_all_intelligence(db, now)
    units = {u.id: u.code for u in db.query(Unit).all()}
    c_list = (
        db.query(Complaint)
        .filter(Complaint.institution_id == inst.id)
        .order_by(Complaint.created_at.asc())
        .all()
    )
    links = db.query(CaseLink).filter(CaseLink.institution_id == inst.id).all()

    nodes = [
        {
            "id": c.id,
            "ref": c.ref,
            "title": c.title,
            "unit_code": units.get(c.unit_id, "ACB"),
            "severity": c.severity,
            "status": c.status,
            "created_at": (c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at).isoformat(),
        }
        for c in c_list
    ]
    edges = [
        {
            "source": lk.a_id,
            "target": lk.b_id,
            "type": lk.type,
            "similarity": lk.similarity,
        }
        for lk in links
    ]
    return {"nodes": nodes, "edges": edges}
