import { jsPDF } from 'jspdf';

export function buildTechnicalDocPdf(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const COLORS = {
    ink: [21, 20, 15] as [number, number, number],
    inkMuted: [88, 84, 74] as [number, number, number],
    accent: [184, 80, 30] as [number, number, number],
    paper: [246, 244, 239] as [number, number, number],
    line: [216, 210, 194] as [number, number, number],
    tableHeader: [234, 229, 216] as [number, number, number],
    codeBg: [242, 239, 230] as [number, number, number],
  };

  function ensureSpace(requiredHeight: number) {
    if (y + requiredHeight > pageHeight - 54) {
      doc.addPage();
      y = margin + 10;
    }
  }

  function drawDivider() {
    ensureSpace(16);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  function addSectionHeader(num: string, title: string) {
    ensureSpace(44);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.accent);
    doc.text(`SECTION ${num}`, margin, y);
    y += 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...COLORS.ink);
    doc.text(title, margin, y);
    y += 8;

    doc.setDrawColor(...COLORS.ink);
    doc.setLineWidth(1.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  function addSubHeader(title: string) {
    ensureSpace(28);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(title, margin, y);
    y += 14;
  }

  function addParagraph(text: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.inkMuted);
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 13 + 6);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 6;
  }

  function addBullet(label: string, body: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const fullText = `${label ? label + ': ' : ''}${body}`;
    const lines = doc.splitTextToSize(fullText, contentWidth - 14);
    ensureSpace(lines.length * 13 + 4);

    doc.setFillColor(...COLORS.accent);
    doc.circle(margin + 4, y - 3, 2, 'F');

    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text(`${label}:`, margin + 12, y);
      const labelWidth = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.inkMuted);

      const firstLineRest = lines[0].slice(label.length + 2);
      doc.text(firstLineRest, margin + 12 + labelWidth, y);
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], margin + 12, y + i * 13);
      }
    } else {
      doc.setTextColor(...COLORS.inkMuted);
      doc.text(lines, margin + 12, y);
    }
    y += lines.length * 13 + 4;
  }

  function addCodeBlock(lines: string[]) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    const wrapped: string[] = [];
    for (const ln of lines) {
      const split = doc.splitTextToSize(ln, contentWidth - 20);
      wrapped.push(...split);
    }
    const boxHeight = wrapped.length * 12 + 16;
    ensureSpace(boxHeight + 10);

    doc.setFillColor(...COLORS.codeBg);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.75);
    doc.roundedRect(margin, y - 4, contentWidth, boxHeight, 4, 4, 'FD');

    doc.setTextColor(...COLORS.ink);
    let cy = y + 9;
    for (const w of wrapped) {
      doc.text(w, margin + 10, cy);
      cy += 12;
    }
    y += boxHeight + 10;
  }

  function addTable(headers: string[], colWidths: number[], rows: string[][]) {
    const rowPadding = 6;
    const fontSize = 8.5;

    // Header row
    ensureSpace(32);
    doc.setFillColor(...COLORS.tableHeader);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.75);
    doc.rect(margin, y, contentWidth, 20, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.ink);

    let cx = margin;
    headers.forEach((h, idx) => {
      doc.text(h, cx + 6, y + 13);
      cx += colWidths[idx];
    });
    y += 20;

    // Data rows
    rows.forEach((row, rIdx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);

      const cellLines = row.map((cell, cIdx) =>
        doc.splitTextToSize(cell, colWidths[cIdx] - 12)
      );
      const maxLines = Math.max(1, ...cellLines.map((cl) => cl.length));
      const rowH = maxLines * 11 + rowPadding * 2;

      ensureSpace(rowH + 4);

      if (rIdx % 2 === 1) {
        doc.setFillColor(250, 248, 244);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(...COLORS.line);
      doc.rect(margin, y, contentWidth, rowH, 'S');

      let cellX = margin;
      cellLines.forEach((cl, cIdx) => {
        if (cIdx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.ink);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.inkMuted);
        }
        doc.text(cl, cellX + 6, y + 12);
        cellX += colWidths[cIdx];
      });

      y += rowH;
    });

    y += 10;
  }

  // =========================================================================
  // COVER / TITLE BANNER
  // =========================================================================
  doc.setFillColor(...COLORS.ink);
  doc.rect(margin, y, contentWidth, 92, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 91, 31);
  doc.text('AICTE REGULATORY ENGINEERING SPECIFICATION · v2.0', margin + 18, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(251, 249, 244);
  doc.text('Lattice: Complaint & Risk Intelligence', margin + 18, y + 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(216, 210, 194);
  doc.text(
    'Complete Technical Architecture, Mathematical Models, RBAC Security & API Reference',
    margin + 18,
    y + 72
  );
  y += 110;

  // Document Metadata Strip
  addTable(
    ['Document Property', 'Specification Value'],
    [160, contentWidth - 160],
    [
      ['System Name', 'Lattice — AICTE Complaint & Institutional Risk Intelligence Platform'],
      ['Runtime Stack', 'React 19 + TypeScript + Vite 8 SPA | Express 4 + Node.js Backend (Port 3000)'],
      ['Authentication & RBAC', 'Salted SHA-256 Password Auth · Strictly 4 Roles (Chairman, Bureau Head, Case Officer, Admin)'],
      ['Intelligence Engines', 'TF-IDF Cosine Similarity + Union-Find Clustering + 5-Factor Risk Formula + Logistic SLA Model'],
      ['Seeded Dataset', 'Deterministic Mulberry32 PRNG (Seed 20260419): 40 Institutions, 320 Complaints, 4 Units'],
    ]
  );

  // =========================================================================
  // SECTION 1: SYSTEM OVERVIEW & ARCHITECTURE
  // =========================================================================
  addSectionHeader('01', 'System Overview & Full-Stack Architecture');
  addParagraph(
    'Lattice is an internal regulatory intelligence platform engineered for the All India Council for Technical Education (AICTE). It unifies complaint intake, automated unit routing, cross-bureau duplicate and context detection, explainable institutional risk scoring, SLA breach forecasting, and strict role-based access control (RBAC) across AICTE bureaus and cells.'
  );

  addSubHeader('1.1 Technology Stack');
  addBullet(
    'Frontend Application',
    'React 19.0, TypeScript 7, React Router v7, Tailwind CSS v4 paired with a custom editorial design system (Warm Paper #F6F4EF, Deep Charcoal Ink #15140F, Vermilion Signal #FF5B1F).'
  );
  addBullet(
    'Typography & Data Readability',
    'Newsreader (editorial display serif for headings and KPI numerals), Plus Jakarta Sans (UI controls and body copy), and JetBrains Mono (tabular numerals, case reference IDs, similarity scores, and formulas).'
  );
  addBullet(
    'Motion & Custom SVG Graphics',
    'GSAP 3.12 (gsap.context lifecycle management, staggered card reveals, animated risk factor bars, and SVG stroke-dashoffset path drawing) with full prefers-reduced-motion compliance.'
  );
  addBullet(
    'Backend Server & Storage',
    'Express 4 server (server.ts) mounting REST endpoints (/api/*) and Vite middleware in development. Persistent JSON state is stored at .data/lattice_state.json and automatically initialized with a deterministic 320-complaint seed.'
  );

  addSubHeader('1.2 High-Level Source Tree');
  addCodeBlock([
    '/server.ts                         -> Express API, RBAC enforcement, TF-IDF & Risk engines, Seed generator',
    '/src/App.tsx                       -> Root application shell, ToastProvider, BrowserRouter, session sync',
    '/src/routes.tsx                    -> Role-guarded route definitions (/ , /complaints, /link-queue, etc.)',
    '/src/api/types.ts                  -> End-to-end TypeScript interfaces for API payloads & RBAC permissions',
    '/src/api/client.ts                 -> Fetch wrapper with Bearer token injection & sessionStorage persistence',
    '/src/pages/Login.tsx               -> Password authentication UI, 4-role presets, Section 3 capability matrix',
    '/src/pages/Overview.tsx            -> Chairman Dashboard (national) & Bureau Dashboard (officer workload)',
    '/src/pages/Complaints.tsx          -> Paginated case registry, multi-facet filters, Case Officer priority sort',
    '/src/pages/ComplaintDetail.tsx     -> Dossier view, SLA gauge, linked cases, role-gated actions & redaction',
    '/src/pages/NewComplaint.tsx        -> Complaint intake form with live 300ms debounced intelligence preview',
    '/src/pages/LinkQueue.tsx           -> Institution-link resolution queue for Bureau Head & Admin roles',
    '/src/pages/Institutions.tsx        -> Searchable directory of 40 AICTE-approved technical institutions',
    '/src/pages/InstitutionDetail.tsx   -> Explainable 5-factor risk breakdown, 12-week history & link topology',
    '/src/pages/Alerts.tsx              -> Rule-based early-warning feed (Rules R1–R4) with acknowledgement workflow',
  ]);

  // =========================================================================
  // SECTION 2: ROLES, PERMISSIONS & PASSWORD AUTHENTICATION
  // =========================================================================
  addSectionHeader('02', 'Roles, Permissions & Password Authentication (Section 3)');
  addParagraph(
    'The platform implements email and password authentication backed by salted SHA-256 password hashes and strictly enforces four system roles without subroles: chairman, bureau_head, case_officer, and admin.'
  );

  addSubHeader('2.1 Section 3 Role & Capability Matrix');
  addTable(
    ['Capability', 'Chairman', 'Bureau Head', 'Case Officer', 'Admin'],
    [135, 93, 93, 103, 83],
    [
      ['Register complaint', 'no', 'yes', 'yes', 'no'],
      ['View case list & detail', 'all bureaus, full', 'full', 'full (assigned 1st)', 'metadata only (3.1)'],
      ['Assign / reassign officer', 'no', 'yes', 'no', 'yes'],
      ['Add action note', 'no', 'yes', 'assigned cases', 'no'],
      ['Status transitions', 'reopen only', 'per section 5', 'per section 5', 'none'],
      ['Resolve link queue', 'no', 'yes', 'no', 'yes'],
      ['Chairman dashboard', 'yes', 'no', 'no', 'no'],
      ['Bureau dashboard', 'no', 'yes', 'no', 'no'],
    ]
  );

  addSubHeader('2.2 Official Role Credentials');
  addTable(
    ['Role', 'Official Email', 'Password', 'Default Landing Route & Key Behavior'],
    [90, 145, 90, contentWidth - 325],
    [
      ['Chairman', 'chairman@aicte.gov.in', 'Chairman@123', '/ (Chairman Dashboard) · Reopen-only transitions'],
      ['Bureau Head', 'bureau_head@aicte.gov.in', 'Bureau@123', '/ (Bureau Dashboard) · Full operational control'],
      ['Case Officer', 'case_officer@aicte.gov.in', 'Officer@123', '/complaints · Assigned cases sorted first'],
      ['Admin', 'admin@aicte.gov.in', 'Admin@123', '/complaints · Metadata-only view, assign & link queue'],
    ]
  );

  addSubHeader('2.3 Section 3.1 Admin Metadata-Only Redaction');
  addParagraph(
    'When authenticated as Admin, the backend API (buildComplaintDetail and GET /api/complaints) enforces Section 3.1 privacy rules: the complaint narrative description is returned as null, keyword search excludes narrative bodies, and all officer investigation notes (event.type === "Note") have their message replaced with "[Action note content redacted — Admin metadata-only access]" while preserving routing, SLA, and assignment metadata.'
  );

  // =========================================================================
  // SECTION 3: CORE INTELLIGENCE ENGINES & MATHEMATICAL MODELS
  // =========================================================================
  addSectionHeader('03', 'Core Intelligence Engines & Mathematical Models');

  addSubHeader('3.1 Automated Intake Classification & Statutory SLA Windows');
  addParagraph(
    'During complaint intake (POST /api/complaints/analyze and POST /api/complaints), text is scored against a weighted regulatory lexicon across 8 categories mapped to 4 AICTE units:'
  );
  addTable(
    ['Regulatory Category', 'Routed Unit', 'Primary Lexicon Triggers'],
    [165, 110, contentWidth - 275],
    [
      ['Fee and Refund', 'SGC (Grievance)', 'refund, tuition fee, caution deposit, overcharging, capitation'],
      ['Document and Certificate Issues', 'SGC (Grievance)', 'original degree, marksheet withheld, transfer certificate, transcript'],
      ['Harassment and Ragging', 'SGC (Grievance)', 'ragging, hostel harassment, intimidation, abuse, discrimination'],
      ['Faculty and Staffing', 'ACB (Academic)', 'faculty vacancies, salary unpaid, ghost faculty, professor shortage'],
      ['Curriculum and Examination', 'ACB (Academic)', 'syllabus unapproved, exam delay, grading irregularity, attendance'],
      ['Infrastructure and Safety', 'AB (Approval)', 'electrical hazard, fire safety, laboratory shortage, building seepage'],
      ['Admissions and Affiliation', 'AB (Approval)', 'unapproved intake, excess seats, affiliation renewal, counselling'],
      ['Placement and Misrepresentation', 'VC (Vigilance)', 'fake placement, 100% placement claim, misleading advertisement'],
    ]
  );

  addCodeBlock([
    '// Classifier Confidence & Statutory SLA Window Calculation',
    'confidence = clamp(0.55 + 0.08 * bestScore + 0.05 * (bestScore - secondScore), 0.55, 0.96)',
    'SLA_DAYS   = { Critical: 3, High: 7, Medium: 15, Low: 30 }',
    'due_at     = created_at + SLA_DAYS[severity] * 86400 seconds',
  ]);

  addSubHeader('3.2 TF-IDF Cosine Similarity & Union-Find Case Clustering');
  addParagraph(
    'For every institution, all complaints are tokenized into unigrams and bigrams after stopword removal. The engine builds sublinear TF-IDF vectors and computes pairwise cosine similarity for complaints within the same institution:'
  );
  addCodeBlock([
    'tfWeight(tf)     = 1 + ln(tf)',
    'idfWeight(df, N) = ln((N + 1) / (df + 1)) + 1',
    'cosine(A, B)     = dot(vecA, vecB) / (||vecA|| * ||vecB||)',
    '',
    '// Pairwise Link Classification Thresholds:',
    '1. Duplicate Link : cosine(A, B) >= 0.52',
    '2. Similar Link   : 0.28 <= cosine(A, B) < 0.52',
    '3. Context Link   : unit(A) !== unit(B) AND |created(A) - created(B)| <= 45 days',
  ]);
  addParagraph(
    'Connected components across Duplicate and Similar edges are merged using a Disjoint-Set (Union-Find) structure to assign a deterministic cluster_id to each complaint.'
  );

  addSubHeader('3.3 5-Factor Composite Institution Risk Score (0–100)');
  addParagraph(
    'Each institution is evaluated over a rolling 90-day window using an explainable 5-factor linear combination (30V + 25S + 20R + 15A + 10X):'
  );
  addCodeBlock([
    'V (Volume, weight 0.30)          = min(1.0, count_90d / 12)',
    'S (Severity Mix, weight 0.25)    = sum(sev_weight) / (4 * count_90d)  [Low=1, Med=2, High=3, Crit=4]',
    'R (Recurrence, weight 0.20)      = min(1.0, ((max_cluster - 1) / 4) * 0.6 + repeat_cat_share * 0.4)',
    'A (SLA Breach Rate, weight 0.15) = min(1.0, (breached_or_late_90d / count_90d) * 1.4)',
    'X (Unit Spread, weight 0.10)     = (distinct_units_90d - 1) / 3',
    '',
    'Composite Score = round(100 * (0.30*V + 0.25*S + 0.20*R + 0.15*A + 0.10*X))',
    'Risk Bands      = Low (0–34) | Watch (35–59) | High (60–79) | Critical (80–100)',
  ]);

  addSubHeader('3.4 SLA State & Logistic Breach Probability Engine');
  addCodeBlock([
    'elapsed_ratio = (now - created_at) / (due_at - created_at)',
    'z = -2.2 + 3.2 * elapsed_ratio + 0.8 * unit_load + 0.6 * stagnation + 0.5 * is_high_or_critical',
    'breach_probability = 1 / (1 + exp(-z))',
    '',
    'SLA State: "closed" (Resolved/Closed) | "breached" (now > due_at) |',
    '           "at_risk" (elapsed_ratio >= 0.70 OR breach_probability >= 0.65) | "ok"',
  ]);

  addSubHeader('3.5 Section 5 Case Status Transition State Machine');
  addTable(
    ['Current Status', 'Permitted Next Statuses (Bureau Head & Assigned Case Officer)'],
    [150, contentWidth - 150],
    [
      ['New', 'Assigned, In Review, Escalated'],
      ['Assigned', 'In Review, Awaiting Institution, Escalated, Resolved'],
      ['In Review', 'Awaiting Institution, Escalated, Resolved'],
      ['Awaiting Institution', 'In Review, Escalated, Resolved'],
      ['Escalated', 'In Review, Awaiting Institution, Resolved'],
      ['Resolved', 'Closed, In Review (Reopen — also permitted for Chairman)'],
      ['Closed', 'In Review (Reopen — also permitted for Chairman)'],
    ]
  );

  // =========================================================================
  // SECTION 4: DATABASE ENTITIES & REST API ENDPOINTS
  // =========================================================================
  addSectionHeader('04', 'Data Schemas & REST API Specification');

  addSubHeader('4.1 Core Data Entities');
  addBullet('UnitRecord', 'id, code ("AB" | "ACB" | "SGC" | "VC"), name, kind ("Bureau" | "Cell").');
  addBullet('OfficerRecord', 'id, name, unit_id, title (includes Case Officer Kavita Nair, id=6).');
  addBullet('InstitutionRecord', 'id, name, city, state, type, established_year, intake.');
  addBullet(
    'ComplaintRecord',
    'id, ref (AICTE-2026-XXXXX), institution_id, title, description, category, severity, status, unit_id, assigned_officer_id, complainant_type, created_at, updated_at, due_at, resolved_at, escalation_count, auto_confidence, cluster_id.'
  );
  addBullet(
    'CaseLinkRecord',
    'id, institution_id, a_id, b_id, type ("Duplicate" | "Similar" | "Context"), similarity, resolution_status ("pending" | "confirmed" | "dismissed"), resolved_by, resolved_at.'
  );
  addBullet(
    'AlertRecord',
    'id, rule ("R1" | "R2" | "R3" | "R4"), severity, institution_id, complaint_id, message, created_at, acknowledged, acknowledged_by.'
  );

  addSubHeader('4.2 REST API Endpoints (/api/*)');
  addTable(
    ['Method & Path', 'Role Access', 'Description'],
    [165, 110, contentWidth - 275],
    [
      ['GET /api/auth/accounts', 'Public', 'Returns the 4 official role accounts and password hints.'],
      ['POST /api/auth/login', 'Public', 'Validates email + password hash; returns Bearer token & UserInfo.'],
      ['GET /api/me', 'Authenticated', 'Returns active SessionUser and computed RolePermissions.'],
      ['GET /api/overview', 'Chairman, Bureau Head', 'Returns Chairman Dashboard or Bureau Dashboard KPIs & workload.'],
      ['GET /api/complaints', 'All 4 Roles', 'Paginated list; Case Officer sorted assigned-first; Admin redacted.'],
      ['POST /api/complaints/analyze', 'Bureau Head, Case Off.', 'Live TF-IDF link & risk delta preview before filing.'],
      ['POST /api/complaints', 'Bureau Head, Case Off.', 'Registers complaint, routes unit, computes SLA & links.'],
      ['GET /api/complaints/:id', 'All 4 Roles', 'Full dossier & timeline (Admin receives metadata-only redaction).'],
      ['PATCH /api/complaints/:id', 'Role-Enforced', 'Assign officer, transition status (Sec 5 / Reopen), or add note.'],
      ['POST /api/complaints/:id/escalate', 'Bureau Head, Case Off.', 'Escalates case, increments escalation_count, fires R3 alert.'],
      ['GET /api/link-queue', 'All 4 Roles', 'Lists candidate Duplicate/Similar/Context links across cases.'],
      ['POST /api/link-queue/:id/resolve', 'Bureau Head, Admin', 'Marks candidate link as confirmed or dismissed with audit event.'],
      ['GET /api/institutions', 'All 4 Roles', 'Paginated institution directory with 5-factor risk scores.'],
      ['GET /api/institutions/:id', 'All 4 Roles', 'Institution risk dossier, factor breakdown, 12w sparkline & cases.'],
      ['GET /api/institutions/:id/graph', 'All 4 Roles', 'Nodes and non-dismissed link edges for SVG network topology.'],
      ['GET /api/alerts', 'All 4 Roles', 'Early-warning alerts generated by rules R1, R2, R3, and R4.'],
      ['POST /api/alerts/:id/acknowledge', 'Chairman, Bureau Head', 'Marks an alert as acknowledged and records actor name.'],
    ]
  );

  // Add page numbers & footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.inkMuted);
    doc.text(
      'LATTICE · AICTE COMPLAINT & RISK INTELLIGENCE · TECHNICAL DOCUMENTATION',
      margin,
      pageHeight - 20
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 20, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadTechnicalDocPdf(
  filename = 'Lattice_AICTE_Technical_Documentation.pdf'
) {
  const doc = buildTechnicalDocPdf();
  doc.save(filename);
}
