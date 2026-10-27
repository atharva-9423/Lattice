from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Unit, Officer, Institution, Complaint, CaseEvent, CaseLink, Alert
from ..schemas import UserInfo, AnalyzeRequest, CreateComplaintRequest, PatchComplaintRequest
from ..auth import get_current_user
from ..engine.classify import classify_complaint, CATEGORY_TO_UNIT
from ..engine.severity import detect_severity
from ..engine.linking import compute_institution_links
from ..engine.risk import compute_institution_risk
from ..engine.sla import compute_due_at, compute_sla_state
from ..seed import recompute_all_intelligence

router = APIRouter()

SEVERITY_ORDER = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}


def build_complaint_detail(db: Session, c: Complaint, current_user: UserInfo, now: datetime):
    inst_scores, case_sla_map = recompute_all_intelligence(db, now)
    units = {u.id: u for u in db.query(Unit).all()}
    officers = {o.id: o for o in db.query(Officer).all()}
    inst = db.query(Institution).filter(Institution.id == c.institution_id).first()
    unit_obj = units.get(c.unit_id)
    unit_code = unit_obj.code if unit_obj else "ACB"

    sla_state, prob, elapsed = case_sla_map.get(c.id, ("ok", 0.0, 0.0))

    events = (
        db.query(CaseEvent)
        .filter(CaseEvent.complaint_id == c.id)
        .order_by(CaseEvent.created_at.asc(), CaseEvent.id.asc())
        .all()
    )

    raw_links = (
        db.query(CaseLink)
        .filter((CaseLink.a_id == c.id) | (CaseLink.b_id == c.id))
        .all()
    )
    other_ids = [lk.b_id if lk.a_id == c.id else lk.a_id for lk in raw_links]
    other_comps = {
        oc.id: oc for oc in db.query(Complaint).filter(Complaint.id.in_(other_ids)).all()
    } if other_ids else {}

    links_out = []
    for lk in sorted(raw_links, key=lambda x: -x.similarity):
        oid = lk.b_id if lk.a_id == c.id else lk.a_id
        oc = other_comps.get(oid)
        if oc:
            ou = units.get(oc.unit_id)
            links_out.append({
                "id": oc.id,
                "ref": oc.ref,
                "title": oc.title,
                "unit_code": ou.code if ou else "ACB",
                "severity": oc.severity,
                "status": oc.status,
                "created_at": (oc.created_at.replace(tzinfo=timezone.utc) if oc.created_at.tzinfo is None else oc.created_at).isoformat(),
                "type": lk.type,
                "similarity": lk.similarity,
            })

    cluster_members = (
        db.query(Complaint)
        .filter(Complaint.institution_id == c.institution_id, Complaint.cluster_id == c.cluster_id)
        .all()
        if c.cluster_id is not None else [c]
    )

    can_edit = current_user.role == "chairperson" or (
        current_user.role == "unit_officer" and current_user.unit_code == unit_code
    )
    allowed_actions = ["assign", "status", "note", "escalate"] if can_edit else []

    inst_risk = inst_scores.get(c.institution_id, {"score": 0, "band": "Low"})
    assigned_off = officers.get(c.assigned_officer_id) if c.assigned_officer_id else None
    unit_officers = [
        {"id": o.id, "name": o.name, "title": o.title}
        for o in officers.values() if o.unit_id == c.unit_id
    ]

    return {
        "id": c.id,
        "ref": c.ref,
        "title": c.title,
        "description": c.description,
        "category": c.category,
        "severity": c.severity,
        "status": c.status,
        "unit_code": unit_code,
        "unit_name": unit_obj.name if unit_obj else unit_code,
        "complainant_type": c.complainant_type,
        "created_at": (c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at).isoformat(),
        "updated_at": (c.updated_at.replace(tzinfo=timezone.utc) if c.updated_at.tzinfo is None else c.updated_at).isoformat(),
        "due_at": (c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at).isoformat(),
        "resolved_at": (c.resolved_at.replace(tzinfo=timezone.utc) if c.resolved_at.tzinfo is None else c.resolved_at).isoformat() if c.resolved_at else None,
        "escalation_count": c.escalation_count,
        "auto_confidence": c.auto_confidence,
        "assigned_officer": {
            "id": assigned_off.id,
            "name": assigned_off.name,
            "title": assigned_off.title,
        } if assigned_off else None,
        "unit_officers": unit_officers,
        "institution": {
            "id": inst.id,
            "name": inst.name,
            "city": inst.city,
            "state": inst.state,
            "score": inst_risk["score"],
            "band": inst_risk["band"],
        } if inst else None,
        "sla": {
            "state": sla_state,
            "breach_probability": prob,
            "elapsed_ratio": elapsed,
            "due_at": (c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at).isoformat(),
        },
        "cluster": {
            "id": c.cluster_id,
            "size": len(cluster_members),
        },
        "links": links_out,
        "events": [
            {
                "id": ev.id,
                "type": ev.type,
                "actor": ev.actor,
                "message": ev.message,
                "created_at": (ev.created_at.replace(tzinfo=timezone.utc) if ev.created_at.tzinfo is None else ev.created_at).isoformat(),
            }
            for ev in events
        ],
        "allowed_actions": allowed_actions,
    }


