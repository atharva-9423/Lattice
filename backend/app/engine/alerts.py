from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from ..models import Alert, Institution, Complaint, CaseLink, Unit


def evaluate_alerts(db: Session, now: datetime, inst_scores: dict, case_sla_map: dict):
    """
    Evaluates alert rules R1-R4 and inserts de-duplicated unacknowledged alerts.
    """
    existing_open = db.query(Alert).filter(Alert.acknowledged == False).all()
    open_keys = set()
    for a in existing_open:
        open_keys.add((a.rule, a.institution_id, a.complaint_id))

    institutions = {i.id: i for i in db.query(Institution).all()}
    units = {u.id: u.code for u in db.query(Unit).all()}
    complaints = db.query(Complaint).all()

    # Group complaints by institution
    by_inst = {}
    for c in complaints:
        by_inst.setdefault(c.institution_id, []).append(c)

    # R1: Risk threshold (score >= 60)
    for inst_id, risk_data in inst_scores.items():
        score = risk_data["score"]
        if score >= 60:
            key = ("R1", inst_id, None)
            if key not in open_keys:
                inst = institutions.get(inst_id)
                if inst:
                    sev = "Critical" if score >= 80 else "High"
                    recent_30 = [
                        c for c in by_inst.get(inst_id, [])
                        if (now - c.created_at.replace(tzinfo=timezone.utc)).days <= 30
                    ]
                    u_count = len(set(units.get(c.unit_id, "") for c in recent_30))
                    msg = f"{inst.name}: Risk score reached {score} ({risk_data['band']} band) with {len(recent_30)} complaints across {max(1, u_count)} units in 30 days."
                    db.add(Alert(
                        rule="R1",
                        severity=sev,
                        institution_id=inst_id,
                        complaint_id=None,
                        message=msg,
                        created_at=now,
                        acknowledged=False,
                    ))
                    open_keys.add(key)

    # R2: Cross-cell pattern (3+ complaints in 30 days across 2+ units)
    for inst_id, c_list in by_inst.items():
        recent_30 = [
            c for c in c_list
            if (now - c.created_at.replace(tzinfo=timezone.utc)).days <= 30
        ]
        distinct_u = set(units.get(c.unit_id, "") for c in recent_30)
        if len(recent_30) >= 3 and len(distinct_u) >= 2:
            key = ("R2", inst_id, None)
            if key not in open_keys:
                inst = institutions.get(inst_id)
                score = inst_scores.get(inst_id, {}).get("score", 0)
                if inst:
                    msg = f"{inst.name}: {len(recent_30)} complaints across {len(distinct_u)} units in 30 days. Risk score {score}."
                    db.add(Alert(
                        rule="R2",
                        severity="High",
                        institution_id=inst_id,
                        complaint_id=None,
                        message=msg,
                        created_at=now,
                        acknowledged=False,
                    ))
                    open_keys.add(key)

    # R3: SLA breach or p >= 0.8
    for c in complaints:
        if c.status in ("Resolved", "Closed"):
            continue
        sla_info = case_sla_map.get(c.id)
        if not sla_info:
            continue
        sla_state, prob, _ = sla_info
        if sla_state == "breached" or prob >= 0.80:
            key = ("R3", c.institution_id, c.id)
            if key not in open_keys:
                inst = institutions.get(c.institution_id)
                inst_name = inst.name if inst else "Institution"
                sev = "High" if c.severity == "Critical" else "Medium"
                status_phrase = "breached its SLA deadline" if sla_state == "breached" else f"has a {int(prob * 100)}% breach probability"
                msg = f"Case {c.ref} ({inst_name}) {status_phrase} in {units.get(c.unit_id, 'Unit')}."
                db.add(Alert(
                    rule="R3",
                    severity=sev,
                    institution_id=c.institution_id,
                    complaint_id=c.id,
                    message=msg,
                    created_at=now,
                    acknowledged=False,
                ))
                open_keys.add(key)

    # R4: Duplicate cluster
    dup_links = db.query(CaseLink).filter(CaseLink.type == "Duplicate").all()
    comp_map = {c.id: c for c in complaints}
    for link in dup_links:
        key = ("R4", link.institution_id, link.b_id)
        if key not in open_keys:
            ca = comp_map.get(link.a_id)
            cb = comp_map.get(link.b_id)
            inst = institutions.get(link.institution_id)
            if ca and cb and inst:
                msg = f"Duplicate cluster detected at {inst.name}: {cb.ref} matches {ca.ref} ({int(link.similarity * 100)}% similarity)."
                db.add(Alert(
                    rule="R4",
                    severity="Low",
                    institution_id=link.institution_id,
                    complaint_id=link.b_id,
                    message=msg,
                    created_at=now,
                    acknowledged=False,
                ))
                open_keys.add(key)

    db.commit()
