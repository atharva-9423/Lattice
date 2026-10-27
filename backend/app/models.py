from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .db import Base


class Unit(Base):
    __tablename__ = "units"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(16), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    kind = Column(String(32), nullable=False)


class Officer(Base):
    __tablename__ = "officers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    title = Column(String(128), nullable=False)

    unit = relationship("Unit")


class Institution(Base):
    __tablename__ = "institutions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False, index=True)
    city = Column(String(128), nullable=False)
    state = Column(String(128), nullable=False)
    type = Column(String(64), nullable=False)
    established_year = Column(Integer, nullable=False)
    intake = Column(Integer, nullable=False)


class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    ref = Column(String(32), unique=True, nullable=False, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(128), nullable=False, index=True)
    severity = Column(String(32), nullable=False, index=True)
    status = Column(String(64), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False, index=True)
    assigned_officer_id = Column(Integer, ForeignKey("officers.id"), nullable=True)
    complainant_type = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    escalation_count = Column(Integer, nullable=False, default=0)
    auto_confidence = Column(Float, nullable=False, default=0.5)
    cluster_id = Column(Integer, nullable=True)

    institution = relationship("Institution")
    unit = relationship("Unit")
    assigned_officer = relationship("Officer")


class CaseEvent(Base):
    __tablename__ = "case_events"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    type = Column(String(64), nullable=False)
    actor = Column(String(128), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)


class CaseLink(Base):
    __tablename__ = "case_links"
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    a_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    b_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    type = Column(String(32), nullable=False)
    similarity = Column(Float, nullable=False)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    rule = Column(String(16), nullable=False, index=True)
    severity = Column(String(32), nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged = Column(Boolean, nullable=False, default=False)
    acknowledged_by = Column(String(128), nullable=True)