@router.get("/complaints")
def list_complaints(
    q: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    unit: Optional[str] = None,
    category: Optional[str] = None,
    institution_id: Optional[int] = None,
    sla: Optional[str] = None,
    sort: str = "created_desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    _, case_sla_map = recompute_all_intelligence(db, now)

    units = {u.id: u.code for u in db.query(Unit).all()}
    institutions = {i.id: i for i in db.query(Institution).all()}
    all_comps = db.query(Complaint).all()

    cluster_counts = {}
    for c in all_comps:
        if c.cluster_id is not None:
            key = (c.institution_id, c.cluster_id)
            cluster_counts[key] = cluster_counts.get(key, 0) + 1

    filtered = []
    for c in all_comps:
        ucode = units.get(c.unit_id, "ACB")
        inst = institutions.get(c.institution_id)
        sla_state, prob, _ = case_sla_map.get(c.id, ("ok", 0.0, 0.0))

        if q:
            ql = q.lower()
            inst_name = inst.name.lower() if inst else ""
            if ql not in c.title.lower() and ql not in c.ref.lower() and ql not in inst_name and ql not in c.description.lower():
                continue
        if status and c.status != status:
            continue
        if severity and c.severity != severity:
            continue
        if unit and ucode != unit:
            continue
        if category and c.category != category:
            continue
        if institution_id and c.institution_id != institution_id:
            continue
        if sla and sla_state != sla:
            continue

        c_size = cluster_counts.get((c.institution_id, c.cluster_id), 1)
        created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
        due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at

        filtered.append({
            "id": c.id,
            "ref": c.ref,
            "title": c.title,
            "institution": {"id": inst.id, "name": inst.name} if inst else {"id": 0, "name": "Unknown"},
            "category": c.category,
            "severity": c.severity,
            "status": c.status,
            "unit_code": ucode,
            "created_at": created_utc.isoformat(),
            "due_at": due_utc.isoformat(),
            "sla_state": sla_state,
            "breach_probability": prob,
            "cluster_size": c_size,
            "_created_dt": created_utc,
            "_due_dt": due_utc,
            "_sev_rank": SEVERITY_ORDER.get(c.severity, 1),
        })

    if sort == "due_asc":
        filtered.sort(key=lambda x: x["_due_dt"])
    elif sort == "severity_desc":
        filtered.sort(key=lambda x: (-x["_sev_rank"], -x["_created_dt"].timestamp()))
    else:
        filtered.sort(key=lambda x: -x["_created_dt"].timestamp())

    total = len(filtered)
    start = (page - 1) * page_size
    page_items = filtered[start : start + page_size]
    for item in page_items:
        item.pop("_created_dt", None)
        item.pop("_due_dt", None)
        item.pop("_sev_rank", None)

    return {
        "items": page_items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/complaints/analyze")
def analyze_complaint(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    inst = db.query(Institution).filter(Institution.id == payload.institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    category, unit_code, confidence = classify_complaint(payload.title, payload.description)
    severity = detect_severity(payload.title, payload.description)

    units = {u.id: u.code for u in db.query(Unit).all()}
    existing_comps = (
        db.query(Complaint)
        .filter(Complaint.institution_id == payload.institution_id)
        .all()
    )

    c_dicts = []
    comp_by_id = {}
    for c in existing_comps:
        created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
        due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
        res_utc = (c.resolved_at.replace(tzinfo=timezone.utc) if c.resolved_at.tzinfo is None else c.resolved_at) if c.resolved_at else None
        comp_by_id[c.id] = c
        c_dicts.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "unit_code": units.get(c.unit_id, "ACB"),
            "severity": c.severity,
            "status": c.status,
            "created_at": created_utc,
            "due_at": due_utc,
            "resolved_at": res_utc,
        })

    # Current risk
    _, cur_clusters = compute_institution_links(c_dicts)
    cur_cl_counts = {}
    for cid, cl_id in cur_clusters.items():
        cur_cl_counts[cl_id] = cur_cl_counts.get(cl_id, 0) + 1
    cur_sizes = {cid: cur_cl_counts.get(cl_id, 1) for cid, cl_id in cur_clusters.items()}
    cur_risk = compute_institution_risk(c_dicts, cur_sizes, now)

    # Projected with hypothetical complaint id = 999999
    temp_id = 999999
    new_due = compute_due_at(now, severity)
    proj_dicts = list(c_dicts) + [{
        "id": temp_id,
        "title": payload.title,
        "description": payload.description,
        "unit_code": unit_code,
        "severity": severity,
        "status": "New",
        "created_at": now,
        "due_at": new_due,
        "resolved_at": None,
    }]
    proj_links, proj_clusters = compute_institution_links(proj_dicts)
    proj_cl_counts = {}
    for cid, cl_id in proj_clusters.items():
        proj_cl_counts[cl_id] = proj_cl_counts.get(cl_id, 0) + 1
    proj_sizes = {cid: proj_cl_counts.get(cl_id, 1) for cid, cl_id in proj_clusters.items()}
    proj_risk = compute_institution_risk(proj_dicts, proj_sizes, now)

    matched_links = []
    for lk in sorted(proj_links, key=lambda x: -x["similarity"]):
        if lk["a_id"] == temp_id or lk["b_id"] == temp_id:
            other_id = lk["a_id"] if lk["b_id"] == temp_id else lk["b_id"]
            oc = comp_by_id.get(other_id)
            if oc:
                matched_links.append({
                    "id": oc.id,
                    "ref": oc.ref,
                    "title": oc.title,
                    "unit_code": units.get(oc.unit_id, "ACB"),
                    "severity": oc.severity,
                    "status": oc.status,
                    "type": lk["type"],
                    "similarity": lk["similarity"],
                })

    projected_score = max(cur_risk["score"] + (2 if matched_links else 1), proj_risk["score"])
    projected_score = min(100, projected_score)
    from ..engine.risk import get_risk_band
    band_after = get_risk_band(projected_score)

    return {
        "category": category,
        "confidence": confidence,
        "unit_code": unit_code,
        "severity": severity,
        "links": matched_links,
        "projected_risk": {
            "current": cur_risk["score"],
            "projected": projected_score,
            "delta": projected_score - cur_risk["score"],
            "band_before": cur_risk["band"],
            "band_after": band_after,
        },
    }


@router.post("/complaints")
def create_complaint(
    payload: CreateComplaintRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    inst = db.query(Institution).filter(Institution.id == payload.institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    auto_cat, auto_unit, confidence = classify_complaint(payload.title, payload.description)
    category = payload.category if payload.category in CATEGORY_TO_UNIT else auto_cat
    unit_code = CATEGORY_TO_UNIT.get(category, auto_unit)
    severity = detect_severity(payload.title, payload.description, override=payload.severity)

    unit_obj = db.query(Unit).filter(Unit.code == unit_code).first()
    if not unit_obj:
        raise HTTPException(status_code=400, detail="Target routing unit not found")

    max_id = db.query(Complaint).count() + 1
    ref = f"AICTE-2026-{max_id:05d}"
    while db.query(Complaint).filter(Complaint.ref == ref).first():
        max_id += 1
        ref = f"AICTE-2026-{max_id:05d}"

    due_at = compute_due_at(now, severity)
    comp = Complaint(
        ref=ref,
        institution_id=inst.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        category=category,
        severity=severity,
        status="New",
        unit_id=unit_obj.id,
        assigned_officer_id=None,
        complainant_type=payload.complainant_type,
        created_at=now,
        updated_at=now,
        due_at=due_at,
        resolved_at=None,
        escalation_count=0,
        auto_confidence=confidence,
    )
    db.add(comp)
    db.flush()

    db.add(CaseEvent(
        complaint_id=comp.id,
        type="Created",
        actor=f"{payload.complainant_type} Intake",
        message=f"Complaint filed by {payload.complainant_type.lower()} against {inst.name}.",
        created_at=now,
    ))
    db.add(CaseEvent(
        complaint_id=comp.id,
        type="Routed",
        actor="Intelligence Engine",
        message=f"Classified as {category} ({int(confidence * 100)}% confidence) and routed to {unit_obj.name} ({unit_code}).",
        created_at=now,
    ))
    db.commit()

    recompute_all_intelligence(db, now)

    linked_count = db.query(CaseLink).filter((CaseLink.a_id == comp.id) | (CaseLink.b_id == comp.id)).count()
    if linked_count > 0:
        db.add(CaseEvent(
            complaint_id=comp.id,
            type="Linked",
            actor="Intelligence Engine",
            message=f"Cross-cell linking connected this complaint to {linked_count} related case(s) at {inst.name}.",
            created_at=now,
        ))
        db.commit()

    db.refresh(comp)
    return build_complaint_detail(db, comp, current_user, now)


@router.get("/complaints/{complaint_id}")
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    comp = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return build_complaint_detail(db, comp, current_user, now)


@router.patch("/complaints/{complaint_id}")
def patch_complaint(
    complaint_id: int,
    payload: PatchComplaintRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    comp = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Complaint not found")

    unit_obj = db.query(Unit).filter(Unit.id == comp.unit_id).first()
    unit_code = unit_obj.code if unit_obj else ""

    if current_user.role != "chairperson" and current_user.unit_code != unit_code:
        raise HTTPException(status_code=403, detail="Only Chairperson or the assigned unit may modify this case")

    if payload.assigned_officer_id is not None:
        off = db.query(Officer).filter(Officer.id == payload.assigned_officer_id).first()
        if not off:
            raise HTTPException(status_code=400, detail="Officer not found")
        comp.assigned_officer_id = off.id
        if comp.status == "New":
            comp.status = "Assigned"
        db.add(CaseEvent(
            complaint_id=comp.id,
            type="Assigned",
            actor=current_user.name,
            message=f"Assigned case to {off.name} ({off.title}).",
            created_at=now,
        ))

    if payload.status is not None and payload.status != comp.status:
        old_status = comp.status
        comp.status = payload.status
        if payload.status in ("Resolved", "Closed"):
            comp.resolved_at = now
        db.add(CaseEvent(
            complaint_id=comp.id,
            type="StatusChanged",
            actor=current_user.name,
            message=f"Status updated from {old_status} to {payload.status}.",
            created_at=now,
        ))

    if payload.note and payload.note.strip():
        db.add(CaseEvent(
            complaint_id=comp.id,
            type="Note",
            actor=current_user.name,
            message=payload.note.strip(),
            created_at=now,
        ))

    comp.updated_at = now
    db.commit()
    db.refresh(comp)
    return build_complaint_detail(db, comp, current_user, now)


@router.post("/complaints/{complaint_id}/escalate")
def escalate_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    comp = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Complaint not found")

    unit_obj = db.query(Unit).filter(Unit.id == comp.unit_id).first()
    unit_code = unit_obj.code if unit_obj else ""

    if current_user.role != "chairperson" and current_user.unit_code != unit_code:
        raise HTTPException(status_code=403, detail="Only Chairperson or the assigned unit may escalate this case")

    comp.status = "Escalated"
    comp.escalation_count = (comp.escalation_count or 0) + 1
    comp.updated_at = now

    inst = db.query(Institution).filter(Institution.id == comp.institution_id).first()
    inst_name = inst.name if inst else "Institution"

    db.add(CaseEvent(
        complaint_id=comp.id,
        type="Escalated",
        actor=current_user.name,
        message=f"Case escalated (level {comp.escalation_count}) for priority cross-bureau intervention.",
        created_at=now,
    ))
    db.add(Alert(
        rule="R3",
        severity="High" if comp.severity in ("High", "Critical") else "Medium",
        institution_id=comp.institution_id,
        complaint_id=comp.id,
        message=f"Case {comp.ref} ({inst_name}) escalated by {current_user.name} in {unit_code}.",
        created_at=now,
        acknowledged=False,
    ))
    db.commit()
    db.refresh(comp)
    return build_complaint_detail(db, comp, current_user, now)
