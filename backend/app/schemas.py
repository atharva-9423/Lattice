from typing import List, Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    role: str
    unit_code: Optional[str] = None


class UserInfo(BaseModel):
    name: str
    role: str
    unit_code: Optional[str] = None
    title: str


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


class AnalyzeRequest(BaseModel):
    institution_id: int
    title: str
    description: str


class CreateComplaintRequest(BaseModel):
    institution_id: int
    title: str
    description: str
    complainant_type: str
    category: Optional[str] = None
    severity: Optional[str] = None


class PatchComplaintRequest(BaseModel):
    status: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    note: Optional[str] = None
