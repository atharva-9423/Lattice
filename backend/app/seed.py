import sys
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from .db import SessionLocal, engine, Base
from .models import Unit, Officer, Institution, Complaint, CaseEvent, CaseLink, Alert
from .engine.classify import classify_complaint, CATEGORY_TO_UNIT
from .engine.severity import detect_severity
from .engine.linking import compute_institution_links
from .engine.risk import compute_institution_risk
from .engine.sla import compute_due_at, compute_sla_state
from .engine.alerts import evaluate_alerts

UNITS_DATA = [
    ("AB", "Approval Bureau", "Bureau"),
    ("ACB", "Academic Bureau", "Bureau"),
    ("SGC", "Student Grievance Cell", "Cell"),
    ("VC", "Vigilance Cell", "Cell"),
]

OFFICERS_DATA = [
    ("Dr. Rajeshwar Rao", "AB", "Deputy Director"),
    ("Meenakshi Sundaram", "AB", "Assistant Director"),
    ("Prof. Arvind Kulkarni", "ACB", "Deputy Director"),
    ("Dr. Sunita Deshmukh", "ACB", "Assistant Director"),
    ("Vikramaditya Sen", "SGC", "Grievance Officer"),
    ("Kavita Nair", "SGC", "Assistant Director"),
    ("Suresh Chandra Bose", "VC", "Chief Vigilance Officer"),
    ("Ananya Chatterjee", "VC", "Vigilance Investigation Officer"),
]

INSTITUTIONS_SEED = [
    ("Meridian Institute of Technology", "Pune", "Maharashtra", "Engineering", 1998, 1200),
    ("Harbourlight College of Pharmacy", "Kochi", "Kerala", "Pharmacy", 2005, 420),
    ("Saffron Valley College of Engineering", "Jaipur", "Rajasthan", "Engineering", 2001, 960),
    ("Northgate School of Management", "Bengaluru", "Karnataka", "Management", 2008, 360),
    ("Crestview Institute of Technology", "Hyderabad", "Telangana", "Engineering", 1995, 1440),
    ("Vanguard College of Architecture", "Ahmedabad", "Gujarat", "Architecture", 2010, 240),
    ("Silverline Polytechnic Institute", "Coimbatore", "Tamil Nadu", "Polytechnic", 1992, 780),
    ("Deccan Ridge Institute of Engineering", "Nagpur", "Maharashtra", "Engineering", 2003, 900),
    ("Eastern Horizon School of Management", "Bhubaneswar", "Odisha", "Management", 2011, 300),
    ("Coromandel Institute of Technology", "Chennai", "Tamil Nadu", "Engineering", 1997, 1320),
    ("Aravalli College of Pharmacy", "Udaipur", "Rajasthan", "Pharmacy", 2009, 360),
    ("Narmada Valley Polytechnic", "Indore", "Madhya Pradesh", "Polytechnic", 2004, 600),
    ("Bluepine Institute of Management", "Dehradun", "Uttarakhand", "Management", 2012, 240),
    ("Riverstone College of Engineering", "Lucknow", "Uttar Pradesh", "Engineering", 2000, 1080),
    ("Westcoast Institute of Architecture", "Mangaluru", "Karnataka", "Architecture", 2007, 180),
    ("Ganges Plain Polytechnic", "Varanasi", "Uttar Pradesh", "Polytechnic", 1996, 720),
    ("Solstice Institute of Technology", "Chandigarh", "Punjab", "Engineering", 2002, 840),
    ("Malabar Crest College of Pharmacy", "Kozhikode", "Kerala", "Pharmacy", 2006, 300),
    ("Vindhya Institute of Engineering", "Bhopal", "Madhya Pradesh", "Engineering", 1999, 960),
    ("Kaveri Delta College of Technology", "Tiruchirappalli", "Tamil Nadu", "Engineering", 2001, 1140),
    ("Redwood School of Business", "Gurugram", "Haryana", "Management", 2013, 420),
    ("Satpura Polytechnic College", "Raipur", "Chhattisgarh", "Polytechnic", 2005, 540),
    ("Konkan Coastal Institute of Pharmacy", "Panaji", "Goa", "Pharmacy", 2014, 240),
    ("Brahmaputra Valley Engineering College", "Guwahati", "Assam", "Engineering", 2003, 660),
    ("Nilgiri Hills Institute of Technology", "Mysuru", "Karnataka", "Engineering", 1994, 1020),
    ("Shivalik School of Architecture", "Shimla", "Himachal Pradesh", "Architecture", 2015, 160),
    ("Chota Nagpur Polytechnic", "Ranchi", "Jharkhand", "Polytechnic", 2002, 600),
    ("Godavari Basin College of Engineering", "Visakhapatnam", "Andhra Pradesh", "Engineering", 1998, 1200),
    ("Thar Desert Institute of Management", "Jodhpur", "Rajasthan", "Management", 2009, 300),
    ("Sundarbans College of Pharmacy", "Kolkata", "West Bengal", "Pharmacy", 2004, 480),
    ("Sahyadri Crown Institute of Technology", "Nashik", "Maharashtra", "Engineering", 2006, 840),
    ("Magadh Central Polytechnic", "Patna", "Bihar", "Polytechnic", 2000, 660),
    ("Doaba Institute of Engineering", "Jalandhar", "Punjab", "Engineering", 2001, 900),
    ("Bundelkhand School of Management", "Gwalior", "Madhya Pradesh", "Management", 2011, 240),
    ("backwater View College of Architecture", "Thiruvananthapuram", "Kerala", "Architecture", 2012, 180),
    ("tapti Valley College of Pharmacy", "Surat", "Gujarat", "Pharmacy", 2007, 360),
    ("Mahanadi Institute of Technology", "Cuttack", "Odisha", "Engineering", 1999, 960),
    ("rayalaseema Polytechnic Institute", "Tirupati", "Andhra Pradesh", "Polytechnic", 2008, 540),
    ("Marwar College of Engineering", "Ajmer", "Rajasthan", "Engineering", 2003, 780),
    ("Peninsular School of Management", "Madurai", "Tamil Nadu", "Management", 2010, 300),
]

