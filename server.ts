import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "backend", "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const STATE_FILE = path.join(DATA_DIR, "app_state.json");

// Domain Types
export interface UnitRecord {
  id: number;
  code: "AB" | "ACB" | "SGC" | "VC";
  name: string;
  kind: string;
}

export interface OfficerRecord {
  id: number;
  name: string;
  unit_id: number;
  title: string;
}

export interface InstitutionRecord {
  id: number;
  name: string;
  city: string;
  state: string;
  type: string;
  established_year: number;
  intake: number;
}

export interface ComplaintRecord {
  id: number;
  ref: string;
  institution_id: number;
  title: string;
  description: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "New" | "Assigned" | "In Review" | "Awaiting Institution" | "Escalated" | "Resolved" | "Closed";
  unit_id: number;
  assigned_officer_id: number | null;
  complainant_type: "Student" | "Parent" | "Faculty" | "Staff" | "Anonymous";
  created_at: string;
  updated_at: string;
  due_at: string;
  resolved_at: string | null;
  escalation_count: number;
  auto_confidence: number;
  cluster_id: number | null;
}

export interface CaseEventRecord {
  id: number;
  complaint_id: number;
  type: "Created" | "Routed" | "Assigned" | "StatusChanged" | "Note" | "Escalated" | "Linked";
  actor: string;
  message: string;
  created_at: string;
}

export interface CaseLinkRecord {
  id: number;
  institution_id: number;
  a_id: number;
  b_id: number;
  type: "Duplicate" | "Similar" | "Context";
  similarity: number;
  resolution_status?: "pending" | "confirmed" | "dismissed";
  resolved_by?: string | null;
  resolved_at?: string | null;
}

export interface AlertRecord {
  id: number;
  rule: "R1" | "R2" | "R3" | "R4";
  severity: "Low" | "Medium" | "High" | "Critical";
  institution_id: number | null;
  complaint_id: number | null;
  message: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
}

interface DatabaseState {
  units: UnitRecord[];
  officers: OfficerRecord[];
  institutions: InstitutionRecord[];
  complaints: ComplaintRecord[];
  case_events: CaseEventRecord[];
  case_links: CaseLinkRecord[];
  alerts: AlertRecord[];
}

// Section 4.1: Classification and routing
const CATEGORY_ROUTING: Array<{ category: string; unit_code: "AB" | "ACB" | "SGC" | "VC"; keywords: string[] }> = [
  {
    category: "Fee and Refund",
    unit_code: "SGC",
    keywords: [
      "fee", "fees", "refund", "deposit", "tuition", "overcharged",
      "receipt", "scholarship money", "caution money", "withdrawing admission",
      "fee refund", "extra charges", "hidden charges", "refund delay"
    ],
  },
  {
    category: "Student Harassment and Welfare",
    unit_code: "SGC",
    keywords: [
      "harassment", "ragging", "bullying", "abuse", "hostel warden",
      "mental", "discrimination", "unsafe for girls", "hostel curfew",
      "intimidation", "counseling", "welfare"
    ],
  },
  {
    category: "Document and Certificate Issues",
    unit_code: "SGC",
    keywords: [
      "marksheet", "certificate", "transcript", "original documents",
      "withheld", "degree", "migration", "bonafide", "transfer certificate",
      "provisional certificate", "character certificate"
    ],
  },
  {
    category: "Admissions and Affiliation",
    unit_code: "AB",
    keywords: [
      "admission", "seats", "intake", "affiliation", "approval",
      "counselling", "quota", "capacity", "unapproved course",
      "excess intake", "management quota", "extension of approval"
    ],
  },
  {
    category: "Infrastructure and Safety",
    unit_code: "AB",
    keywords: [
      "laboratory", "lab", "fire", "building", "classroom", "library",
      "hostel", "electrical", "collapse", "sanitation", "electrical hazard",
      "drinking water", "ventilation", "fire extinguisher", "structural"
    ],
  },
  {
    category: "Faculty and Staffing",
    unit_code: "ACB",
    keywords: [
      "faculty", "teachers", "professor", "vacancies", "ghost faculty",
      "qualification", "salary unpaid", "staff", "unpaid salary",
      "student faculty ratio", "hod", "visiting lecturer", "pay scale"
    ],
  },
  {
    category: "Academic Quality and Exams",
    unit_code: "ACB",
    keywords: [
      "syllabus", "exam", "results", "attendance", "curriculum",
      "evaluation", "timetable", "revaluation", "internal marks",
      "academic calendar", "practical classes", "lab sessions"
    ],
  },
  {
    category: "Placement and Misrepresentation",
    unit_code: "VC",
    keywords: [
      "placement", "package", "false claim", "misleading", "advertisement",
      "fake ranking", "recruiters", "brochure", "100% placement",
      "inflated salary", "fake offer letter"
    ],
  },
];

const CATEGORY_TO_UNIT: Record<string, "AB" | "ACB" | "SGC" | "VC"> = Object.fromEntries(
  CATEGORY_ROUTING.map((r) => [r.category, r.unit_code])
);

export function classifyComplaint(title: string, description: string): {
  category: string;
  unit_code: "AB" | "ACB" | "SGC" | "VC";
  confidence: number;
} {
  const text = `${title} ${description}`.toLowerCase();
  let bestCategory = "Academic Quality and Exams";
  let bestUnit: "AB" | "ACB" | "SGC" | "VC" = "ACB";
  let bestScore = 0;

  for (const item of CATEGORY_ROUTING) {
    let score = 0;
    for (const kw of item.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = item.category;
      bestUnit = item.unit_code;
    }
  }

  if (bestScore === 0) {
    return { category: "Academic Quality and Exams", unit_code: "ACB", confidence: 0.3 };
  }
  const confidence = Math.min(0.95, Math.round((0.45 + 0.15 * bestScore) * 100) / 100);
  return { category: bestCategory, unit_code: bestUnit, confidence };
}

// Section 4.2: Auto-severity
const CRITICAL_KEYWORDS = [
  "fire", "collapse", "death", "died", "suicide", "fraud",
  "forged", "fake", "assault", "harassment", "ragging", "electrical hazard"
];
const HIGH_KEYWORDS = [
  "withheld", "unpaid", "no faculty", "illegal", "threat",
  "shut", "closed without", "vacancies", "ghost faculty"
];
const MEDIUM_KEYWORDS = [
  "delay", "not received", "refund", "mismatch", "shortage", "overcharged"
];

export function detectSeverity(
  title: string,
  description: string,
  override?: string | null
): "Low" | "Medium" | "High" | "Critical" {
  if (override && ["Low", "Medium", "High", "Critical"].includes(override)) {
    return override as "Low" | "Medium" | "High" | "Critical";
  }
  const text = `${title} ${description}`.toLowerCase();
  if (CRITICAL_KEYWORDS.some((kw) => text.includes(kw))) return "Critical";
  if (HIGH_KEYWORDS.some((kw) => text.includes(kw))) return "High";
  if (MEDIUM_KEYWORDS.some((kw) => text.includes(kw))) return "Medium";
  return "Low";
}

// Section 4.3: TF-IDF (stop_words="english", ngram_range=(1,2), sublinear_tf=True, min_df=1)
const ENGLISH_STOP_WORDS = new Set([
  "a", "about", "above", "across", "after", "afterwards", "again", "against", "all", "almost",
  "alone", "along", "already", "also", "although", "always", "am", "among", "amongst", "amount",
  "an", "and", "another", "any", "anyhow", "anyone", "anything", "anyway", "anywhere", "are",
  "around", "as", "at", "back", "be", "became", "because", "become", "becomes", "becoming",
  "been", "before", "beforehand", "behind", "being", "below", "beside", "besides", "between",
  "beyond", "bill", "both", "bottom", "but", "by", "call", "can", "cannot", "cant", "co", "con",
  "could", "couldnt", "cry", "de", "describe", "detail", "do", "done", "down", "due", "during",
  "each", "eg", "eight", "either", "eleven", "else", "elsewhere", "empty", "enough", "etc",
  "even", "ever", "every", "everyone", "everything", "everywhere", "except", "few", "fifteen",
  "fifty", "fill", "find", "fire", "first", "five", "for", "former", "formerly", "forty",
  "found", "four", "from", "front", "full", "further", "get", "give", "go", "had", "has",
  "hasnt", "have", "he", "hence", "her", "here", "hereafter", "hereby", "herein", "hereupon",
  "hers", "herself", "him", "himself", "his", "how", "however", "hundred", "i", "ie", "if",
  "in", "inc", "indeed", "interest", "into", "is", "it", "its", "itself", "keep", "last",
  "latter", "latterly", "least", "less", "ltd", "made", "many", "may", "me", "meanwhile",
  "might", "mill", "mine", "more", "moreover", "most", "mostly", "move", "much", "must", "my",
  "myself", "name", "namely", "neither", "never", "nevertheless", "next", "nine", "no", "nobody",
  "none", "noone", "nor", "not", "nothing", "now", "nowhere", "of", "off", "often", "on", "once",
  "one", "only", "onto", "or", "other", "others", "otherwise", "our", "ours", "ourselves", "out",
  "over", "own", "part", "per", "perhaps", "please", "put", "rather", "re", "same", "see",
  "seem", "seemed", "seeming", "seems", "serious", "several", "she", "should", "show", "side",
  "since", "sincere", "six", "sixty", "so", "some", "somehow", "someone", "something",
  "sometime", "sometimes", "somewhere", "still", "such", "system", "take", "ten", "than", "that",
  "the", "their", "them", "themselves", "then", "thence", "there", "thereafter", "thereby",
  "therefore", "therein", "thereupon", "these", "they", "thick", "thin", "third", "this",
  "those", "though", "three", "through", "throughout", "thru", "thus", "to", "together", "too",
  "top", "toward", "towards", "twelve", "twenty", "two", "un", "under", "until", "up", "upon",
  "us", "very", "via", "was", "we", "well", "were", "what", "whatever", "when", "whence",
  "whenever", "where", "whereafter", "whereas", "whereby", "wherein", "whereupon", "wherever",
  "whether", "which", "while", "whither", "who", "whoever", "whole", "whom", "whose", "why",
  "will", "with", "within", "without", "would", "yet", "you", "your", "yours", "yourself",
  "yourselves"
]);

function extractNgrams(text: string): string[] {
  const words = (text.toLowerCase().match(/\b[a-z0-9]{2,}\b/g) || []).filter(
    (w) => !ENGLISH_STOP_WORDS.has(w)
  );
  const terms: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    terms.push(`${words[i]} ${words[i + 1]}`);
  }
  return terms;
}

export function computeInstitutionLinks(
  complaints: Array<{
    id: number;
    title: string;
    description: string;
    unit_code: string;
    created_at: Date;
  }>
): {
  links: Array<{ a_id: number; b_id: number; type: "Duplicate" | "Similar" | "Context"; similarity: number }>;
  clusterMap: Record<number, number>;
} {
  const n = complaints.length;
  if (n < 2) {
    const singleMap: Record<number, number> = {};
    for (const c of complaints) singleMap[c.id] = c.id;
    return { links: [], clusterMap: singleMap };
  }

  const ordered = [...complaints].sort((a, b) => a.id - b.id);
  const docTerms = ordered.map((c) => extractNgrams(`${c.title} ${c.description}`));

  const df = new Map<string, number>();
  const docTf = docTerms.map((terms) => {
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t, (counts.get(t) || 0) + 1);
    for (const k of counts.keys()) df.set(k, (df.get(k) || 0) + 1);
    return counts;
  });

  // Compute sublinear TF * smooth IDF and L2 normalize
  const vectors = docTf.map((counts) => {
    const vec = new Map<string, number>();
    let normSq = 0;
    for (const [term, count] of counts.entries()) {
      const subTf = 1 + Math.log(count);
      const idf = Math.log((1 + n) / (1 + (df.get(term) || 1))) + 1;
      const w = subTf * idf;
      vec.set(term, w);
      normSq += w * w;
    }
    const norm = Math.sqrt(normSq) || 1;
    for (const [term, w] of vec.entries()) {
      vec.set(term, w / norm);
    }
    return vec;
  });

  const links: Array<{ a_id: number; b_id: number; type: "Duplicate" | "Similar" | "Context"; similarity: number }> = [];
  const adj: Record<number, number[]> = {};
  for (const c of ordered) adj[c.id] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ca = ordered[i];
      const cb = ordered[j];
      const va = vectors[i];
      const vb = vectors[j];
      let dot = 0;
      for (const [term, wa] of va.entries()) {
        const wb = vb.get(term);
        if (wb !== undefined) dot += wa * wb;
      }
      const sim = Math.max(0, Math.min(1, dot));
      let linkType: "Duplicate" | "Similar" | "Context" | null = null;
      if (sim >= 0.6) {
        linkType = "Duplicate";
      } else if (sim >= 0.3) {
        linkType = "Similar";
      } else {
        const daysDiff = Math.abs(ca.created_at.getTime() - cb.created_at.getTime()) / (1000 * 86400);
        if (ca.unit_code !== cb.unit_code && daysDiff <= 45) {
          linkType = "Context";
        }
      }

      if (linkType) {
        links.push({
          a_id: ca.id,
          b_id: cb.id,
          type: linkType,
          similarity: Math.round(sim * 1000) / 1000,
        });
        if (linkType === "Duplicate" || linkType === "Similar") {
          adj[ca.id].push(cb.id);
          adj[cb.id].push(ca.id);
        }
      }
    }
  }

  const visited = new Set<number>();
  const clusterMap: Record<number, number> = {};
  for (const c of ordered) {
    if (!visited.has(c.id)) {
      const comp: number[] = [];
      const queue: number[] = [c.id];
      visited.add(c.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        for (const nxt of adj[curr]) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            queue.push(nxt);
          }
        }
      }
      const repId = Math.min(...comp);
      for (const member of comp) {
        clusterMap[member] = repId;
      }
    }
  }

  return { links, clusterMap };
}

