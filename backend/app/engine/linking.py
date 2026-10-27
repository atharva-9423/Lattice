from typing import List, Dict, Any, Tuple
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def compute_institution_links(complaints: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[int, int]]:
    """
    Given a list of complaint dicts for a single institution:
      {id, title, description, unit_code, created_at (datetime)}
    Returns:
      - links: list of {a_id, b_id, type, similarity} with a_id < b_id
      - cluster_map: dict mapping complaint_id -> cluster_id (connected component of Duplicate/Similar)
    """
    n = len(complaints)
    if n < 2:
        return [], {c["id"]: c["id"] for c in complaints}

    ordered = sorted(complaints, key=lambda c: c["id"])
    texts = [f"{c['title']} {c['description']}" for c in ordered]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
        sim_matrix = cosine_similarity(tfidf_matrix)
    except ValueError:
        sim_matrix = [[0.0] * n for _ in range(n)]

    links: List[Dict[str, Any]] = []
    adj: Dict[int, List[int]] = {c["id"]: [] for c in ordered}

    for i in range(n):
        for j in range(i + 1, n):
            c_a = ordered[i]
            c_b = ordered[j]
            sim = float(sim_matrix[i][j])
            link_type = None
            if sim >= 0.60:
                link_type = "Duplicate"
            elif sim >= 0.30:
                link_type = "Similar"
            else:
                days_diff = abs((c_a["created_at"] - c_b["created_at"]).total_seconds()) / 86400.0
                if c_a["unit_code"] != c_b["unit_code"] and days_diff <= 45.0:
                    link_type = "Context"

            if link_type:
                links.append({
                    "a_id": c_a["id"],
                    "b_id": c_b["id"],
                    "type": link_type,
                    "similarity": round(sim, 3),
                })
                if link_type in ("Duplicate", "Similar"):
                    adj[c_a["id"]].append(c_b["id"])
                    adj[c_b["id"]].append(c_a["id"])

    # Connected components for Duplicate/Similar links
    visited = set()
    cluster_map: Dict[int, int] = {}
    for c in ordered:
        cid = c["id"]
        if cid not in visited:
            comp = []
            queue = [cid]
            visited.add(cid)
            while queue:
                curr = queue.pop(0)
                comp.append(curr)
                for nxt in adj[curr]:
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)
            rep_id = min(comp)
            for member in comp:
                cluster_map[member] = rep_id

    return links, cluster_map
