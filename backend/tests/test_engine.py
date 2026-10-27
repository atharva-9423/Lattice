from datetime import datetime, timedelta, timezone
from app.engine.classify import classify_complaint
from app.engine.severity import detect_severity
from app.engine.linking import compute_institution_links
from app.engine.risk import compute_institution_risk
from app.engine.sla import compute_due_at, compute_sla_state


def test_classification_and_routing():
    cat, unit, conf = classify_complaint(
        "Tuition fee refund not returned",
        "My tuition fee refund and deposit receipt were withheld after withdrawing admission.",
    )
    assert cat == "Fee and Refund"
    assert unit == "SGC"
    assert 0.45 <= conf <= 0.95

    cat_zero, unit_zero, conf_zero = classify_complaint("General inquiry", "Nothing matching keywords here")
    assert cat_zero == "Academic Quality and Exams"
    assert unit_zero == "ACB"
    assert conf_zero == 0.30


def test_auto_severity():
    assert detect_severity("Lab fire hazard", "Exposed wiring and electrical hazard in lab") == "Critical"
    assert detect_severity("Faculty unpaid", "Teachers have salary unpaid for three months") == "High"
    assert detect_severity("Fee refund delay", "Refund not received after seat withdrawal") == "Medium"
    assert detect_severity("Timetable query", "Minor schedule question") == "Low"
    assert detect_severity("Minor query", "Normal text", override="Critical") == "Critical"


def test_linking_thresholds():
    now = datetime.now(timezone.utc)
    complaints = [
        {
            "id": 1,
            "title": "Tuition fee refund not returned after withdrawing admission",
            "description": "The accounts office has withheld my tuition fee refund and original receipt for six weeks.",
            "unit_code": "SGC",
            "created_at": now - timedelta(days=10),
        },
        {
            "id": 2,
            "title": "Tuition fee refund not returned after withdrawing admission",
            "description": "The accounts office has withheld my tuition fee refund and original receipt for several weeks.",
            "unit_code": "SGC",
            "created_at": now - timedelta(days=8),
        },
        {
            "id": 3,
            "title": "Critical electrical hazard in high voltage laboratory",
            "description": "Exposed switchgear and water seepage in the power engineering building.",
            "unit_code": "AB",
            "created_at": now - timedelta(days=5),
        },
    ]
    links, clusters = compute_institution_links(complaints)
    pair_12 = next((l for l in links if l["a_id"] == 1 and l["b_id"] == 2), None)
    assert pair_12 is not None
    assert pair_12["type"] == "Duplicate"
    assert clusters[1] == clusters[2]

    pair_13 = next((l for l in links if l["a_id"] == 1 and l["b_id"] == 3), None)
    assert pair_13 is not None
    assert pair_13["type"] == "Context"
    assert clusters[3] != clusters[1]


def test_risk_formula_bounds():
    now = datetime.now(timezone.utc)
    empty_res = compute_institution_risk([], {}, now)
    assert empty_res["score"] == 0
    assert empty_res["band"] == "Low"

    sample = [
        {
            "id": i,
            "severity": "Critical",
            "status": "In Review",
            "unit_code": ["AB", "ACB", "SGC", "VC"][i % 4],
            "created_at": now - timedelta(days=10),
            "due_at": now - timedelta(days=5),
            "resolved_at": None,
        }
        for i in range(1, 15)
    ]
    cluster_sizes = {i: 4 for i in range(1, 15)}
    max_res = compute_institution_risk(sample, cluster_sizes, now)
    assert 0 <= max_res["score"] <= 100
    assert max_res["score"] == 100
    assert max_res["band"] == "Critical"
    assert len(max_res["sparkline"]) == 12


def test_sla_states():
    now = datetime.now(timezone.utc)
    created = now - timedelta(days=5)
    due_past = now - timedelta(days=2)
    state, prob, _ = compute_sla_state(created, due_past, "In Review", 10, now)
    assert state == "breached"
    assert prob == 1.0

    state_closed, prob_closed, _ = compute_sla_state(created, due_past, "Resolved", 10, now)
    assert state_closed == "closed"
    assert prob_closed == 0.0

    created_recent = now - timedelta(days=1)
    due_future = compute_due_at(created_recent, "Low")
    state_ok, prob_ok, _ = compute_sla_state(created_recent, due_future, "In Review", 2, now)
    assert state_ok == "ok"
    assert 0.0 <= prob_ok < 0.60