// Section 4.4: Institution risk score
const SEVERITY_WEIGHTS: Record<string, number> = {
  Low: 0.25,
  Medium: 0.5,
  High: 0.75,
  Critical: 1.0,
};

export function getRiskBand(score: number): "Low" | "Watch" | "High" | "Critical" {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Watch";
  return "Low";
}

export function computeRiskForWindow(
  complaints: Array<{
    id: number;
    severity: string;
    status: string;
    unit_code: string;
    created_at: Date;
    due_at: Date;
    resolved_at: Date | null;
  }>,
  clusterSizes: Record<number, number>,
  windowEnd: Date
) {
  const windowStart = new Date(windowEnd.getTime() - 90 * 86400 * 1000);
  const inWindow = complaints.filter(
    (c) => c.created_at >= windowStart && c.created_at <= windowEnd
  );
  const n = inWindow.length;
  if (n === 0) {
    return {
      score: 0,
      band: "Low" as const,
      total_90d: 0,
      factors: [
        { key: "V", label: "Volume", weight: 0.3, value: 0, points: 0, explanation: "No complaints filed in the last 90 days." },
        { key: "S", label: "Severity", weight: 0.25, value: 0, points: 0, explanation: "No active severity weight recorded." },
        { key: "R", label: "Repetition", weight: 0.2, value: 0, points: 0, explanation: "No repeated complaint clusters detected." },
        { key: "A", label: "Ageing", weight: 0.15, value: 0, points: 0, explanation: "No open complaints past SLA deadline." },
        { key: "X", label: "Spread", weight: 0.1, value: 0, points: 0, explanation: "0 of 4 AICTE units involved." },
      ],
    };
  }

  const vVal = Math.min(1, n / 12);
  const sVal =
    inWindow.reduce((acc, c) => acc + (SEVERITY_WEIGHTS[c.severity] || 0.25), 0) / n;
  const clusteredCount = inWindow.filter((c) => (clusterSizes[c.id] || 1) >= 2).length;
  const rVal = clusteredCount / n;

  const openInWindow = inWindow.filter(
    (c) =>
      c.status !== "Resolved" &&
      c.status !== "Closed" &&
      (!c.resolved_at || c.resolved_at > windowEnd)
  );
  let aVal = 0;
  let breachedOpen = 0;
  if (openInWindow.length > 0) {
    breachedOpen = openInWindow.filter((c) => windowEnd > c.due_at).length;
    aVal = breachedOpen / openInWindow.length;
  }

  const distinctUnits = new Set(inWindow.map((c) => c.unit_code)).size;
  const xVal = distinctUnits / 4;

  const rawScore = 100 * (0.3 * vVal + 0.25 * sVal + 0.2 * rVal + 0.15 * aVal + 0.1 * xVal);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const critHigh = inWindow.filter((c) => c.severity === "Critical" || c.severity === "High").length;

  return {
    score,
    band: getRiskBand(score),
    total_90d: n,
    factors: [
      {
        key: "V",
        label: "Volume",
        weight: 0.3,
        value: Math.round(vVal * 1000) / 1000,
        points: Math.round(30 * vVal * 10) / 10,
        explanation: `${n} complaints filed in the 90-day window against the 12-case ceiling.`,
      },
      {
        key: "S",
        label: "Severity",
        weight: 0.25,
        value: Math.round(sVal * 1000) / 1000,
        points: Math.round(25 * sVal * 10) / 10,
        explanation: `${critHigh} of ${n} recent cases are graded High or Critical severity.`,
      },
      {
        key: "R",
        label: "Repetition",
        weight: 0.2,
        value: Math.round(rVal * 1000) / 1000,
        points: Math.round(20 * rVal * 10) / 10,
        explanation: `${clusteredCount} of ${n} complaints belong to recurring similarity clusters.`,
      },
      {
        key: "A",
        label: "Ageing",
        weight: 0.15,
        value: Math.round(aVal * 1000) / 1000,
        points: Math.round(15 * aVal * 10) / 10,
        explanation:
          openInWindow.length > 0
            ? `${breachedOpen} of ${openInWindow.length} open complaints have breached SLA deadlines.`
            : "No open complaints in window.",
      },
      {
        key: "X",
        label: "Spread",
        weight: 0.1,
        value: Math.round(xVal * 1000) / 1000,
        points: Math.round(10 * xVal * 10) / 10,
        explanation: `Cases span ${distinctUnits} of 4 AICTE bureaus and cells.`,
      },
    ],
  };
}

export function computeInstitutionRisk(
  complaints: Array<{
    id: number;
    severity: string;
    status: string;
    unit_code: string;
    created_at: Date;
    due_at: Date;
    resolved_at: Date | null;
  }>,
  clusterSizes: Record<number, number>,
  now: Date
) {
  const current = computeRiskForWindow(complaints, clusterSizes, now);
  const history: Array<{ week: string; score: number }> = [];
  for (let w = 11; w >= 0; w--) {
    const wend = new Date(now.getTime() - w * 7 * 86400 * 1000);
    const wres = computeRiskForWindow(complaints, clusterSizes, wend);
    const label = wend.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    history.push({ week: label, score: wres.score });
  }
  return {
    ...current,
    history,
    sparkline: history.map((h) => h.score),
  };
}

// Section 4.5: SLA and breach prediction
const SLA_DAYS: Record<string, number> = {
  Critical: 3,
  High: 7,
  Medium: 15,
  Low: 30,
};

const STATUS_ADJ: Record<string, number> = {
  New: 0.1,
  Assigned: 0.0,
  "In Review": -0.1,
  "Awaiting Institution": 0.15,
  Escalated: -0.05,
};

export function computeDueAt(createdAt: Date, severity: string): Date {
  const days = SLA_DAYS[severity] || 15;
  return new Date(createdAt.getTime() + days * 86400 * 1000);
}

export function computeSlaState(
  createdAt: Date,
  dueAt: Date,
  status: string,
  openCasesInUnit: number,
  now: Date
): { sla_state: "ok" | "at_risk" | "breached" | "closed"; breach_probability: number; elapsed_ratio: number } {
  const totalMs = Math.max(1000, dueAt.getTime() - createdAt.getTime());
  const elapsedRaw = (now.getTime() - createdAt.getTime()) / totalMs;
  const elapsed = Math.max(0, Math.min(1, elapsedRaw));

  if (status === "Resolved" || status === "Closed") {
    return { sla_state: "closed", breach_probability: 0, elapsed_ratio: Math.round(elapsed * 1000) / 1000 };
  }
  if (now > dueAt) {
    return { sla_state: "breached", breach_probability: 1, elapsed_ratio: 1 };
  }

  const load = Math.min(1, openCasesInUnit / 25);
  const adj = STATUS_ADJ[status] ?? 0;
  const p = Math.max(0, Math.min(1, 0.6 * elapsed + 0.2 * load + adj));
  const pRounded = Math.round(p * 100) / 100;

  return {
    sla_state: pRounded >= 0.6 ? "at_risk" : "ok",
    breach_probability: pRounded,
    elapsed_ratio: Math.round(elapsed * 1000) / 1000,
  };
}

// Deterministic PRNG matching seed 26264
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

const INSTITUTIONS_SEED: Array<[string, string, string, string, number, number]> = [
  ["Meridian Institute of Technology", "Pune", "Maharashtra", "Engineering", 1998, 1200],
  ["Harbourlight College of Pharmacy", "Kochi", "Kerala", "Pharmacy", 2005, 420],
  ["Saffron Valley College of Engineering", "Jaipur", "Rajasthan", "Engineering", 2001, 960],
  ["Northgate School of Management", "Bengaluru", "Karnataka", "Management", 2008, 360],
  ["Crestview Institute of Technology", "Hyderabad", "Telangana", "Engineering", 1995, 1440],
  ["Vanguard College of Architecture", "Ahmedabad", "Gujarat", "Architecture", 2010, 240],
  ["Silverline Polytechnic Institute", "Coimbatore", "Tamil Nadu", "Polytechnic", 1992, 780],
  ["Deccan Ridge Institute of Engineering", "Nagpur", "Maharashtra", "Engineering", 2003, 900],
  ["Eastern Horizon School of Management", "Bhubaneswar", "Odisha", "Management", 2011, 300],
  ["Coromandel Institute of Technology", "Chennai", "Tamil Nadu", "Engineering", 1997, 1320],
  ["Aravalli College of Pharmacy", "Udaipur", "Rajasthan", "Pharmacy", 2009, 360],
  ["Narmada Valley Polytechnic", "Indore", "Madhya Pradesh", "Polytechnic", 2004, 600],
  ["Bluepine Institute of Management", "Dehradun", "Uttarakhand", "Management", 2012, 240],
  ["Riverstone College of Engineering", "Lucknow", "Uttar Pradesh", "Engineering", 2000, 1080],
  ["Westcoast Institute of Architecture", "Mangaluru", "Karnataka", "Architecture", 2007, 180],
  ["Ganges Plain Polytechnic", "Varanasi", "Uttar Pradesh", "Polytechnic", 1996, 720],
  ["Solstice Institute of Technology", "Chandigarh", "Punjab", "Engineering", 2002, 840],
  ["Malabar Crest College of Pharmacy", "Kozhikode", "Kerala", "Pharmacy", 2006, 300],
  ["Vindhya Institute of Engineering", "Bhopal", "Madhya Pradesh", "Engineering", 1999, 960],
  ["Kaveri Delta College of Technology", "Tiruchirappalli", "Tamil Nadu", "Engineering", 2001, 1140],
  ["Redwood School of Business", "Gurugram", "Haryana", "Management", 2013, 420],
  ["Satpura Polytechnic College", "Raipur", "Chhattisgarh", "Polytechnic", 2005, 540],
  ["Konkan Coastal Institute of Pharmacy", "Panaji", "Goa", "Pharmacy", 2014, 240],
  ["Brahmaputra Valley Engineering College", "Guwahati", "Assam", "Engineering", 2003, 660],
  ["Nilgiri Hills Institute of Technology", "Mysuru", "Karnataka", "Engineering", 1994, 1020],
  ["Shivalik School of Architecture", "Shimla", "Himachal Pradesh", "Architecture", 2015, 160],
  ["Chota Nagpur Polytechnic", "Ranchi", "Jharkhand", "Polytechnic", 2002, 600],
  ["Godavari Basin College of Engineering", "Visakhapatnam", "Andhra Pradesh", "Engineering", 1998, 1200],
  ["Thar Desert Institute of Management", "Jodhpur", "Rajasthan", "Management", 2009, 300],
  ["Sundarbans College of Pharmacy", "Kolkata", "West Bengal", "Pharmacy", 2004, 480],
  ["Sahyadri Crown Institute of Technology", "Nashik", "Maharashtra", "Engineering", 2006, 840],
  ["Magadh Central Polytechnic", "Patna", "Bihar", "Polytechnic", 2000, 660],
  ["Doaba Institute of Engineering", "Jalandhar", "Punjab", "Engineering", 2001, 900],
  ["Bundelkhand School of Management", "Gwalior", "Madhya Pradesh", "Management", 2011, 240],
  ["Backwater View College of Architecture", "Thiruvananthapuram", "Kerala", "Architecture", 2012, 180],
  ["Tapti Valley College of Pharmacy", "Surat", "Gujarat", "Pharmacy", 2007, 360],
  ["Mahanadi Institute of Technology", "Cuttack", "Odisha", "Engineering", 1999, 960],
  ["Rayalaseema Polytechnic Institute", "Tirupati", "Andhra Pradesh", "Polytechnic", 2008, 540],
  ["Marwar College of Engineering", "Ajmer", "Rajasthan", "Engineering", 2003, 780],
  ["Peninsular School of Management", "Madurai", "Tamil Nadu", "Management", 2010, 300],
];

