from typing import Optional

CRITICAL_KEYWORDS = [
    "fire", "collapse", "death", "died", "suicide", "fraud",
    "forged", "fake", "assault", "harassment", "ragging", "electrical hazard"
]

HIGH_KEYWORDS = [
    "withheld", "unpaid", "no faculty", "illegal", "threat",
    "shut", "closed without", "vacancies", "ghost faculty"
]

MEDIUM_KEYWORDS = [
    "delay", "not received", "refund", "mismatch", "shortage", "overcharged"
]


def detect_severity(title: str, description: str, override: Optional[str] = None) -> str:
    if override and override in ("Low", "Medium", "High", "Critical"):
        return override
    text = f"{title} {description}".lower()
    if any(kw in text for kw in CRITICAL_KEYWORDS):
        return "Critical"
    if any(kw in text for kw in HIGH_KEYWORDS):
        return "High"
    if any(kw in text for kw in MEDIUM_KEYWORDS):
        return "Medium"
    return "Low"