TEMPLATES = {
    "Fee and Refund": [
        (
            "Tuition fee refund not returned after withdrawing admission",
            "I withdrew my admission within the AICTE stipulated counselling window, yet the accounts office has withheld my tuition fee refund and original receipt for over six weeks despite three written reminders.",
        ),
        (
            "Security deposit and tuition refund delayed after seat cancellation",
            "After cancelling my seat before the semester started, the college promised to process my tuition fee refund and caution deposit within fifteen days, but no refund has been received.",
        ),
        (
            "Students overcharged above approved tuition fee structure",
            "The administration is collecting mandatory development and laboratory fees far above the state fee regulatory committee ceiling without issuing an official receipt.",
        ),
        (
            "Scholarship money and tuition deposit withheld by accounts section",
            "State scholarship money credited to the institution has not been adjusted against our semester fee, and students are being threatened with exam debarment.",
        ),
    ],
    "Student Harassment and Welfare": [
        (
            "Severe ragging and intimidation reported in senior boys hostel block",
            "First-year engineering students are subjected to late-night ragging and verbal abuse by seniors in Hostel Block C while the hostel warden ignores written complaints.",
        ),
        (
            "Mental harassment and discriminatory rules by hostel warden",
            "Students raising grievances about mess hygiene face targeted mental harassment, arbitrary fines, and intimidation from the chief hostel warden.",
        ),
        (
            "Campus environment unsafe for girls due to broken perimeter lighting",
            "Pathways between the central library and the women hostel have no lighting or security guards after 7 PM, making the campus unsafe for girls.",
        ),
        (
            "Bullying and retaliatory grading against grievance petitioners",
            "Students who signed a petition regarding hostel welfare were threatened with low internal evaluation marks and disciplinary bullying.",
        ),
    ],
    "Document and Certificate Issues": [
        (
            "Original documents and degree marksheet withheld by registrar",
            "The registrar office has withheld my original 10th and 12th marksheet and transfer certificate, demanding full four-year fees before releasing my documents.",
        ),
        (
            "Provisional degree certificate and transcript delayed by four months",
            "Graduating batch students have not received their provisional degree certificate or official transcript, causing multiple students to lose postgraduate admission offers.",
        ),
        (
            "Migration certificate withheld despite clearing all library and hostel dues",
            "Even after submitting the signed no-dues form, the student section refuses to issue the migration certificate and original documents.",
        ),
        (
            "Delay in issuing bonafide certificate for education loan renewal",
            "The administrative cell has delayed issuing bonafide and fee structure certificates for over five weeks, stalling bank education loan disbursements.",
        ),
    ],
    "Admissions and Affiliation": [
        (
            "Admission granted in excess of AICTE approved intake capacity",
            "The institution admitted 45 extra students in the Computer Science branch beyond the sanctioned AICTE intake quota without extension of approval.",
        ),
        (
            "Irregular management quota seats filled without merit counselling",
            "Seats reserved for state counselling were converted into management quota seats with undisclosed capitation charges before the final counselling round.",
        ),
        (
            "Course running without valid AICTE affiliation and approval renewal",
            "A new specialization track in Artificial Intelligence is admitting students even though the extension of approval letter does not list this programme.",
        ),
        (
            "Misleading seat capacity declared during state admission counselling",
            "The college reported full laboratory readiness to secure higher seat intake approval while lacking basic instructional space for admitted batches.",
        ),
    ],
    "Infrastructure and Safety": [
        (
            "Critical electrical hazard and exposed wiring in high-voltage machine lab",
            "The electrical machines laboratory has exposed live distribution panels, water seepage near switchgear, and missing circuit breakers, creating a severe electrical hazard and fire risk.",
        ),
        (
            "Fire safety equipment expired and emergency exits locked in academic block",
            "Fire extinguishers across the four-storey laboratory building expired two years ago and the secondary staircase is permanently padlocked.",
        ),
        (
            "Severe sanitation failure and unsafe drinking water in student hostel",
            "Water purifiers in the main academic building and hostel have been non-functional for a month, and sanitation conditions in washrooms are hazardous.",
        ),
        (
            "Structural cracks and ceiling plaster collapse in third-floor classroom",
            "Large portions of ceiling plaster collapsed during a lecture in Room 304; the building wing shows visible structural dampness and unsafe wiring.",
        ),
    ],
    "Faculty and Staffing": [
        (
            "Severe faculty vacancies and no faculty for core third-year subjects",
            "More than half of the sanctioned associate professor posts are vacant, leaving third-year engineering batches with no faculty for three core subjects this semester.",
        ),
        (
            "Faculty salary unpaid for four consecutive months across departments",
            "Regular teaching faculty and laboratory staff have had their salary unpaid since the start of the semester, leading to mass resignations and halted classes.",
        ),
        (
            "Ghost faculty listed on muster rolls for AICTE inspection compliance",
            "Several professors listed on the institutional website and compliance portal are ghost faculty who never teach classes on campus.",
        ),
        (
            "Unqualified visiting staff assigned to teach final-year laboratory courses",
            "Due to severe faculty shortage and vacancies, newly graduated teaching assistants without postgraduate qualification are running advanced courses.",
        ),
    ],
    "Academic Quality and Exams": [
        (
            "Core syllabus left incomplete before end-semester university exam",
            "Less than forty percent of the prescribed curriculum was covered in lectures before the examination timetable was announced.",
        ),
        (
            "Arbitrary internal attendance mismatch and delayed exam results",
            "Published attendance records contain widespread mismatch errors and internal evaluation results have been delayed without explanation.",
        ),
        (
            "Practical laboratory sessions cancelled throughout the academic timetable",
            "Scheduled laboratory sessions on the timetable were repeatedly cancelled due to broken equipment, affecting practical evaluation.",
        ),
        (
            "Delay in revaluation results for backlog examination papers",
            "Students who applied for exam answer-script revaluation two months ago have still not received updated results.",
        ),
    ],
    "Placement and Misrepresentation": [
        (
            "Misleading advertisement claiming 100% placement and fake ranking",
            "The college published full-page newspaper advertisements with a fake ranking and false claim of 100% placement with inflated international salary packages.",
        ),
        (
            "Fake offer letters distributed from shell recruiters during placement drive",
            "Students were handed placement offer letters from non-existent recruiters that demanded training security deposits and never onboarded graduates.",
        ),
        (
            "Brochure misrepresents tie-ups with global technology recruiters",
            "The admission brochure makes a misleading claim of guaranteed corporate internships and false package statistics to attract applicants.",
        ),
        (
            "Placement cell collecting mandatory registration fee for fake drives",
            "Final-year students were forced to pay non-refundable placement registration charges for campus drives that turned out to be sales workshops.",
        ),
    ],
}