const TEMPLATES: Record<string, Array<[string, string]>> = {
  "Fee and Refund": [
    [
      "Tuition fee refund not returned after withdrawing admission",
      "I withdrew my admission within the AICTE stipulated counselling window, yet the accounts office has withheld my tuition fee refund and original receipt for over six weeks despite three written reminders.",
    ],
    [
      "Security deposit and tuition refund delayed after seat cancellation",
      "After cancelling my seat before the semester started, the college promised to process my tuition fee refund and caution deposit within fifteen days, but no refund has been received.",
    ],
    [
      "Students overcharged above approved tuition fee structure",
      "The administration is collecting mandatory development and laboratory fees far above the state fee regulatory committee ceiling without issuing an official receipt.",
    ],
    [
      "Scholarship money and tuition deposit withheld by accounts section",
      "State scholarship money credited to the institution has not been adjusted against our semester fee, and students are being threatened with exam debarment.",
    ],
  ],
  "Student Harassment and Welfare": [
    [
      "Severe ragging and intimidation reported in senior boys hostel block",
      "First-year engineering students are subjected to late-night ragging and verbal abuse by seniors in Hostel Block C while the hostel warden ignores written complaints.",
    ],
    [
      "Mental harassment and discriminatory rules by hostel warden",
      "Students raising grievances about mess hygiene face targeted mental harassment, arbitrary fines, and intimidation from the chief hostel warden.",
    ],
    [
      "Campus environment unsafe for girls due to broken perimeter lighting",
      "Pathways between the central library and the women hostel have no lighting or security guards after 7 PM, making the campus unsafe for girls.",
    ],
    [
      "Bullying and retaliatory grading against grievance petitioners",
      "Students who signed a petition regarding hostel welfare were threatened with low internal evaluation marks and disciplinary bullying.",
    ],
  ],
  "Document and Certificate Issues": [
    [
      "Original documents and degree marksheet withheld by registrar",
      "The registrar office has withheld my original 10th and 12th marksheet and transfer certificate, demanding full four-year fees before releasing my documents.",
    ],
    [
      "Provisional degree certificate and transcript delayed by four months",
      "Graduating batch students have not received their provisional degree certificate or official transcript, causing multiple students to lose postgraduate admission offers.",
    ],
    [
      "Migration certificate withheld despite clearing all library and hostel dues",
      "Even after submitting the signed no-dues form, the student section refuses to issue the migration certificate and original documents.",
    ],
    [
      "Delay in issuing bonafide certificate for education loan renewal",
      "The administrative cell has delayed issuing bonafide and fee structure certificates for over five weeks, stalling bank education loan disbursements.",
    ],
  ],
  "Admissions and Affiliation": [
    [
      "Admission granted in excess of AICTE approved intake capacity",
      "The institution admitted 45 extra students in the Computer Science branch beyond the sanctioned AICTE intake quota without extension of approval.",
    ],
    [
      "Irregular management quota seats filled without merit counselling",
      "Seats reserved for state counselling were converted into management quota seats with undisclosed capitation charges before the final counselling round.",
    ],
    [
      "Course running without valid AICTE affiliation and approval renewal",
      "A new specialization track in Artificial Intelligence is admitting students even though the extension of approval letter does not list this programme.",
    ],
    [
      "Misleading seat capacity declared during state admission counselling",
      "The college reported full laboratory readiness to secure higher seat intake approval while lacking basic instructional space for admitted batches.",
    ],
  ],
  "Infrastructure and Safety": [
    [
      "Critical electrical hazard and exposed wiring in high-voltage machine lab",
      "The electrical machines laboratory has exposed live distribution panels, water seepage near switchgear, and missing circuit breakers, creating a severe electrical hazard and fire risk.",
    ],
    [
      "Fire safety equipment expired and emergency exits locked in academic block",
      "Fire extinguishers across the four-storey laboratory building expired two years ago and the secondary staircase is permanently padlocked.",
    ],
    [
      "Severe sanitation failure and unsafe drinking water in student hostel",
      "Water purifiers in the main academic building and hostel have been non-functional for a month, and sanitation conditions in washrooms are hazardous.",
    ],
    [
      "Structural cracks and ceiling plaster collapse in third-floor classroom",
      "Large portions of ceiling plaster collapsed during a lecture in Room 304; the building wing shows visible structural dampness and unsafe wiring.",
    ],
  ],
  "Faculty and Staffing": [
    [
      "Severe faculty vacancies and no faculty for core third-year subjects",
      "More than half of the sanctioned associate professor posts are vacant, leaving third-year engineering batches with no faculty for three core subjects this semester.",
    ],
    [
      "Faculty salary unpaid for four consecutive months across departments",
      "Regular teaching faculty and laboratory staff have had their salary unpaid since the start of the semester, leading to mass resignations and halted classes.",
    ],
    [
      "Ghost faculty listed on muster rolls for AICTE inspection compliance",
      "Several professors listed on the institutional website and compliance portal are ghost faculty who never teach classes on campus.",
    ],
    [
      "Unqualified visiting staff assigned to teach final-year laboratory courses",
      "Due to severe faculty shortage and vacancies, newly graduated teaching assistants without postgraduate qualification are running advanced courses.",
    ],
  ],
  "Academic Quality and Exams": [
    [
      "Core syllabus left incomplete before end-semester university exam",
      "Less than forty percent of the prescribed curriculum was covered in lectures before the examination timetable was announced.",
    ],
    [
      "Arbitrary internal attendance mismatch and delayed exam results",
      "Published attendance records contain widespread mismatch errors and internal evaluation results have been delayed without explanation.",
    ],
    [
      "Practical laboratory sessions cancelled throughout the academic timetable",
      "Scheduled laboratory sessions on the timetable were repeatedly cancelled due to broken equipment, affecting practical evaluation.",
    ],
    [
      "Delay in revaluation results for backlog examination papers",
      "Students who applied for exam answer-script revaluation two months ago have still not received updated results.",
    ],
  ],
  "Placement and Misrepresentation": [
    [
      "Misleading advertisement claiming 100% placement and fake ranking",
      "The college published full-page newspaper advertisements with a fake ranking and false claim of 100% placement with inflated international salary packages.",
    ],
    [
      "Fake offer letters distributed from shell recruiters during placement drive",
      "Students were handed placement offer letters from non-existent recruiters that demanded training security deposits and never onboarded graduates.",
    ],
    [
      "Brochure misrepresents tie-ups with global technology recruiters",
      "The admission brochure makes a misleading claim of guaranteed corporate internships and false package statistics to attract applicants.",
    ],
    [
      "Placement cell collecting mandatory registration fee for fake drives",
      "Final-year students were forced to pay non-refundable placement registration charges for campus drives that turned out to be sales workshops.",
    ],
  ],
};

const COMPLAINANT_TYPES: Array<"Student" | "Parent" | "Faculty" | "Staff" | "Anonymous"> = [
  "Student", "Parent", "Faculty", "Staff", "Anonymous"
];

let dbState: DatabaseState;

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(dbState, null, 2), "utf-8");
}

function recomputeAllIntelligence(now: Date) {
  const unitCodeById: Record<number, "AB" | "ACB" | "SGC" | "VC"> = {};
  for (const u of dbState.units) unitCodeById[u.id] = u.code;

  const instNameById: Record<number, string> = {};
  for (const inst of dbState.institutions) instNameById[inst.id] = inst.name;

  const openByUnit: Record<number, number> = {};
  for (const c of dbState.complaints) {
    if (c.status !== "Resolved" && c.status !== "Closed") {
      openByUnit[c.unit_id] = (openByUnit[c.unit_id] || 0) + 1;
    }
  }

  const caseSlaMap: Record<number, ReturnType<typeof computeSlaState>> = {};
  for (const c of dbState.complaints) {
    caseSlaMap[c.id] = computeSlaState(
      new Date(c.created_at),
      new Date(c.due_at),
      c.status,
      openByUnit[c.unit_id] || 0,
      now
    );
  }

  // Preserve existing link resolutions across recomputation
  const prevResolutions = new Map<
    string,
    { resolution_status: "pending" | "confirmed" | "dismissed"; resolved_by: string | null; resolved_at: string | null }
  >();
  for (const oldLink of dbState.case_links || []) {
    const key = `${Math.min(oldLink.a_id, oldLink.b_id)}:${Math.max(oldLink.a_id, oldLink.b_id)}`;
    if (oldLink.resolution_status && oldLink.resolution_status !== "pending") {
      prevResolutions.set(key, {
        resolution_status: oldLink.resolution_status,
        resolved_by: oldLink.resolved_by || null,
        resolved_at: oldLink.resolved_at || null,
      });
    }
  }

  // Recompute case_links and clusters per institution
  dbState.case_links = [];
  let linkIdSeq = 1;
  const instScores: Record<number, ReturnType<typeof computeInstitutionRisk>> = {};

  const byInst: Record<number, ComplaintRecord[]> = {};
  for (const c of dbState.complaints) {
    if (!byInst[c.institution_id]) byInst[c.institution_id] = [];
    byInst[c.institution_id].push(c);
  }

  for (const inst of dbState.institutions) {
    const cList = byInst[inst.id] || [];
    const cDicts = cList.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      unit_code: unitCodeById[c.unit_id] || "ACB",
      severity: c.severity,
      status: c.status,
      created_at: new Date(c.created_at),
      due_at: new Date(c.due_at),
      resolved_at: c.resolved_at ? new Date(c.resolved_at) : null,
    }));

    const { links, clusterMap } = computeInstitutionLinks(cDicts);
    for (const lk of links) {
      const pairKey = `${Math.min(lk.a_id, lk.b_id)}:${Math.max(lk.a_id, lk.b_id)}`;
      const prev = prevResolutions.get(pairKey);
      dbState.case_links.push({
        id: linkIdSeq++,
        institution_id: inst.id,
        a_id: lk.a_id,
        b_id: lk.b_id,
        type: lk.type,
        similarity: lk.similarity,
        resolution_status: prev ? prev.resolution_status : "pending",
        resolved_by: prev ? prev.resolved_by : null,
        resolved_at: prev ? prev.resolved_at : null,
      });
    }

    const clusterCounts: Record<number, number> = {};
    for (const clId of Object.values(clusterMap)) {
      clusterCounts[clId] = (clusterCounts[clId] || 0) + 1;
    }

    const clusterSizesByCid: Record<number, number> = {};
    for (const c of cList) {
      const clId = clusterMap[c.id] ?? c.id;
      c.cluster_id = clId;
      clusterSizesByCid[c.id] = clusterCounts[clId] || 1;
    }

    instScores[inst.id] = computeInstitutionRisk(cDicts, clusterSizesByCid, now);
  }

  // Evaluate alert rules R1-R4 (de-duplicated while unacknowledged)
  const openKeys = new Set<string>();
  for (const a of dbState.alerts) {
    if (!a.acknowledged) {
      openKeys.add(`${a.rule}:${a.institution_id ?? ""}:${a.complaint_id ?? ""}`);
    }
  }
  let nextAlertId = dbState.alerts.reduce((m, a) => Math.max(m, a.id), 0) + 1;

  // R1: Risk threshold (score >= 60)
  for (const inst of dbState.institutions) {
    const rdata = instScores[inst.id];
    if (rdata && rdata.score >= 60) {
      const key = `R1:${inst.id}:`;
      if (!openKeys.has(key)) {
        const recent30 = (byInst[inst.id] || []).filter(
          (c) => (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 86400) <= 30
        );
        const uCount = new Set(recent30.map((c) => unitCodeById[c.unit_id])).size;
        dbState.alerts.push({
          id: nextAlertId++,
          rule: "R1",
          severity: rdata.score >= 80 ? "Critical" : "High",
          institution_id: inst.id,
          complaint_id: null,
          message: `${inst.name}: Risk score reached ${rdata.score} (${rdata.band} band) with ${recent30.length} complaints across ${Math.max(1, uCount)} units in 30 days.`,
          created_at: now.toISOString(),
          acknowledged: false,
          acknowledged_by: null,
        });
        openKeys.add(key);
      }
    }
  }

  // R2: Cross-cell pattern (3+ complaints in 30 days across 2+ units)
  for (const inst of dbState.institutions) {
    const recent30 = (byInst[inst.id] || []).filter(
      (c) => (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 86400) <= 30
    );
    const uSet = new Set(recent30.map((c) => unitCodeById[c.unit_id]));
    if (recent30.length >= 3 && uSet.size >= 2) {
      const key = `R2:${inst.id}:`;
      if (!openKeys.has(key)) {
        const score = instScores[inst.id]?.score || 0;
        dbState.alerts.push({
          id: nextAlertId++,
          rule: "R2",
          severity: "High",
          institution_id: inst.id,
          complaint_id: null,
          message: `${inst.name}: ${recent30.length} complaints across ${uSet.size} units in 30 days. Risk score ${score}.`,
          created_at: now.toISOString(),
          acknowledged: false,
          acknowledged_by: null,
        });
        openKeys.add(key);
      }
    }
  }

  // R3: SLA breach or p >= 0.8 (for high-priority / escalated or breached cases in monitored watchlist institutions)
  for (const c of dbState.complaints) {
    if (c.status === "Resolved" || c.status === "Closed") continue;
    const sla = caseSlaMap[c.id];
    const instScore = instScores[c.institution_id]?.score || 0;
    if (sla && sla.sla_state === "breached" && (instScore >= 45 || c.severity === "Critical")) {
      const key = `R3:${c.institution_id}:${c.id}`;
      if (!openKeys.has(key)) {
        const instName = instNameById[c.institution_id] || "Institution";
        dbState.alerts.push({
          id: nextAlertId++,
          rule: "R3",
          severity: c.severity === "Critical" ? "High" : "Medium",
          institution_id: c.institution_id,
          complaint_id: c.id,
          message: `Case ${c.ref} (${instName}) breached its SLA deadline in ${unitCodeById[c.unit_id]}.`,
          created_at: now.toISOString(),
          acknowledged: false,
          acknowledged_by: null,
        });
        openKeys.add(key);
      }
    }
  }

  // R4: Duplicate cluster (de-duplicated per institution/complaint pair)
  const compById: Record<number, ComplaintRecord> = {};
  for (const c of dbState.complaints) compById[c.id] = c;
  for (const lk of dbState.case_links) {
    if (lk.type === "Duplicate" && (instScores[lk.institution_id]?.score || 0) >= 35) {
      const caseKey = `R4:${lk.institution_id}:${lk.b_id}`;
      if (!openKeys.has(caseKey)) {
        const ca = compById[lk.a_id];
        const cb = compById[lk.b_id];
        const instName = instNameById[lk.institution_id] || "Institution";
        if (ca && cb) {
          dbState.alerts.push({
            id: nextAlertId++,
            rule: "R4",
            severity: "Low",
            institution_id: lk.institution_id,
            complaint_id: lk.b_id,
            message: `Duplicate cluster detected at ${instName}: ${cb.ref} matches ${ca.ref} (${Math.round(lk.similarity * 100)}% similarity).`,
            created_at: now.toISOString(),
            acknowledged: false,
            acknowledged_by: null,
          });
          openKeys.add(caseKey);
        }
      }
    }
  }

  return { instScores, caseSlaMap };
}

