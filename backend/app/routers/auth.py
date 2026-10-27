from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Unit, Officer, Complaint
from ..schemas import LoginRequest, LoginResponse, UserInfo
from ..auth import create_session, get_current_user
from ..engine.sla import compute_sla_state
from datetime import datetime, timezone

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    if payload.role == "chairperson":
        user = UserInfo(
            name="Prof. Devendra Pratap Singh",
            role="chairperson",
            unit_code=None,
            title="Chairperson, AICTE",
        )
        token = create_session(user)
        return LoginResponse(token=token, user=user)
    elif payload.role == "unit_officer":
        if not payload.unit_code:
            raise HTTPException(status_code=400, detail="unit_code is required for unit_officer")
        unit = db.query(Unit).filter(Unit.code == payload.unit_code).first()
        if not unit:
            raise HTTPException(status_code=400, detail="Invalid unit_code")
        officer = db.query(Officer).filter(Officer.unit_id == unit.id).first()
        user = UserInfo(
            name=officer.name if officer else f"{unit.code} Desk Officer",
            role="unit_officer",
            unit_code=unit.code,
            title=f"{officer.title if officer else 'Officer'} · {unit.name}",
        )
        token = create_session(user)
        return LoginResponse(token=token, user=user)
    else:
        raise HTTPException(status_code=400, detail="Invalid role")


@router.get("/me", response_model=UserInfo)
def read_me(current_user: UserInfo = Depends(get_current_user)):
    return current_user


@router.get("/units")
def list_units(db: Session = Depends(get_db), current_user: UserInfo = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    units = db.query(Unit).all()
    officers = db.query(Officer).all()
    complaints = db.query(Complaint).all()

    result = []
    for u in units:
        u_comps = [c for c in complaints if c.unit_id == u.id]
        open_comps = [c for c in u_comps if c.status not in ("Resolved", "Closed")]
        breached_count = 0
        for c in open_comps:
            due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
            if now > due_utc:
                breached_count += 1
        u_officers = [
            {"id": o.id, "name": o.name, "title": o.title, "unit_code": u.code}
            for o in officers if o.unit_id == u.id
        ]
        result.append({
            "id": u.id,
            "code": u.code,
            "name": u.name,
            "kind": u.kind,
            "open_count": len(open_comps),
            "breached_count": breached_count,
            "officers": u_officers,
        })
    return result