COMPLAINANT_TYPES = ["Student", "Parent", "Faculty", "Staff", "Anonymous"]


def recompute_all_intelligence(db: Session, now: datetime):
    units = {u.id: u.code for u in db.query(Unit).all()}
    institutions = db.query(Institution).all()

    db.query(CaseLink).delete()
    db.flush()

    inst_scores = {}
    case_sla_map = {}

    all_complaints = db.query(Complaint).all()
    open_by_unit = {}
    for c in all_complaints:
        if c.status not in ("Resolved", "Closed"):
            open_by_unit[c.unit_id] = open_by_unit.get(c.unit_id, 0) + 1

    for c in all_complaints:
        created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
        due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
        u_open = open_by_unit.get(c.unit_id, 0)
        sla_state, prob, elapsed = compute_sla_state(created_utc, due_utc, c.status, u_open, now)
        case_sla_map[c.id] = (sla_state, prob, elapsed)

    by_inst = {}
    for c in all_complaints:
        by_inst.setdefault(c.institution_id, []).append(c)

    for inst in institutions:
        c_list = by_inst.get(inst.id, [])
        c_dicts = []
        for c in c_list:
            created_utc = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
            due_utc = c.due_at.replace(tzinfo=timezone.utc) if c.due_at.tzinfo is None else c.due_at
            res_utc = (c.resolved_at.replace(tzinfo=timezone.utc) if c.resolved_at.tzinfo is None else c.resolved_at) if c.resolved_at else None
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

        links, cluster_map = compute_institution_links(c_dicts)
        for link in links:
            db.add(CaseLink(
                institution_id=inst.id,
                a_id=link["a_id"],
                b_id=link["b_id"],
                type=link["type"],
                similarity=link["similarity"],
            ))

        cluster_counts = {}
        for cid, cl_id in cluster_map.items():
            cluster_counts[cl_id] = cluster_counts.get(cl_id, 0) + 1

        cluster_sizes_by_cid = {}
        for c in c_list:
            cl_id = cluster_map.get(c.id, c.id)
            c.cluster_id = cl_id
            cluster_sizes_by_cid[c.id] = cluster_counts.get(cl_id, 1)

        risk_data = compute_institution_risk(c_dicts, cluster_sizes_by_cid, now)
        inst_scores[inst.id] = risk_data

    db.commit()
    evaluate_alerts(db, now, inst_scores, case_sla_map)
    return inst_scores, case_sla_map