function createInitialSeed(): DatabaseState {
  const rng = new SeededRandom(26264);
  const now = new Date();

  const units: UnitRecord[] = [
    { id: 1, code: "AB", name: "Approval Bureau", kind: "Bureau" },
    { id: 2, code: "ACB", name: "Academic Bureau", kind: "Bureau" },
    { id: 3, code: "SGC", name: "Student Grievance Cell", kind: "Cell" },
    { id: 4, code: "VC", name: "Vigilance Cell", kind: "Cell" },
  ];

  const unitByCode: Record<string, UnitRecord> = {};
  for (const u of units) unitByCode[u.code] = u;

  const officers: OfficerRecord[] = [
    { id: 1, name: "Dr. Rajeshwar Rao", unit_id: 1, title: "Deputy Director" },
    { id: 2, name: "Meenakshi Sundaram", unit_id: 1, title: "Assistant Director" },
    { id: 3, name: "Prof. Arvind Kulkarni", unit_id: 2, title: "Deputy Director" },
    { id: 4, name: "Dr. Sunita Deshmukh", unit_id: 2, title: "Assistant Director" },
    { id: 5, name: "Vikramaditya Sen", unit_id: 3, title: "Grievance Officer" },
    { id: 6, name: "Kavita Nair", unit_id: 3, title: "Assistant Director" },
    { id: 7, name: "Suresh Chandra Bose", unit_id: 4, title: "Chief Vigilance Officer" },
    { id: 8, name: "Ananya Chatterjee", unit_id: 4, title: "Vigilance Investigation Officer" },
  ];

  const institutions: InstitutionRecord[] = INSTITUTIONS_SEED.map((row, i) => ({
    id: i + 1,
    name: row[0],
    city: row[1],
    state: row[2],
    type: row[3],
    established_year: row[4],
    intake: row[5],
  }));

  const complaints: ComplaintRecord[] = [];
  const case_events: CaseEventRecord[] = [];
  let compSeq = 1;
  let eventSeq = 1;

  function addComplaint(
    instId: number,
    title: string,
    description: string,
    category: string,
    severity: "Low" | "Medium" | "High" | "Critical",
    status: ComplaintRecord["status"],
    unitCode: "AB" | "ACB" | "SGC" | "VC",
    daysAgo: number,
    complainantType: ComplaintRecord["complainant_type"],
    forceBreached = false,
    escalationCount = 0,
    confidence = 0.85
  ) {
    let createdAt = new Date(now.getTime() - daysAgo * 86400 * 1000);
    let dueAt = computeDueAt(createdAt, severity);
    if (forceBreached && now <= dueAt) {
      const slaDays = SLA_DAYS[severity] || 15;
      createdAt = new Date(now.getTime() - (slaDays + 2) * 86400 * 1000);
      dueAt = computeDueAt(createdAt, severity);
    }

    let resolvedAt: Date | null = null;
    if (status === "Resolved" || status === "Closed") {
      const resDays = Math.min(daysAgo * 0.7, 9.0);
      resolvedAt = new Date(createdAt.getTime() + Math.max(0.5, resDays) * 86400 * 1000);
    }
    const updatedAt = resolvedAt || new Date(createdAt.getTime() + 6 * 3600 * 1000);
    const uObj = unitByCode[unitCode];
    const unitOfficers = officers.filter((o) => o.unit_id === uObj.id);
    const assignedOff = status !== "New" ? rng.choice(unitOfficers) : null;

    const id = compSeq++;
    const ref = `AICTE-2026-${String(id).padStart(5, "0")}`;

    complaints.push({
      id,
      ref,
      institution_id: instId,
      title,
      description,
      category,
      severity,
      status,
      unit_id: uObj.id,
      assigned_officer_id: assignedOff ? assignedOff.id : null,
      complainant_type: complainantType,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      due_at: dueAt.toISOString(),
      resolved_at: resolvedAt ? resolvedAt.toISOString() : null,
      escalation_count: escalationCount,
      auto_confidence: confidence,
      cluster_id: id,
    });

    case_events.push({
      id: eventSeq++,
      complaint_id: id,
      type: "Created",
      actor: `${complainantType} Portal`,
      message: `Complaint filed by ${complainantType.toLowerCase()} regarding ${category.toLowerCase()}.`,
      created_at: createdAt.toISOString(),
    });
    case_events.push({
      id: eventSeq++,
      complaint_id: id,
      type: "Routed",
      actor: "Intelligence Engine",
      message: `Auto-classified under ${category} (${Math.round(confidence * 100)}% confidence) and routed to ${uObj.name} (${unitCode}).`,
      created_at: new Date(createdAt.getTime() + 120 * 1000).toISOString(),
    });
    if (assignedOff) {
      case_events.push({
        id: eventSeq++,
        complaint_id: id,
        type: "Assigned",
        actor: "Unit Desk",
        message: `Assigned to ${assignedOff.name}, ${assignedOff.title}.`,
        created_at: new Date(createdAt.getTime() + 2 * 3600 * 1000).toISOString(),
      });
    }
    if (escalationCount > 0 || status === "Escalated") {
      case_events.push({
        id: eventSeq++,
        complaint_id: id,
        type: "Escalated",
        actor: "Chairperson Office",
        message: "Case escalated due to cross-unit risk pattern and impending SLA threshold.",
        created_at: new Date(createdAt.getTime() + 24 * 3600 * 1000).toISOString(),
      });
    }
    if ((status === "Resolved" || status === "Closed") && resolvedAt) {
      case_events.push({
        id: eventSeq++,
        complaint_id: id,
        type: "StatusChanged",
        actor: assignedOff ? assignedOff.name : "Unit Officer",
        message: `Compliance verified and case marked ${status}.`,
        created_at: resolvedAt.toISOString(),
      });
    }
  }

  // 1. Meridian Institute of Technology (id = 1)
  // 6 complaints in the last 26 days across SGC, ACB, AB, VC + 5 earlier complaints in the 90-day window
  // Calibrated so Meridian's initial score is 79 (within 78-88 and in High band), and filing a new refund complaint jumps it to 82 (Critical band)
  addComplaint(
    1,
    "Tuition fee refund not returned after withdrawing admission",
    "I withdrew my admission within the AICTE counselling window at Meridian Institute of Technology, yet the accounts office has withheld my tuition fee refund and original receipt for weeks.",
    "Fee and Refund", "High", "In Review", "SGC", 19, "Student", true, 0, 0.90
  );
  addComplaint(
    1,
    "Tuition fee refund withheld after admission withdrawal",
    "After withdrawing my admission within the AICTE stipulated window at Meridian Institute of Technology, the accounts office has not returned my tuition fee refund and original receipt.",
    "Fee and Refund", "High", "Assigned", "SGC", 14, "Parent", true, 0, 0.90
  );
  addComplaint(
    1,
    "Severe faculty vacancies and unpaid salary in core engineering departments",
    "More than half of sanctioned professor posts have faculty vacancies and regular teaching staff have had salary unpaid for months, halting core classes.",
    "Faculty and Staffing", "High", "Escalated", "ACB", 22, "Faculty", true, 1, 0.90
  );
  addComplaint(
    1,
    "Faculty salary unpaid and unfilled teaching vacancies across semester",
    "Regular teaching faculty and staff have had salary unpaid for consecutive months alongside severe faculty vacancies in core engineering courses.",
    "Faculty and Staffing", "High", "Awaiting Institution", "ACB", 12, "Faculty", true, 0, 0.90
  );
  addComplaint(
    1,
    "Critical electrical hazard and exposed high-voltage wiring in power laboratory",
    "The electrical machines laboratory has exposed live switchgear, water seepage, and fire hazard conditions creating an immediate electrical hazard for students.",
    "Infrastructure and Safety", "Critical", "Escalated", "AB", 9, "Student", true, 1, 0.95
  );
  addComplaint(
    1,
    "Misleading placement advertisement claiming 100% placement and fake packages",
    "The institute published a misleading advertisement with false claim of 100% placement and fake ranking statistics to attract admission applicants.",
    "Placement and Misrepresentation", "High", "In Review", "VC", 10, "Student", true, 0, 0.88
  );
  // 5 earlier complaints in the 45-75 day window
  addComplaint(
    1,
    "Admission seats filled beyond approved intake capacity without approval",
    "The institution admitted extra students above sanctioned intake capacity in mechanical and computer branches without AICTE approval.",
    "Admissions and Affiliation", "High", "Resolved", "AB", 48, "Staff", false, 0, 0.85
  );
  addComplaint(
    1,
    "Original degree certificate and marksheet withheld for extra fee refund dispute",
    "Student original documents and marksheet were withheld when questioning tuition fee refund deductions after withdrawing admission.",
    "Document and Certificate Issues", "High", "Resolved", "SGC", 55, "Student", false, 0, 0.85
  );
  addComplaint(
    1,
    "Fire safety extinguishers expired in main laboratory and classroom wing",
    "Fire safety equipment in the electrical laboratory and main building has expired, posing a fire and electrical hazard.",
    "Infrastructure and Safety", "Critical", "Resolved", "AB", 64, "Faculty", false, 0, 0.92
  );
  addComplaint(
    1,
    "Fake recruiters and misleading package claims in placement brochure",
    "The placement brochure listed misleading advertisement claims and fake ranking figures with inflated salary packages.",
    "Placement and Misrepresentation", "Critical", "Resolved", "VC", 72, "Parent", false, 0, 0.90
  );
  addComplaint(
    1,
    "Unapproved intake seats and affiliation irregularities in mechanical branch",
    "Extra students were admitted above sanctioned intake capacity without AICTE approval renewal.",
    "Admissions and Affiliation", "Critical", "Resolved", "AB", 78, "Student", false, 0, 0.88
  );

  // 2. Harbourlight College of Pharmacy (id = 2) -> Watch band (35-59)
  addComplaint(
    2,
    "Tuition fee refund delayed after seat cancellation",
    "After cancelling my pharmacy seat before classes commenced, my tuition fee refund and deposit have been delayed by the accounts section.",
    "Fee and Refund", "Medium", "In Review", "SGC", 18, "Student", true, 0, 0.85
  );
  addComplaint(
    2,
    "Fee refund and caution deposit delayed for withdrawn students",
    "Students who withdrew before the deadline have experienced a prolonged delay in receiving their tuition fee refund and caution deposit.",
    "Fee and Refund", "Medium", "Assigned", "SGC", 11, "Parent", false, 0, 0.85
  );
  addComplaint(
    2,
    "Laboratory ventilation and chemical storage safety shortage",
    "The pharmaceutical chemistry laboratory has broken fume hoods and poor ventilation during practical lab sessions.",
    "Infrastructure and Safety", "High", "In Review", "AB", 24, "Student", true, 0, 0.82
  );
  addComplaint(
    2,
    "Delay in issuing provisional certificate and transcript",
    "Final year B.Pharm graduates are facing a delay in receiving their provisional certificate and official transcript.",
    "Document and Certificate Issues", "Medium", "Resolved", "SGC", 42, "Student", false, 0, 0.80
  );
  addComplaint(
    2,
    "Faculty vacancies in pharmacology department",
    "Two senior pharmacology professor positions remain vacant this semester, affecting scheduled lectures.",
    "Faculty and Staffing", "High", "Resolved", "ACB", 58, "Faculty", false, 0, 0.85
  );

  const categoriesList = Object.keys(TEMPLATES);

  // 3. Three more High/Critical institutions (ids 3, 4, 5)
  for (let idx = 2; idx <= 4; idx++) {
    const instId = idx + 1;
    for (let k = 0; k < 10; k++) {
      const cat = categoriesList[(idx * 3 + k) % categoriesList.length];
      const ucode = CATEGORY_TO_UNIT[cat];
      const tpl = TEMPLATES[cat][k % 2];
      const sev: ComplaintRecord["severity"] = k < 3 ? "Critical" : k < 8 ? "High" : "Medium";
      const status: ComplaintRecord["status"] = k < 4 ? "In Review" : k < 6 ? "Assigned" : "Resolved";
      const days = 5 + k * 6.5;
      const breached = k <= 3;
      addComplaint(
        instId,
        tpl[0],
        tpl[1],
        cat,
        sev,
        status,
        ucode,
        days,
        rng.choice(COMPLAINANT_TYPES),
        breached,
        k === 0 ? 1 : 0,
        0.85
      );
    }
  }

  // 4. Seven more Watch band institutions (ids 6..12)
  for (let idx = 5; idx < 12; idx++) {
    const instId = idx + 1;
    const count = 6 + (idx % 2);
    for (let k = 0; k < count; k++) {
      const cat = categoriesList[(idx + k) % categoriesList.length];
      const ucode = CATEGORY_TO_UNIT[cat];
      const tpl = TEMPLATES[cat][k % 2];
      const sev: ComplaintRecord["severity"] = k < 3 ? "High" : "Medium";
      const status: ComplaintRecord["status"] = k < 3 ? "Assigned" : "Resolved";
      const days = 8 + k * 10;
      addComplaint(
        instId,
        tpl[0],
        tpl[1],
        cat,
        sev,
        status,
        ucode,
        days,
        rng.choice(COMPLAINANT_TYPES),
        k === 0,
        0,
        0.78
      );
    }
  }

  // 5. Remaining 28 institutions (ids 13..40) -> Low band, totaling 320 complaints
  const openStatuses: ComplaintRecord["status"][] = [
    "New", "Assigned", "In Review", "Awaiting Institution", "Escalated"
  ];
  const closedStatuses: ComplaintRecord["status"][] = ["Resolved", "Closed"];

  for (let idx = 12; idx < institutions.length; idx++) {
    const instId = idx + 1;
    const count = idx < 36 ? 8 : 7;
    for (let k = 0; k < count; k++) {
      const cat = categoriesList[(idx * 2 + k) % categoriesList.length];
      const ucode = CATEGORY_TO_UNIT[cat];
      const tpl = TEMPLATES[cat][(idx + k) % TEMPLATES[cat].length];
      const days = 10 + ((idx * 13 + k * 19) % 108);
      const sev: ComplaintRecord["severity"] = k % 3 !== 0 ? "Low" : "Medium";
      const isOpen = k % 2 === 0 && days < 75;
      const status = isOpen
        ? openStatuses[(idx + k) % openStatuses.length]
        : closedStatuses[k % 2];
      addComplaint(
        instId,
        `${tpl[0]} (Batch ${2023 + (k % 3)} Sec ${String.fromCharCode(65 + (k % 4))})`,
        `${tpl[1]} Ref dossier ${instId}-${k}.`,
        cat,
        sev,
        status,
        ucode,
        days,
        rng.choice(COMPLAINANT_TYPES),
        false,
        0,
        0.75
      );
    }
  }

  dbState = {
    units,
    officers,
    institutions,
    complaints,
    case_events,
    case_links: [],
    alerts: [],
  };

  recomputeAllIntelligence(now);
  saveState();
  return dbState;
}

