from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Alert, Institution, Complaint
from ..schemas import UserInfo
from ..auth import get_current_user

router = APIRouter()

RULE_LABELS = {
    "R1": "Risk Threshold",
    "R2": "Cross-Cell Pattern",
    "R3": "SLA Breach Risk",
    "R4": "Duplicate Cluster",
}


@router.get("/alerts")
def list_alerts(
    state: str = Query("open"),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    q = db.query(Alert)
    if state == "open":
        q = q.filter(Alert.acknowledged == False)
    elif state == "acknowledged":
        q = q.filter(Alert.acknowledged == True)

    alerts = q.order_by(Alert.created_at.desc(), Alert.id.desc()).all()
    institutions = {i.id: i.name for i in db.query(Institution).all()}
    complaints = {c.id: c.ref for c in db.query(Complaint).all()}

    return [
        {
            "id": a.id,
            "rule": a.rule,
            "rule_label": RULE_LABELS.get(a.rule, a.rule),
            "severity": a.severity,
            "institution_id": a.institution_id,
            "institution_name": institutions.get(a.institution_id) if a.institution_id else None,
            "complaint_id": a.complaint_id,
            "complaint_ref": complaints.get(a.complaint_id) if a.complaint_id else None,
            "message": a.message,
            "created_at": (a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at).isoformat(),
            "acknowledged": a.acknowledged,
            "acknowledged_by": a.acknowledged_by,
        }
        for a in alerts
    ]


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
):
    if current_user.role != "chairperson":
        raise HTTPException(status_code=403, detail="Only the Chairperson can acknowledge alerts")

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = current_user.name
    db.commit()
    db.refresh(alert)
    return {
        "id": alert.id,
        "acknowledged": alert.acknowledged,
        "acknowledged_by": alert.acknowledged_by,
    }
