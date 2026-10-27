from typing import Tuple, List, Dict

CATEGORY_ROUTING: List[Tuple[str, str, List[str]]] = [
    (
        "Fee and Refund",
        "SGC",
        [
            "fee", "fees", "refund", "deposit", "tuition", "overcharged",
            "receipt", "scholarship money", "caution money", "withdrawing admission",
            "fee refund", "extra charges", "hidden charges", "refund delay"
        ],
    ),
    (
        "Student Harassment and Welfare",
        "SGC",
        [
            "harassment", "ragging", "bullying", "abuse", "hostel warden",
            "mental", "discrimination", "unsafe for girls", "hostel curfew",
            "intimidation", "counseling", "welfare"
        ],
    ),
    (
        "Document and Certificate Issues",
        "SGC",
        [
            "marksheet", "certificate", "transcript", "original documents",
            "withheld", "degree", "migration", "bonafide", "transfer certificate",
            "provisional certificate", "character certificate"
        ],
    ),
    (
        "Admissions and Affiliation",
        "AB",
        [
            "admission", "seats", "intake", "affiliation", "approval",
            "counselling", "quota", "capacity", "unapproved course",
            "excess intake", "management quota", "extension of approval"
        ],
    ),
    (
        "Infrastructure and Safety",
        "AB",
        [
            "laboratory", "lab", "fire", "building", "classroom", "library",
            "hostel", "electrical", "collapse", "sanitation", "electrical hazard",
            "drinking water", "ventilation", "fire extinguisher", "structural"
        ],
    ),
    (
        "Faculty and Staffing",
        "ACB",
        [
            "faculty", "teachers", "professor", "vacancies", "ghost faculty",
            "qualification", "salary unpaid", "staff", "unpaid salary",
            "student faculty ratio", "hod", "visiting lecturer", "pay scale"
        ],
    ),
    (
        "Academic Quality and Exams",
        "ACB",
        [
            "syllabus", "exam", "results", "attendance", "curriculum",
            "evaluation", "timetable", "revaluation", "internal marks",
            "academic calendar", "practical classes", "lab sessions"
        ],
    ),
    (
        "Placement and Misrepresentation",
        "VC",
        [
            "placement", "package", "false claim", "misleading", "advertisement",
            "fake ranking", "recruiters", "brochure", "100% placement",
            "inflated salary", "fake offer letter"
        ],
    ),
]

CATEGORY_TO_UNIT: Dict[str, str] = {cat: unit for cat, unit, _ in CATEGORY_ROUTING}


def classify_complaint(title: str, description: str) -> Tuple[str, str, float]:
    text = f"{title} {description}".lower()
    best_cat = "Academic Quality and Exams"
    best_unit = "ACB"
    best_score = 0

    for category, unit_code, keywords in CATEGORY_ROUTING:
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_cat = category
            best_unit = unit_code

    if best_score == 0:
        return "Academic Quality and Exams", "ACB", 0.30

    confidence = min(0.95, round(0.45 + 0.15 * best_score, 2))
    return best_cat, best_unit, confidence