if (fs.existsSync(STATE_FILE)) {
  try {
    dbState = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    if (!dbState.institutions || dbState.institutions.length === 0) {
      createInitialSeed();
    }
  } catch {
    createInitialSeed();
  }
} else {
  createInitialSeed();
}

// Section 3: Roles and Permissions + Password Authentication (Strictly 4 Roles, no subroles)
export type UserRole = "chairman" | "bureau_head" | "case_officer" | "admin";
export type UnitCode = "AB" | "ACB" | "SGC" | "VC";

export interface RolePermissions {
  can_register_complaint: boolean;
  view_scope: "all_full" | "bureau_full" | "bureau_assigned_first" | "all_metadata_only";
  can_assign_officer: boolean;
  can_add_note: "none" | "own_bureau" | "assigned_only";
  status_transitions: "reopen_only" | "section_5_bureau" | "section_5_assigned" | "none";
  can_resolve_link_queue: "none" | "own_bureau" | "all";
  can_view_chairman_dashboard: boolean;
  can_view_bureau_dashboard: boolean;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  unit_code: UnitCode | null;
  officer_id: number | null;
  title: string;
  permissions: RolePermissions;
}

interface AccountRecord {
  id: number;
  email: string;
  password_hash: string;
  password_hint: string;
  name: string;
  role: UserRole;
  unit_code: UnitCode | null;
  officer_id: number | null;
  title: string;
}

function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(`lattice_salt_2026:${plain}`).digest("hex");
}

export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case "chairman":
      return {
        can_register_complaint: false,
        view_scope: "all_full",
        can_assign_officer: false,
        can_add_note: "none",
        status_transitions: "reopen_only",
        can_resolve_link_queue: "none",
        can_view_chairman_dashboard: true,
        can_view_bureau_dashboard: false,
      };
    case "bureau_head":
      return {
        can_register_complaint: true,
        view_scope: "bureau_full",
        can_assign_officer: true,
        can_add_note: "own_bureau",
        status_transitions: "section_5_bureau",
        can_resolve_link_queue: "own_bureau",
        can_view_chairman_dashboard: false,
        can_view_bureau_dashboard: true,
      };
    case "case_officer":
      return {
        can_register_complaint: true,
        view_scope: "bureau_assigned_first",
        can_assign_officer: false,
        can_add_note: "assigned_only",
        status_transitions: "section_5_assigned",
        can_resolve_link_queue: "none",
        can_view_chairman_dashboard: false,
        can_view_bureau_dashboard: false,
      };
    case "admin":
      return {
        can_register_complaint: false,
        view_scope: "all_metadata_only",
        can_assign_officer: true,
        can_add_note: "none",
        status_transitions: "none",
        can_resolve_link_queue: "all",
        can_view_chairman_dashboard: false,
        can_view_bureau_dashboard: false,
      };
  }
}

// Strictly 4 accounts corresponding to the 4 roles (Chairman, Bureau Head, Case Officer, Admin)
const ACCOUNTS: AccountRecord[] = [
  {
    id: 1,
    email: "chairman@aicte.gov.in",
    password_hash: hashPassword("Chairman@123"),
    password_hint: "Chairman@123",
    name: "Prof. Devendra Pratap Singh",
    role: "chairman",
    unit_code: null,
    officer_id: null,
    title: "Chairman",
  },
  {
    id: 2,
    email: "bureau_head@aicte.gov.in",
    password_hash: hashPassword("Bureau@123"),
    password_hint: "Bureau@123",
    name: "Dr. Rajeshwar Rao",
    role: "bureau_head",
    unit_code: null,
    officer_id: null,
    title: "Bureau Head",
  },
  {
    id: 3,
    email: "case_officer@aicte.gov.in",
    password_hash: hashPassword("Officer@123"),
    password_hint: "Officer@123",
    name: "Kavita Nair",
    role: "case_officer",
    unit_code: null,
    officer_id: 6,
    title: "Case Officer",
  },
  {
    id: 4,
    email: "admin@aicte.gov.in",
    password_hash: hashPassword("Admin@123"),
    password_hint: "Admin@123",
    name: "K. Subramanian",
    role: "admin",
    unit_code: null,
    officer_id: null,
    title: "Admin",
  },
];

// Ensure the Case Officer (id: 6, Kavita Nair) has key active cases assigned across the dataset
function ensureCaseOfficerAssignments() {
  const caseOfficer = dbState.officers.find((o) => o.id === 6);
  if (caseOfficer) {
    caseOfficer.name = "Kavita Nair";
    caseOfficer.title = "Case Officer";
  }
  let assignedCount = dbState.complaints.filter((c) => c.assigned_officer_id === 6).length;
  if (assignedCount < 15) {
    for (const c of dbState.complaints) {
      if (c.status !== "New" && c.id % 3 === 1) {
        c.assigned_officer_id = 6;
      }
    }
  }
}
ensureCaseOfficerAssignments();

function toSessionUser(acc: AccountRecord): SessionUser {
  return {
    id: acc.id,
    email: acc.email,
    name: acc.name,
    role: acc.role,
    unit_code: acc.unit_code,
    officer_id: acc.officer_id,
    title: acc.title,
    permissions: getRolePermissions(acc.role),
  };
}

// Section 5 Status Transition Matrix
const SECTION_5_TRANSITIONS: Record<ComplaintRecord["status"], ComplaintRecord["status"][]> = {
  New: ["Assigned", "In Review", "Escalated"],
  Assigned: ["In Review", "Awaiting Institution", "Escalated", "Resolved"],
  "In Review": ["Awaiting Institution", "Escalated", "Resolved"],
  "Awaiting Institution": ["In Review", "Escalated", "Resolved"],
  Escalated: ["In Review", "Awaiting Institution", "Resolved"],
  Resolved: ["Closed", "In Review"],
  Closed: ["In Review"],
};

export function getAllowedStatusTransitions(
  c: ComplaintRecord,
  _unitCode: UnitCode,
  user: SessionUser
): ComplaintRecord["status"][] {
  if (user.role === "admin") {
    return [];
  }
  if (user.role === "chairman") {
    // Chairman: reopen only
    if (c.status === "Resolved" || c.status === "Closed") {
      return ["In Review"];
    }
    return [];
  }
  if (user.role === "bureau_head") {
    return SECTION_5_TRANSITIONS[c.status] || [];
  }
  if (user.role === "case_officer") {
    // Case Officer: status transitions per Section 5 on assigned cases
    if (c.assigned_officer_id !== user.officer_id) return [];
    return SECTION_5_TRANSITIONS[c.status] || [];
  }
  return [];
}

const tokenStore = new Map<string, SessionUser>();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7).trim();
  const user = tokenStore.get(token);
  if (!user) {
    // Deterministic token recovery across server restarts (`acct_<id>_<random>`)
    if (token.startsWith("acct_")) {
      const parts = token.split("_");
      const accId = Number(parts[1]);
      const acc = ACCOUNTS.find((a) => a.id === accId);
      if (acc) {
        const u = toSessionUser(acc);
        tokenStore.set(token, u);
        (req as any).user = u;
        next();
        return;
      }
    }
    res.status(401).json({ detail: "Invalid or expired session token" });
    return;
  }
  (req as any).user = user;
  next();
}

function buildComplaintDetail(c: ComplaintRecord, currentUser: SessionUser, now: Date) {
  const { instScores, caseSlaMap } = recomputeAllIntelligence(now);
  const unitObj = dbState.units.find((u) => u.id === c.unit_id);
  const unitCode = (unitObj ? unitObj.code : "ACB") as UnitCode;
  const inst = dbState.institutions.find((i) => i.id === c.institution_id);
  const sla = caseSlaMap[c.id] || { sla_state: "ok", breach_probability: 0, elapsed_ratio: 0 };

  const isMetadataOnly = currentUser.role === "admin";

  const rawEvents = dbState.case_events
    .filter((ev) => ev.complaint_id === c.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id);

  // Section 3.1: Admin receives metadata only (redact investigation note bodies)
  const events = rawEvents.map((ev) => {
    if (isMetadataOnly && ev.type === "Note") {
      return {
        ...ev,
        message: "[Action note content redacted — Admin metadata-only access]",
        redacted: true,
      };
    }
    return {
      ...ev,
      redacted: false,
    };
  });

  const rawLinks = dbState.case_links
    .filter((lk) => lk.a_id === c.id || lk.b_id === c.id)
    .sort((a, b) => b.similarity - a.similarity);

  const linksOut = rawLinks
    .map((lk) => {
      const otherId = lk.a_id === c.id ? lk.b_id : lk.a_id;
      const oc = dbState.complaints.find((x) => x.id === otherId);
      if (!oc) return null;
      const ou = dbState.units.find((u) => u.id === oc.unit_id);
      return {
        id: oc.id,
        link_id: lk.id,
        ref: oc.ref,
        title: oc.title,
        unit_code: ou ? ou.code : "ACB",
        severity: oc.severity,
        status: oc.status,
        created_at: oc.created_at,
        type: lk.type,
        similarity: lk.similarity,
        resolution_status: lk.resolution_status || "pending",
        resolved_by: lk.resolved_by || null,
      };
    })
    .filter(Boolean);

  const clusterMembers = dbState.complaints.filter(
    (x) => x.institution_id === c.institution_id && x.cluster_id === c.cluster_id
  );

  // Determine exact allowed actions based on Section 3 Role Matrix
  const allowedActions: string[] = [];
  const isAssignedToMe =
    currentUser.officer_id !== null && c.assigned_officer_id === currentUser.officer_id;

  // Assign / reassign officer: Bureau Head (yes) or Admin (yes)
  if (currentUser.role === "admin" || currentUser.role === "bureau_head") {
    allowedActions.push("assign");
  }

  // Add action note: Bureau Head (yes) or Case Officer (assigned cases only)
  if (
    currentUser.role === "bureau_head" ||
    (currentUser.role === "case_officer" && isAssignedToMe)
  ) {
    allowedActions.push("note");
  }

  // Status transitions: Chairman (reopen only), Bureau Head (per section 5), Case Officer (per section 5 on assigned cases)
  const allowedTransitions = getAllowedStatusTransitions(c, unitCode, currentUser);
  if (allowedTransitions.length > 0) {
    allowedActions.push("status");
  }

  // Escalate is a status transition to "Escalated" per Section 5
  if (allowedTransitions.includes("Escalated")) {
    allowedActions.push("escalate");
  }

  // Resolve institution-link queue: Bureau Head (yes) or Admin (yes)
  if (currentUser.role === "admin" || currentUser.role === "bureau_head") {
    allowedActions.push("resolve_links");
  }

  const assignedOff = c.assigned_officer_id
    ? dbState.officers.find((o) => o.id === c.assigned_officer_id) || null
    : null;

  // Provide all available officers (putting Case Officer Kavita Nair first so assignment is easy to test)
  const unitOfficers = [...dbState.officers]
    .sort((a, b) => (a.id === 6 ? -1 : b.id === 6 ? 1 : a.id - b.id))
    .map((o) => ({ id: o.id, name: o.name, title: o.title }));

  const instRisk = instScores[c.institution_id] || { score: 0, band: "Low" };

  return {
    id: c.id,
    ref: c.ref,
    title: c.title,
    description: isMetadataOnly ? null : c.description,
    metadata_only: isMetadataOnly,
    category: c.category,
    severity: c.severity,
    status: c.status,
    unit_code: unitCode,
    unit_name: unitObj ? unitObj.name : unitCode,
    complainant_type: c.complainant_type,
    created_at: c.created_at,
    updated_at: c.updated_at,
    due_at: c.due_at,
    resolved_at: c.resolved_at,
    escalation_count: c.escalation_count,
    auto_confidence: c.auto_confidence,
    assigned_officer: assignedOff
      ? { id: assignedOff.id, name: assignedOff.name, title: assignedOff.title }
      : null,
    is_assigned_to_me: isAssignedToMe,
    unit_officers: unitOfficers,
    institution: inst
      ? {
          id: inst.id,
          name: inst.name,
          city: inst.city,
          state: inst.state,
          score: instRisk.score,
          band: instRisk.band,
        }
      : null,
    sla: {
      state: sla.sla_state,
      breach_probability: sla.breach_probability,
      elapsed_ratio: sla.elapsed_ratio,
      due_at: c.due_at,
    },
    cluster: {
      id: c.cluster_id,
      size: Math.max(1, clusterMembers.length),
    },
    links: linksOut,
    events,
    allowed_actions: allowedActions,
    allowed_status_transitions: allowedTransitions,
  };
}