def seed_database(db: Session, reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    if db.query(Unit).count() > 0:
        return

    rng = random.Random(26264)
    now = datetime.now(timezone.utc)

    unit_objs = {}
    for code, name, kind in UNITS_DATA:
        u = Unit(code=code, name=name, kind=kind)
        db.add(u)
        db.flush()
        unit_objs[code] = u

    officers_by_unit = {code: [] for code, _, _ in UNITS_DATA}
    for name, ucode, title in OFFICERS_DATA:
        off = Officer(name=name, unit_id=unit_objs[ucode].id, title=title)
        db.add(off)
        db.flush()
        officers_by_unit[ucode].append(off)

    inst_objs = []
    for name, city, state, itype, year, intake in INSTITUTIONS_SEED:
        clean_name = name[0].upper() + name[1:]
        inst = Institution(
            name=clean_name,
            city=city,
            state=state,
            type=itype,
            established_year=year,
            intake=intake,
        )
        db.add(inst)
        db.flush()
        inst_objs.append(inst)

    seq = 1

    def add_complaint_record(
        inst_obj: Institution,
        title: str,
        description: str,
        category: str,
        severity: str,
        status: str,
        unit_code: str,
        days_ago: float,
        complainant_type: str,
        force_breached: bool = False,
        escalation_count: int = 0,
        confidence: float = 0.85,
    ):
        nonlocal seq
        created_at = now - timedelta(days=days_ago)
        due_at = compute_due_at(created_at, severity)
        if force_breached and now <= due_at:
            created_at = now - timedelta(days=(due_at - created_at).days + 2)
            due_at = compute_due_at(created_at, severity)

        resolved_at = None
        if status in ("Resolved", "Closed"):
            res_days = min(days_ago * 0.7, 9.0)
            resolved_at = created_at + timedelta(days=max(0.5, res_days))
        updated_at = resolved_at if resolved_at else (created_at + timedelta(hours=6))

        u_obj = unit_objs[unit_code]
        assigned_off = None
        if status != "New":
            assigned_off = rng.choice(officers_by_unit[unit_code])

        ref = f"AICTE-2026-{seq:05d}"
        seq += 1

        comp = Complaint(
            ref=ref,
            institution_id=inst_obj.id,
            title=title,
            description=description,
            category=category,
            severity=severity,
            status=status,
            unit_id=u_obj.id,
            assigned_officer_id=assigned_off.id if assigned_off else None,
            complainant_type=complainant_type,
            created_at=created_at,
            updated_at=updated_at,
            due_at=due_at,
            resolved_at=resolved_at,
            escalation_count=escalation_count,
            auto_confidence=confidence,
        )
        db.add(comp)
        db.flush()

        db.add(CaseEvent(
            complaint_id=comp.id,
            type="Created",
            actor=f"{complainant_type} Portal",
            message=f"Complaint filed by {complainant_type.lower()} regarding {category.lower()}.",
            created_at=created_at,
        ))
        db.add(CaseEvent(
            complaint_id=comp.id,
            type="Routed",
            actor="Intelligence Engine",
            message=f"Auto-classified under {category} ({int(confidence * 100)}% confidence) and routed to {u_obj.name} ({unit_code}).",
            created_at=created_at + timedelta(minutes=2),
        ))
        if assigned_off:
            db.add(CaseEvent(
                complaint_id=comp.id,
                type="Assigned",
                actor="Unit Desk",
                message=f"Assigned to {assigned_off.name}, {assigned_off.title}.",
                created_at=created_at + timedelta(hours=2),
            ))
        if escalation_count > 0 or status == "Escalated":
            db.add(CaseEvent(
                complaint_id=comp.id,
                type="Escalated",
                actor="Chairperson Office",
                message="Case escalated due to cross-unit risk pattern and impending SLA threshold.",
                created_at=created_at + timedelta(days=1),
            ))
        if status in ("Resolved", "Closed") and resolved_at:
            db.add(CaseEvent(
                complaint_id=comp.id,
                type="StatusChanged",
                actor=assigned_off.name if assigned_off else "Unit Officer",
                message=f"Compliance verified and case marked {status}.",
                created_at=resolved_at,
            ))
        return comp

    # 1. Planted demo storyline: Meridian Institute of Technology (id=1)
    # 6 complaints in the last 26 days across SGC, ACB, AB, and VC, plus 4 earlier complaints in the 90d window
    # calibrated so Meridian's score is 79 (in [78, 88]) and filing a new refund complaint jumps it into Critical (82+)
    meridian = inst_objs[0]
    meridian_cases = [
        # Two near-identical refund complaints (Fee and Refund, SGC) in last 26 days
        (
            "Tuition fee refund not returned after withdrawing admission",
            "I withdrew my admission within the AICTE counselling window at Meridian Institute of Technology, yet the accounts office has withheld my tuition fee refund and original receipt for weeks.",
            "Fee and Refund", "High", "In Review", "SGC", 19.0, "Student", True, 0, 0.90
        ),
        (
            "Tuition fee refund withheld after admission withdrawal",
            "After withdrawing my admission within the AICTE stipulated window at Meridian Institute of Technology, the accounts office has not returned my tuition fee refund and original receipt.",
            "Fee and Refund", "High", "Assigned", "SGC", 14.0, "Parent", True, 0, 0.90
        ),
        # Faculty vacancies complaint and unpaid-salary complaint (ACB) in last 26 days
        (
            "Severe faculty vacancies and unpaid salary in core engineering departments",
            "More than half of sanctioned professor posts have faculty vacancies and regular teaching staff have had salary unpaid for months, halting core classes.",
            "Faculty and Staffing", "High", "Escalated", "ACB", 22.0, "Faculty", True, 1, 0.90
        ),
        (
            "Faculty salary unpaid and unfilled teaching vacancies across semester",
            "Regular teaching faculty and staff have had salary unpaid for consecutive months alongside severe faculty vacancies in core engineering courses.",
            "Faculty and Staffing", "High", "Awaiting Institution", "ACB", 12.0, "Faculty", True, 0, 0.90
        ),
        # Lab electrical hazard complaint (Critical, AB) in last 26 days
        (
            "Critical electrical hazard and exposed high-voltage wiring in power laboratory",
            "The electrical machines laboratory has exposed live switchgear, water seepage, and fire hazard conditions creating an immediate electrical hazard for students.",
            "Infrastructure and Safety", "Critical", "Escalated", "AB", 9.0, "Student", True, 1, 0.95
        ),
        # Misleading placement claim (VC) in last 26 days
        (
            "Misleading placement advertisement claiming 100% placement and fake packages",
            "The institute published a misleading advertisement with false claim of 100% placement and fake ranking statistics to attract admission applicants.",
            "Placement and Misrepresentation", "High", "In Review", "VC", 10.0, "Student", True, 0, 0.88
        ),
        # 5 earlier complaints in the 35-78 day window so volume V=11/12 and score lands in 78-88
        (
            "Admission seats filled beyond approved intake capacity without approval",
            "The institution admitted extra students above sanctioned intake capacity in mechanical and computer branches without AICTE approval.",
            "Admissions and Affiliation", "High", "Resolved", "AB", 48.0, "Staff", False, 0, 0.85
        ),
        (
            "Original degree certificate and marksheet withheld for extra fee refund dispute",
            "Student original documents and marksheet were withheld when questioning tuition fee refund deductions after withdrawing admission.",
            "Document and Certificate Issues", "High", "Resolved", "SGC", 55.0, "Student", False, 0, 0.85
        ),
        (
            "Fire safety extinguishers expired in main laboratory and classroom wing",
            "Fire safety equipment in the electrical laboratory and main building has expired, posing a fire and electrical hazard.",
            "Infrastructure and Safety", "Critical", "Resolved", "AB", 64.0, "Faculty", False, 0, 0.92
        ),
        (
            "Fake recruiters and misleading package claims in placement brochure",
            "The placement brochure listed misleading advertisement claims and fake ranking figures with inflated salary packages.",
            "Placement and Misrepresentation", "Critical", "Resolved", "VC", 72.0, "Parent", False, 0, 0.90
        ),
        (
            "Unapproved intake seats and affiliation irregularities in mechanical branch",
            "Extra students were admitted above sanctioned intake capacity without AICTE approval renewal.",
            "Admissions and Affiliation", "Critical", "Resolved", "AB", 78.0, "Student", False, 0, 0.88
        ),
    ]
    for mc in meridian_cases:
        add_complaint_record(meridian, *mc)

    # 2. Harbourlight College of Pharmacy (id=2) -> Watch band (35-59)
    harbourlight = inst_objs[1]
    harbour_cases = [
        (
            "Tuition fee refund delayed after seat cancellation",
            "After cancelling my pharmacy seat before classes commenced, my tuition fee refund and deposit have been delayed by the accounts section.",
            "Fee and Refund", "Medium", "In Review", "SGC", 18.0, "Student", True, 0, 0.85
        ),
        (
            "Fee refund and caution deposit delayed for withdrawn students",
            "Students who withdrew before the deadline have experienced a prolonged delay in receiving their tuition fee refund and caution deposit.",
            "Fee and Refund", "Medium", "Assigned", "SGC", 11.0, "Parent", False, 0, 0.85
        ),
        (
            "Laboratory ventilation and chemical storage safety shortage",
            "The pharmaceutical chemistry laboratory has broken fume hoods and poor ventilation during practical lab sessions.",
            "Infrastructure and Safety", "High", "In Review", "AB", 24.0, "Student", True, 0, 0.82
        ),
        (
            "Delay in issuing provisional certificate and transcript",
            "Final year B.Pharm graduates are facing a delay in receiving their provisional certificate and official transcript.",
            "Document and Certificate Issues", "Medium", "Resolved", "SGC", 42.0, "Student", False, 0, 0.80
        ),
        (
            "Faculty vacancies in pharmacology department",
            "Two senior pharmacology professor positions remain vacant this semester, affecting scheduled lectures.",
            "Faculty and Staffing", "High", "Resolved", "ACB", 58.0, "Faculty", False, 0, 0.85
        ),
    ]
    for hc in harbour_cases:
        add_complaint_record(harbourlight, *hc)

    # 3. Three more High/Critical institutions (indices 2, 3, 4)
    high_insts = [inst_objs[2], inst_objs[3], inst_objs[4]]
    categories_list = list(TEMPLATES.keys())
    for idx, h_inst in enumerate(high_insts):
        for k in range(10):
            cat = categories_list[(idx * 3 + k) % len(categories_list)]
            ucode = CATEGORY_TO_UNIT[cat]
            tpl = TEMPLATES[cat][k % 2]
            sev = "Critical" if k < 3 else ("High" if k < 8 else "Medium")
            status = "In Review" if k < 4 else ("Assigned" if k < 6 else "Resolved")
            days = 5.0 + k * 6.5
            breached = k in (0, 1, 2, 3)
            add_complaint_record(
                h_inst,
                tpl[0],
                tpl[1],
                cat,
                sev,
                status,
                ucode,
                days,
                rng.choice(COMPLAINANT_TYPES),
                force_breached=breached,
                escalation_count=1 if k == 0 else 0,
                confidence=0.85,
            )

    # 4. Seven more Watch band institutions (indices 5..11)
    for idx in range(5, 12):
        w_inst = inst_objs[idx]
        count = 6 + (idx % 2)
        for k in range(count):
            cat = categories_list[(idx + k) % len(categories_list)]
            ucode = CATEGORY_TO_UNIT[cat]
            tpl = TEMPLATES[cat][k % 2]
            sev = "High" if k < 3 else "Medium"
            status = "Assigned" if k < 3 else "Resolved"
            days = 8.0 + k * 10.0
            breached = k == 0
            add_complaint_record(
                w_inst,
                tpl[0],
                tpl[1],
                cat,
                sev,
                status,
                ucode,
                days,
                rng.choice(COMPLAINANT_TYPES),
                force_breached=breached,
                confidence=0.78,
            )

    # 5. Remaining 28 institutions (indices 12..39) -> Low band, totaling ~320 complaints over 120 days
    open_statuses = ["New", "Assigned", "In Review", "Awaiting Institution", "Escalated"]
    closed_statuses = ["Resolved", "Closed"]

    for idx in range(12, len(inst_objs)):
        l_inst = inst_objs[idx]
        # Distribute complaints so total lands around 320
        count = 8 if idx < 28 else 7
        for k in range(count):
            cat = categories_list[(idx * 2 + k) % len(categories_list)]
            ucode = CATEGORY_TO_UNIT[cat]
            tpl = TEMPLATES[cat][(idx + k) % len(TEMPLATES[cat])]
            # Spread most outside recent high-severity clusters so band stays Low (<35)
            days = 10.0 + ((idx * 13 + k * 19) % 108)
            sev = "Low" if k % 3 != 0 else "Medium"
            is_open = (k % 2 == 0) and (days < 75)
            status = open_statuses[(idx + k) % len(open_statuses)] if is_open else closed_statuses[k % 2]
            add_complaint_record(
                l_inst,
                tpl[0],
                tpl[1],
                cat,
                sev,
                status,
                ucode,
                days,
                rng.choice(COMPLAINANT_TYPES),
                force_breached=False,
                confidence=0.75,
            )

    db.commit()
    recompute_all_intelligence(db, now)


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_database(session, reset=reset_flag)
        print("Database seeded successfully.")
    finally:
        session.close()