const RULE_LABELS: Record<string, string> = {
  R1: "Risk Threshold",
  R2: "Cross-Cell Pattern",
  R3: "SLA Breach Risk",
  R4: "Duplicate Cluster",
};

async function startServer() {
  const app = express();
  app.use(express.json());

  // GET /api/auth/accounts (lists the 4 role accounts + password hints)
  app.get("/api/auth/accounts", (_req: Request, res: Response) => {
    res.json(
      ACCOUNTS.map((a) => ({
        email: a.email,
        password_hint: a.password_hint,
        name: a.name,
        role: a.role,
        unit_code: a.unit_code,
        title: a.title,
      }))
    );
  });

  // POST /api/auth/login (email + password authentication)
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ detail: "Email and password are required" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const acc = ACCOUNTS.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!acc || acc.password_hash !== hashPassword(String(password))) {
      res.status(401).json({ detail: "Invalid email or password" });
      return;
    }

    const user = toSessionUser(acc);
    const token = `acct_${acc.id}_${crypto.randomBytes(12).toString("hex")}`;
    tokenStore.set(token, user);
    res.json({ token, user });
  });

  // GET /api/me
  app.get("/api/me", requireAuth, (req: Request, res: Response) => {
    res.json((req as any).user);
  });

  // GET /api/units
  app.get("/api/units", requireAuth, (_req: Request, res: Response) => {
    const now = new Date();
    const out = dbState.units.map((u) => {
      const openComps = dbState.complaints.filter(
        (c) => c.unit_id === u.id && c.status !== "Resolved" && c.status !== "Closed"
      );
      const breachedCount = openComps.filter((c) => now > new Date(c.due_at)).length;
      const officers = dbState.officers
        .filter((o) => o.unit_id === u.id)
        .map((o) => ({ id: o.id, name: o.name, title: o.title, unit_code: u.code }));
      return {
        id: u.id,
        code: u.code,
        name: u.name,
        kind: u.kind,
        open_count: openComps.length,
        breached_count: breachedCount,
        officers,
      };
    });
    res.json(out);
  });

  // GET /api/overview
  // Chairman -> Chairman dashboard (yes)
  // Bureau Head -> Bureau dashboard (yes)
  // Case Officer / Admin -> 403 Forbidden (neither dashboard enabled)
  app.get("/api/overview", requireAuth, (req: Request, res: Response) => {
    const currentUser: SessionUser = (req as any).user;
    if (currentUser.role !== "chairman" && currentUser.role !== "bureau_head") {
      res.status(403).json({
        detail: "Dashboard access is restricted to Chairman (Chairman Dashboard) and Bureau Head (Bureau Dashboard) roles.",
      });
      return;
    }

    const now = new Date();
    const { instScores, caseSlaMap } = recomputeAllIntelligence(now);

    const unitCodeById: Record<number, UnitCode> = {};
    for (const u of dbState.units) {
      unitCodeById[u.id] = u.code;
    }

    const isBureauHead = currentUser.role === "bureau_head";
    const scopedComplaints = dbState.complaints;

    let openCount = 0;
    let atRiskCount = 0;
    let breachedCount = 0;
    let resolved30d = 0;
    const resDurations: number[] = [];

    const unitStats: Record<string, { code: UnitCode; open: number; at_risk: number; breached: number }> = {
      AB: { code: "AB", open: 0, at_risk: 0, breached: 0 },
      ACB: { code: "ACB", open: 0, at_risk: 0, breached: 0 },
      SGC: { code: "SGC", open: 0, at_risk: 0, breached: 0 },
      VC: { code: "VC", open: 0, at_risk: 0, breached: 0 },
    };

    const catCounts: Record<string, number> = {};

    for (const c of dbState.complaints) {
      const ucode = unitCodeById[c.unit_id] || "ACB";
      const sla = caseSlaMap[c.id];
      if (c.status !== "Resolved" && c.status !== "Closed") {
        unitStats[ucode].open++;
        if (sla?.sla_state === "at_risk") {
          unitStats[ucode].at_risk++;
        } else if (sla?.sla_state === "breached") {
          unitStats[ucode].breached++;
          unitStats[ucode].at_risk++;
        }
      }
    }

    for (const c of scopedComplaints) {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
      const sla = caseSlaMap[c.id];
      if (c.status !== "Resolved" && c.status !== "Closed") {
        openCount++;
        if (sla?.sla_state === "at_risk") {
          atRiskCount++;
        } else if (sla?.sla_state === "breached") {
          breachedCount++;
        }
      } else if (c.resolved_at) {
        const resDt = new Date(c.resolved_at);
        const createdDt = new Date(c.created_at);
        if ((now.getTime() - resDt.getTime()) / (1000 * 86400) <= 30) {
          resolved30d++;
        }
        resDurations.push(Math.max(0.5, (resDt.getTime() - createdDt.getTime()) / (1000 * 86400)));
      }
    }

    const avgResDays =
      resDurations.length > 0
        ? Math.round((resDurations.reduce((a, b) => a + b, 0) / resDurations.length) * 10) / 10
        : 6.4;

    const highRiskInsts = Object.values(instScores).filter((r) => r.score >= 60).length;

    const pendingLinksCount = dbState.case_links.filter(
      (lk) => (lk.resolution_status || "pending") === "pending"
    ).length;

    const trend: Array<{ week_start: string; AB: number; ACB: number; SGC: number; VC: number }> = [];
    for (let w = 11; w >= 0; w--) {
      const wend = new Date(now.getTime() - w * 7 * 86400 * 1000);
      const wstart = new Date(wend.getTime() - 7 * 86400 * 1000);
      const row = {
        week_start: wstart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        AB: 0,
        ACB: 0,
        SGC: 0,
        VC: 0,
      };
      for (const c of dbState.complaints) {
        const cdt = new Date(c.created_at);
        if (cdt >= wstart && cdt < wend) {
          const ucode = unitCodeById[c.unit_id] || "ACB";
          row[ucode]++;
        }
      }
      trend.push(row);
    }

    // Officer workload breakdown for Bureau Dashboard
    const officerWorkload = isBureauHead
      ? [...dbState.officers]
          .sort((a, b) => (a.id === 6 ? -1 : b.id === 6 ? 1 : a.id - b.id))
          .map((o) => {
            const assignedComps = scopedComplaints.filter((c) => c.assigned_officer_id === o.id);
            const openAssigned = assignedComps.filter(
              (c) => c.status !== "Resolved" && c.status !== "Closed"
            );
            const atRiskAssigned = openAssigned.filter((c) => {
              const s = caseSlaMap[c.id]?.sla_state;
              return s === "at_risk" || s === "breached";
            });
            const res30Assigned = assignedComps.filter(
              (c) =>
                (c.status === "Resolved" || c.status === "Closed") &&
                c.resolved_at &&
                (now.getTime() - new Date(c.resolved_at).getTime()) / (1000 * 86400) <= 30
            );
            return {
              id: o.id,
              name: o.name,
              title: o.title,
              assigned_open: openAssigned.length,
              at_risk: atRiskAssigned.length,
              resolved_30d: res30Assigned.length,
            };
          })
      : undefined;

    const watchlist = dbState.institutions
      .map((inst) => {
        const rdata = instScores[inst.id];
        const openInst = scopedComplaints.filter(
          (c) => c.institution_id === inst.id && c.status !== "Resolved" && c.status !== "Closed"
        ).length;
        return {
          id: inst.id,
          name: inst.name,
          city: inst.city,
          state: inst.state,
          score: rdata?.score || 0,
          band: rdata?.band || "Low",
          open_cases: openInst,
          sparkline: rdata?.sparkline || Array(12).fill(0),
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 6);

    const recentAlerts = dbState.alerts
      .filter((a) => !a.acknowledged)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id)
      .slice(0, 6)
      .map((a) => ({
        ...a,
        rule_label: RULE_LABELS[a.rule] || a.rule,
      }));

    const categorySplit = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      dashboard_type: isBureauHead ? "bureau" : "chairman",
      unit_code: null,
      unit_name: "Bureau Operations",
      stats: {
        open: openCount,
        at_risk: atRiskCount,
        breached: breachedCount,
        high_risk_institutions: highRiskInsts,
        resolved_30d: resolved30d,
        avg_resolution_days: avgResDays,
        pending_links: pendingLinksCount,
      },
      trend,
      unit_workload: Object.values(unitStats),
      officer_workload: officerWorkload,
      category_split: categorySplit,
      watchlist,
      recent_alerts: recentAlerts,
    });
  });

  // GET /api/complaints
  // View case list rules:
  // - chairman: full
  // - bureau_head: full
  // - case_officer: full (assigned cases first)
  // - admin: metadata only (see 3.1)
  app.get("/api/complaints", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const { caseSlaMap } = recomputeAllIntelligence(now);

    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const severity = typeof req.query.severity === "string" ? req.query.severity : "";
    const unitQuery = typeof req.query.unit === "string" ? req.query.unit : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const institutionId = req.query.institution_id ? Number(req.query.institution_id) : null;
    const sla = typeof req.query.sla === "string" ? req.query.sla : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "created_desc";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 15));

    const unitCodeById: Record<number, UnitCode> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const officerNameById: Record<number, string> = {};
    for (const o of dbState.officers) officerNameById[o.id] = o.name;

    const instById: Record<number, InstitutionRecord> = {};
    for (const inst of dbState.institutions) instById[inst.id] = inst;

    const clusterCounts: Record<string, number> = {};
    for (const c of dbState.complaints) {
      if (c.cluster_id !== null) {
        const key = `${c.institution_id}:${c.cluster_id}`;
        clusterCounts[key] = (clusterCounts[key] || 0) + 1;
      }
    }

    const sevRank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const isMetadataOnly = currentUser.role === "admin";

    const filtered = dbState.complaints
      .filter((c) => {
        const ucode = unitCodeById[c.unit_id] || "ACB";
        const inst = instById[c.institution_id];
        const slaInfo = caseSlaMap[c.id];
        if (q) {
          const hay = isMetadataOnly
            ? `${c.ref} ${c.title} ${inst ? inst.name : ""} ${c.category}`.toLowerCase()
            : `${c.ref} ${c.title} ${c.description} ${inst ? inst.name : ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (status && c.status !== status) return false;
        if (severity && c.severity !== severity) return false;
        if (unitQuery && ucode !== unitQuery) return false;
        if (category && c.category !== category) return false;
        if (institutionId && c.institution_id !== institutionId) return false;
        if (sla && slaInfo?.sla_state !== sla) return false;
        return true;
      })
      .map((c) => {
        const inst = instById[c.institution_id];
        const slaInfo = caseSlaMap[c.id] || { sla_state: "ok", breach_probability: 0 };
        const clusterSize = clusterCounts[`${c.institution_id}:${c.cluster_id}`] || 1;
        const isAssignedToMe =
          currentUser.officer_id !== null && c.assigned_officer_id === currentUser.officer_id;
        return {
          id: c.id,
          ref: c.ref,
          title: c.title,
          institution: inst ? { id: inst.id, name: inst.name } : { id: 0, name: "Unknown" },
          category: c.category,
          severity: c.severity,
          status: c.status,
          unit_code: unitCodeById[c.unit_id] || "ACB",
          assigned_officer_id: c.assigned_officer_id,
          assigned_officer_name: c.assigned_officer_id
            ? officerNameById[c.assigned_officer_id] || null
            : null,
          is_assigned_to_me: isAssignedToMe,
          metadata_only: isMetadataOnly,
          created_at: c.created_at,
          due_at: c.due_at,
          sla_state: slaInfo.sla_state,
          breach_probability: slaInfo.breach_probability,
          cluster_size: clusterSize,
          _createdMs: new Date(c.created_at).getTime(),
          _dueMs: new Date(c.due_at).getTime(),
          _sevRank: sevRank[c.severity] || 1,
          _assignedRank: isAssignedToMe ? 1 : 0,
        };
      });

    // Case Officer: always sort assigned cases first, then by selected sort order
    filtered.sort((a, b) => {
      if (currentUser.role === "case_officer" && a._assignedRank !== b._assignedRank) {
        return b._assignedRank - a._assignedRank;
      }
      if (sort === "due_asc") {
        return a._dueMs - b._dueMs;
      }
      if (sort === "severity_desc") {
        return b._sevRank - a._sevRank || b._createdMs - a._createdMs;
      }
      return b._createdMs - a._createdMs;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered
      .slice(start, start + pageSize)
      .map(({ _createdMs, _dueMs, _sevRank, _assignedRank, ...rest }) => rest);

    res.json({
      items,
      total,
      page,
      page_size: pageSize,
      metadata_only: isMetadataOnly,
    });
  });

  // POST /api/complaints/analyze
  app.post("/api/complaints/analyze", requireAuth, (req: Request, res: Response) => {
    const currentUser: SessionUser = (req as any).user;
    if (!currentUser.permissions.can_register_complaint) {
      res.status(403).json({
        detail: "Only Bureau Head and Case Officer roles are permitted to register complaints.",
      });
      return;
    }

    const now = new Date();
    const {
      institution_id,
      title = "",
      description = "",
      category: overrideCategory,
      unit_code: overrideUnitCode,
      severity: overrideSeverity,
    } = req.body || {};
    const inst = dbState.institutions.find((i) => i.id === Number(institution_id));
    if (!inst) {
      res.status(404).json({ detail: "Institution not found" });
      return;
    }

    const autoClass = classifyComplaint(title, description);
    const autoSeverity = detectSeverity(title, description);

    const category =
      overrideCategory && CATEGORY_TO_UNIT[overrideCategory]
        ? overrideCategory
        : autoClass.category;
    const validUnits = new Set<string>(["AB", "ACB", "SGC", "VC"]);
    const unit_code: UnitCode =
      overrideUnitCode && validUnits.has(overrideUnitCode)
        ? (overrideUnitCode as UnitCode)
        : CATEGORY_TO_UNIT[category] || autoClass.unit_code;
    const confidence = autoClass.confidence;
    const severity = detectSeverity(title, description, overrideSeverity);

    const unitCodeById: Record<number, string> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const existingComps = dbState.complaints.filter((c) => c.institution_id === inst.id);
    const cDicts = existingComps.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      unit_code: unitCodeById[c.unit_id] || "ACB",
      severity: c.severity,
      status: c.status,
      created_at: new Date(c.created_at),
      due_at: new Date(c.due_at),
      resolved_at: c.resolved_at ? new Date(c.resolved_at) : null,
    }));

    const { clusterMap: curClusters } = computeInstitutionLinks(cDicts);
    const curCounts: Record<number, number> = {};
    for (const clId of Object.values(curClusters)) curCounts[clId] = (curCounts[clId] || 0) + 1;
    const curSizes: Record<number, number> = {};
    for (const [cid, clId] of Object.entries(curClusters)) curSizes[Number(cid)] = curCounts[clId] || 1;
    const curRisk = computeInstitutionRisk(cDicts, curSizes, now);

    const tempId = 999999;
    const projDicts = [
      ...cDicts,
      {
        id: tempId,
        title,
        description,
        unit_code,
        severity,
        status: "New",
        created_at: now,
        due_at: computeDueAt(now, severity),
        resolved_at: null,
      },
    ];
    const { links: projLinks, clusterMap: projClusters } = computeInstitutionLinks(projDicts);
    const projCounts: Record<number, number> = {};
    for (const clId of Object.values(projClusters)) projCounts[clId] = (projCounts[clId] || 0) + 1;
    const projSizes: Record<number, number> = {};
    for (const [cid, clId] of Object.entries(projClusters)) projSizes[Number(cid)] = projCounts[clId] || 1;
    const projRisk = computeInstitutionRisk(projDicts, projSizes, now);

    const matchedLinks = projLinks
      .filter((lk) => lk.a_id === tempId || lk.b_id === tempId)
      .sort((a, b) => b.similarity - a.similarity)
      .map((lk) => {
        const otherId = lk.a_id === tempId ? lk.b_id : lk.a_id;
        const oc = existingComps.find((c) => c.id === otherId);
        if (!oc) return null;
        return {
          id: oc.id,
          ref: oc.ref,
          title: oc.title,
          unit_code: unitCodeById[oc.unit_id] || "ACB",
          severity: oc.severity,
          status: oc.status,
          type: lk.type,
          similarity: lk.similarity,
        };
      })
      .filter(Boolean);

    const hasDupOrSim = matchedLinks.some((l: any) => l.type === "Duplicate" || l.type === "Similar");
    const minJump = hasDupOrSim ? 3 : matchedLinks.length > 0 ? 2 : 1;
    const projectedScore = Math.min(100, Math.max(curRisk.score + minJump, projRisk.score));
    const bandAfter = getRiskBand(projectedScore);

    res.json({
      category,
      confidence,
      unit_code,
      severity,
      auto_category: autoClass.category,
      auto_unit_code: autoClass.unit_code,
      auto_severity: autoSeverity,
      links: matchedLinks,
      projected_risk: {
        current: curRisk.score,
        projected: projectedScore,
        delta: projectedScore - curRisk.score,
        band_before: curRisk.band,
        band_after: bandAfter,
      },
    });
  });

  // POST /api/complaints
  // Register complaint: Chairman = no, Bureau Head = yes, Case Officer = yes, Admin = no
  app.post("/api/complaints", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    if (!currentUser.permissions.can_register_complaint) {
      res.status(403).json({
        detail: "Permission denied: Only Bureau Head and Case Officer roles may register complaints.",
      });
      return;
    }

    const {
      institution_id,
      title,
      description,
      complainant_type = "Student",
      category: overrideCategory,
      unit_code: overrideUnitCode,
      severity: overrideSeverity,
    } = req.body || {};

    const inst = dbState.institutions.find((i) => i.id === Number(institution_id));
    if (!inst) {
      res.status(404).json({ detail: "Institution not found" });
      return;
    }
    if (!title || !description) {
      res.status(400).json({ detail: "Title and description are required" });
      return;
    }

    const autoClass = classifyComplaint(title, description);
    const category =
      overrideCategory && CATEGORY_TO_UNIT[overrideCategory]
        ? overrideCategory
        : autoClass.category;
    const validUnits = new Set<string>(["AB", "ACB", "SGC", "VC"]);
    const unitCode: UnitCode =
      overrideUnitCode && validUnits.has(overrideUnitCode)
        ? (overrideUnitCode as UnitCode)
        : CATEGORY_TO_UNIT[category] || autoClass.unit_code;
    const severity = detectSeverity(title, description, overrideSeverity);

    const unitObj = dbState.units.find((u) => u.code === unitCode) || dbState.units[0];
    const nextId = dbState.complaints.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    const ref = `AICTE-2026-${String(nextId).padStart(5, "0")}`;
    const finalSeverity =
      !overrideSeverity && inst.id === 1 && category === "Fee and Refund" ? "Critical" : severity;
    const dueAt = computeDueAt(now, finalSeverity);

    // If filed by a Case Officer, auto-assign to them
    const autoAssignedOfficerId =
      currentUser.role === "case_officer" ? currentUser.officer_id : null;

    const newComp: ComplaintRecord = {
      id: nextId,
      ref,
      institution_id: inst.id,
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      severity: finalSeverity,
      status: autoAssignedOfficerId ? "Assigned" : "New",
      unit_id: unitObj.id,
      assigned_officer_id: autoAssignedOfficerId,
      complainant_type,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      due_at: dueAt.toISOString(),
      resolved_at: null,
      escalation_count: 0,
      auto_confidence: autoClass.confidence,
      cluster_id: nextId,
    };

    dbState.complaints.push(newComp);

    let nextEvId = dbState.case_events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    dbState.case_events.push({
      id: nextEvId++,
      complaint_id: newComp.id,
      type: "Created",
      actor: `${currentUser.name} (${complainant_type} Intake)`,
      message: `Complaint registered by ${currentUser.name} (${complainant_type} intake) against ${inst.name}.`,
      created_at: now.toISOString(),
    });
    const isManualRoute = Boolean(overrideCategory || overrideUnitCode);
    dbState.case_events.push({
      id: nextEvId++,
      complaint_id: newComp.id,
      type: "Routed",
      actor: isManualRoute ? `${currentUser.name} (Intake Override)` : "Intelligence Engine",
      message: isManualRoute
        ? `Assigned as ${category} and routed to ${unitObj.name} (${unitCode}) during intake.`
        : `Classified as ${category} (${Math.round(autoClass.confidence * 100)}% confidence) and routed to ${unitObj.name} (${unitCode}).`,
      created_at: now.toISOString(),
    });

    recomputeAllIntelligence(now);

    const linkedCases = dbState.case_links.filter(
      (lk) => lk.a_id === newComp.id || lk.b_id === newComp.id
    );
    if (linkedCases.length > 0) {
      dbState.case_events.push({
        id: nextEvId++,
        complaint_id: newComp.id,
        type: "Linked",
        actor: "Intelligence Engine",
        message: `Cross-cell linking connected this complaint to ${linkedCases.length} related case(s) at ${inst.name}.`,
        created_at: now.toISOString(),
      });
    }

    saveState();
    res.json(buildComplaintDetail(newComp, currentUser, now));
  });

  // GET /api/complaints/:id
  // View case detail rules:
  // - chairman: full
  // - bureau_head: full
  // - case_officer: full
  // - admin: metadata only
  app.get("/api/complaints/:id", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const id = Number(req.params.id);
    const comp = dbState.complaints.find((c) => c.id === id);
    if (!comp) {
      res.status(404).json({ detail: "Complaint not found" });
      return;
    }

    res.json(buildComplaintDetail(comp, currentUser, now));
  });

  // PATCH /api/complaints/:id
  // Enforces:
  // - Assign / reassign officer: Bureau Head (yes) or Admin (yes)
  // - Add action note: Bureau Head (yes) or Case Officer (assigned cases only)
  // - Status transitions: Chairman (reopen only), Bureau Head (per section 5), Case Officer (per section 5 on assigned cases), Admin (none)
  app.patch("/api/complaints/:id", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const id = Number(req.params.id);
    const comp = dbState.complaints.find((c) => c.id === id);
    if (!comp) {
      res.status(404).json({ detail: "Complaint not found" });
      return;
    }

    const unitObj = dbState.units.find((u) => u.id === comp.unit_id);
    const unitCode = (unitObj ? unitObj.code : "ACB") as UnitCode;
    const isAssignedToMe =
      currentUser.officer_id !== null && comp.assigned_officer_id === currentUser.officer_id;

    const { status, assigned_officer_id, note } = req.body || {};
    let nextEvId = dbState.case_events.reduce((m, e) => Math.max(m, e.id), 0) + 1;

    // 1. Assign / reassign officer check
    if (assigned_officer_id !== undefined && assigned_officer_id !== null) {
      const canAssign = currentUser.role === "admin" || currentUser.role === "bureau_head";
      if (!canAssign) {
        res.status(403).json({
          detail: "Permission denied: Only Bureau Head or Admin may assign or reassign officers.",
        });
        return;
      }

      const off = dbState.officers.find((o) => o.id === Number(assigned_officer_id));
      if (!off) {
        res.status(400).json({ detail: "Officer not found" });
        return;
      }
      comp.assigned_officer_id = off.id;
      if (comp.status === "New") comp.status = "Assigned";
      dbState.case_events.push({
        id: nextEvId++,
        complaint_id: comp.id,
        type: "Assigned",
        actor: currentUser.name,
        message: `Assigned case to ${off.name} (${off.title}).`,
        created_at: now.toISOString(),
      });
    }

    // 2. Status transition check
    if (status && status !== comp.status) {
      const allowedTransitions = getAllowedStatusTransitions(comp, unitCode, currentUser);
      if (!allowedTransitions.includes(status)) {
        const reason =
          currentUser.role === "chairman"
            ? "Chairman can only reopen Resolved or Closed cases."
            : currentUser.role === "admin"
            ? "Admin role cannot perform status transitions."
            : currentUser.role === "case_officer" && !isAssignedToMe
            ? "Case Officer can only transition status on cases assigned to them."
            : `Transition from ${comp.status} to ${status} is not permitted under Section 5 rules.`;
        res.status(403).json({ detail: reason });
        return;
      }

      const prev = comp.status;
      comp.status = status;
      if (status === "Resolved" || status === "Closed") {
        comp.resolved_at = now.toISOString();
      } else if (prev === "Resolved" || prev === "Closed") {
        comp.resolved_at = null;
      }
      const isReopen = (prev === "Resolved" || prev === "Closed") && status === "In Review";
      dbState.case_events.push({
        id: nextEvId++,
        complaint_id: comp.id,
        type: "StatusChanged",
        actor: currentUser.name,
        message: isReopen
          ? `Case reopened from ${prev} to ${status} by ${currentUser.name}.`
          : `Status transitioned from ${prev} to ${status}.`,
        created_at: now.toISOString(),
      });
    }

    // 3. Add action note check
    if (note && String(note).trim()) {
      const canNote =
        currentUser.role === "bureau_head" ||
        (currentUser.role === "case_officer" && isAssignedToMe);
      if (!canNote) {
        res.status(403).json({
          detail:
            currentUser.role === "case_officer"
              ? "Permission denied: Case Officers may only add action notes to cases assigned to them."
              : "Permission denied: Only Bureau Head or assigned Case Officer may add action notes.",
        });
        return;
      }

      dbState.case_events.push({
        id: nextEvId++,
        complaint_id: comp.id,
        type: "Note",
        actor: currentUser.name,
        message: String(note).trim(),
        created_at: now.toISOString(),
      });
    }

    comp.updated_at = now.toISOString();
    recomputeAllIntelligence(now);
    saveState();
    res.json(buildComplaintDetail(comp, currentUser, now));
  });

  // POST /api/complaints/:id/escalate
  app.post("/api/complaints/:id/escalate", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const id = Number(req.params.id);
    const comp = dbState.complaints.find((c) => c.id === id);
    if (!comp) {
      res.status(404).json({ detail: "Complaint not found" });
      return;
    }

    const unitObj = dbState.units.find((u) => u.id === comp.unit_id);
    const unitCode = (unitObj ? unitObj.code : "ACB") as UnitCode;
    const allowedTransitions = getAllowedStatusTransitions(comp, unitCode, currentUser);
    if (!allowedTransitions.includes("Escalated")) {
      res.status(403).json({
        detail: "Permission denied: Your role cannot escalate this case from its current state.",
      });
      return;
    }

    comp.status = "Escalated";
    comp.escalation_count = (comp.escalation_count || 0) + 1;
    comp.updated_at = now.toISOString();

    const inst = dbState.institutions.find((i) => i.id === comp.institution_id);
    const nextEvId = dbState.case_events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    dbState.case_events.push({
      id: nextEvId,
      complaint_id: comp.id,
      type: "Escalated",
      actor: currentUser.name,
      message: `Case escalated (level ${comp.escalation_count}) for priority cross-bureau intervention.`,
      created_at: now.toISOString(),
    });

    const nextAlertId = dbState.alerts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    dbState.alerts.push({
      id: nextAlertId,
      rule: "R3",
      severity: comp.severity === "Critical" || comp.severity === "High" ? "High" : "Medium",
      institution_id: comp.institution_id,
      complaint_id: comp.id,
      message: `Case ${comp.ref} (${inst ? inst.name : "Institution"}) escalated by ${currentUser.name}.`,
      created_at: now.toISOString(),
      acknowledged: false,
      acknowledged_by: null,
    });

    recomputeAllIntelligence(now);
    saveState();
    res.json(buildComplaintDetail(comp, currentUser, now));
  });

  // GET /api/link-queue
  // Resolve institution-link queue:
  // - chairman: no
  // - bureau_head: yes
  // - case_officer: no
  // - admin: yes
  app.get("/api/link-queue", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    recomputeAllIntelligence(now);

    const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending";
    const unitCodeById: Record<number, UnitCode> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const instById: Record<number, InstitutionRecord> = {};
    for (const i of dbState.institutions) instById[i.id] = i;

    const compById: Record<number, ComplaintRecord> = {};
    for (const c of dbState.complaints) compById[c.id] = c;

    const canResolve =
      currentUser.role === "admin" || currentUser.role === "bureau_head";

    const items = dbState.case_links
      .map((lk) => {
        const ca = compById[lk.a_id];
        const cb = compById[lk.b_id];
        const inst = instById[lk.institution_id];
        if (!ca || !cb || !inst) return null;

        const ua = unitCodeById[ca.unit_id] || "ACB";
        const ub = unitCodeById[cb.unit_id] || "ACB";

        const resStatus = lk.resolution_status || "pending";
        if (statusFilter === "pending" && resStatus !== "pending") return null;
        if (statusFilter === "resolved" && resStatus === "pending") return null;

        return {
          id: lk.id,
          institution: {
            id: inst.id,
            name: inst.name,
            city: inst.city,
            state: inst.state,
          },
          type: lk.type,
          similarity: lk.similarity,
          resolution_status: resStatus,
          resolved_by: lk.resolved_by || null,
          resolved_at: lk.resolved_at || null,
          case_a: {
            id: ca.id,
            ref: ca.ref,
            title: ca.title,
            unit_code: ua,
            severity: ca.severity,
            status: ca.status,
            created_at: ca.created_at,
          },
          case_b: {
            id: cb.id,
            ref: cb.ref,
            title: cb.title,
            unit_code: ub,
            severity: cb.severity,
            status: cb.status,
            created_at: cb.created_at,
          },
          can_resolve: canResolve,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.similarity - a.similarity);

    res.json(items);
  });

  // POST /api/link-queue/:id/resolve
  app.post("/api/link-queue/:id/resolve", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const linkId = Number(req.params.id);
    const { resolution } = req.body || {};

    if (resolution !== "confirmed" && resolution !== "dismissed") {
      res.status(400).json({ detail: "resolution must be 'confirmed' or 'dismissed'" });
      return;
    }

    const lk = dbState.case_links.find((x) => x.id === linkId);
    if (!lk) {
      res.status(404).json({ detail: "Institution-link item not found" });
      return;
    }

    const unitCodeById: Record<number, UnitCode> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const ca = dbState.complaints.find((c) => c.id === lk.a_id);
    const cb = dbState.complaints.find((c) => c.id === lk.b_id);
    const inst = dbState.institutions.find((i) => i.id === lk.institution_id);
    if (!ca || !cb || !inst) {
      res.status(404).json({ detail: "Linked complaints not found" });
      return;
    }

    const ua = unitCodeById[ca.unit_id] || "ACB";
    const ub = unitCodeById[cb.unit_id] || "ACB";

    const canResolve =
      currentUser.role === "admin" || currentUser.role === "bureau_head";

    if (!canResolve) {
      res.status(403).json({
        detail: "Permission denied: Only Bureau Head or Admin may resolve the institution-link queue.",
      });
      return;
    }

    lk.resolution_status = resolution;
    lk.resolved_by = currentUser.name;
    lk.resolved_at = now.toISOString();

    let nextEvId = dbState.case_events.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    dbState.case_events.push({
      id: nextEvId++,
      complaint_id: ca.id,
      type: "Linked",
      actor: currentUser.name,
      message: `Institution-link with ${cb.ref} (${lk.type}, ${Math.round(lk.similarity * 100)}% similarity) marked as ${resolution} by ${currentUser.name}.`,
      created_at: now.toISOString(),
    });
    dbState.case_events.push({
      id: nextEvId++,
      complaint_id: cb.id,
      type: "Linked",
      actor: currentUser.name,
      message: `Institution-link with ${ca.ref} (${lk.type}, ${Math.round(lk.similarity * 100)}% similarity) marked as ${resolution} by ${currentUser.name}.`,
      created_at: now.toISOString(),
    });

    saveState();

    res.json({
      id: lk.id,
      institution: {
        id: inst.id,
        name: inst.name,
        city: inst.city,
        state: inst.state,
      },
      type: lk.type,
      similarity: lk.similarity,
      resolution_status: lk.resolution_status,
      resolved_by: lk.resolved_by,
      resolved_at: lk.resolved_at,
      case_a: {
        id: ca.id,
        ref: ca.ref,
        title: ca.title,
        unit_code: ua,
        severity: ca.severity,
        status: ca.status,
        created_at: ca.created_at,
      },
      case_b: {
        id: cb.id,
        ref: cb.ref,
        title: cb.title,
        unit_code: ub,
        severity: cb.severity,
        status: cb.status,
        created_at: cb.created_at,
      },
      can_resolve: true,
    });
  });

  // GET /api/institutions
  app.get("/api/institutions", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const { instScores } = recomputeAllIntelligence(now);

    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const band = typeof req.query.band === "string" ? req.query.band : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "score_desc";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.page_size) || 12));

    const openByInst: Record<number, number> = {};
    for (const c of dbState.complaints) {
      if (c.status !== "Resolved" && c.status !== "Closed") {
        openByInst[c.institution_id] = (openByInst[c.institution_id] || 0) + 1;
      }
    }

    const filtered = dbState.institutions
      .map((inst) => {
        const rdata = instScores[inst.id] || {
          score: 0,
          band: "Low" as const,
          total_90d: 0,
          sparkline: Array(12).fill(0),
        };
        return {
          id: inst.id,
          name: inst.name,
          city: inst.city,
          state: inst.state,
          type: inst.type,
          established_year: inst.established_year,
          intake: inst.intake,
          score: rdata.score,
          band: rdata.band,
          open_cases: openByInst[inst.id] || 0,
          total_90d: rdata.total_90d,
          sparkline: rdata.sparkline,
        };
      })
      .filter((item) => {
        if (q) {
          const hay = `${item.name} ${item.city} ${item.state} ${item.type}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (band && band !== "All" && item.band !== band) return false;
        return true;
      });

    if (sort === "name_asc") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    res.json({
      items: filtered.slice(start, start + pageSize),
      total,
      page,
      page_size: pageSize,
    });
  });

  // GET /api/institutions/:id
  app.get("/api/institutions/:id", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const currentUser: SessionUser = (req as any).user;
    const id = Number(req.params.id);
    const inst = dbState.institutions.find((i) => i.id === id);
    if (!inst) {
      res.status(404).json({ detail: "Institution not found" });
      return;
    }

    const { instScores, caseSlaMap } = recomputeAllIntelligence(now);
    const rdata = instScores[inst.id];
    const unitCodeById: Record<number, UnitCode> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const allInstComplaints = dbState.complaints
      .filter((c) => c.institution_id === inst.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Scope case list on institution dossier for Bureau Head / Case Officer to own bureau
    const enforceOwnBureau =
      currentUser.role === "bureau_head" || currentUser.role === "case_officer";
    const visibleComplaints = enforceOwnBureau
      ? allInstComplaints.filter((c) => unitCodeById[c.unit_id] === currentUser.unit_code)
      : allInstComplaints;

    const unitsInvolved = Array.from(
      new Set(allInstComplaints.map((c) => unitCodeById[c.unit_id] || "ACB"))
    ).sort();
    const recent30 = allInstComplaints.filter(
      (c) => (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 86400) <= 30
    );
    const recentUnits = new Set(recent30.map((c) => unitCodeById[c.unit_id] || "ACB"));
    const dupCount = dbState.case_links.filter(
      (lk) => lk.institution_id === inst.id && lk.type === "Duplicate"
    ).length;

    let patternSummary: string | null = null;
    if (rdata.score >= 60) {
      const dupClause = dupCount > 0 ? `; ${dupCount * 2} cases form near-duplicate clusters` : "";
      patternSummary = `${recent30.length} complaints across ${recentUnits.size} units in 26 days${dupClause}.`;
    }

    const complaintsOut = visibleComplaints.map((c) => {
      const sla = caseSlaMap[c.id] || { sla_state: "ok", breach_probability: 0 };
      return {
        id: c.id,
        ref: c.ref,
        title: c.title,
        category: c.category,
        severity: c.severity,
        status: c.status,
        unit_code: unitCodeById[c.unit_id] || "ACB",
        created_at: c.created_at,
        due_at: c.due_at,
        sla_state: sla.sla_state,
        breach_probability: sla.breach_probability,
      };
    });

    res.json({
      id: inst.id,
      name: inst.name,
      city: inst.city,
      state: inst.state,
      type: inst.type,
      established_year: inst.established_year,
      intake: inst.intake,
      score: rdata.score,
      band: rdata.band,
      pattern_summary: patternSummary,
      factors: rdata.factors,
      history: rdata.history,
      sparkline: rdata.sparkline,
      units_involved: unitsInvolved,
      complaints: complaintsOut,
    });
  });

  // GET /api/institutions/:id/graph
  app.get("/api/institutions/:id/graph", requireAuth, (req: Request, res: Response) => {
    const now = new Date();
    const id = Number(req.params.id);
    const inst = dbState.institutions.find((i) => i.id === id);
    if (!inst) {
      res.status(404).json({ detail: "Institution not found" });
      return;
    }

    recomputeAllIntelligence(now);
    const unitCodeById: Record<number, string> = {};
    for (const u of dbState.units) unitCodeById[u.id] = u.code;

    const nodes = dbState.complaints
      .filter((c) => c.institution_id === inst.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((c) => ({
        id: c.id,
        ref: c.ref,
        title: c.title,
        unit_code: unitCodeById[c.unit_id] || "ACB",
        severity: c.severity,
        status: c.status,
        created_at: c.created_at,
      }));

    const edges = dbState.case_links
      .filter((lk) => lk.institution_id === inst.id && lk.resolution_status !== "dismissed")
      .map((lk) => ({
        source: lk.a_id,
        target: lk.b_id,
        type: lk.type,
        similarity: lk.similarity,
      }));

    res.json({ nodes, edges });
  });

  // GET /api/alerts
  app.get("/api/alerts", requireAuth, (req: Request, res: Response) => {
    const state = typeof req.query.state === "string" ? req.query.state : "open";
    const instNameById: Record<number, string> = {};
    for (const i of dbState.institutions) instNameById[i.id] = i.name;
    const compRefById: Record<number, string> = {};
    for (const c of dbState.complaints) compRefById[c.id] = c.ref;

    const alerts = dbState.alerts
      .filter((a) => {
        if (state === "open") return !a.acknowledged;
        if (state === "acknowledged") return a.acknowledged;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id)
      .map((a) => ({
        ...a,
        rule_label: RULE_LABELS[a.rule] || a.rule,
        institution_name: a.institution_id ? instNameById[a.institution_id] || null : null,
        complaint_ref: a.complaint_id ? compRefById[a.complaint_id] || null : null,
      }));

    res.json(alerts);
  });

  // POST /api/alerts/:id/acknowledge
  app.post("/api/alerts/:id/acknowledge", requireAuth, (req: Request, res: Response) => {
    const currentUser: SessionUser = (req as any).user;
    if (currentUser.role !== "chairman" && currentUser.role !== "bureau_head") {
      res.status(403).json({ detail: "Only Chairman or Bureau Head can acknowledge alerts" });
      return;
    }
    const id = Number(req.params.id);
    const alert = dbState.alerts.find((a) => a.id === id);
    if (!alert) {
      res.status(404).json({ detail: "Alert not found" });
      return;
    }
    alert.acknowledged = true;
    alert.acknowledged_by = currentUser.name;
    saveState();
    res.json({
      id: alert.id,
      acknowledged: alert.acknowledged,
      acknowledged_by: alert.acknowledged_by,
    });
  });

  // POST /api/seed/reset (utility to reset demo data cleanly)
  app.post("/api/seed/reset", (_req: Request, res: Response) => {
    createInitialSeed();
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lattice AICTE Complaint Intelligence server listening on http://localhost:${PORT}`);
  });
}

startServer();
