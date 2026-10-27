import type {
  UserInfo,
  DemoAccountInfo,
  UnitSummary,
  OverviewResponse,
  PaginatedComplaints,
  ComplaintDetail,
  AnalyzeResponse,
  PaginatedInstitutions,
  InstitutionDetailResponse,
  GraphResponse,
  AlertItem,
  LinkQueueItem,
} from './types';

const TOKEN_STORAGE_KEY = 'lattice_auth_token_v2';
const USER_STORAGE_KEY = 'lattice_auth_user_v2';

let memoryToken: string | null = sessionStorage.getItem(TOKEN_STORAGE_KEY);
let memoryUser: UserInfo | null = (() => {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

export function getStoredToken(): string | null {
  return memoryToken;
}

export function getStoredUser(): UserInfo | null {
  return memoryUser;
}

export function setAuthSession(token: string, user: UserInfo) {
  memoryToken = token;
  memoryUser = user;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  memoryToken = null;
  memoryUser = null;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

export function getDefaultHomePath(user: UserInfo | null): string {
  if (!user) return '/login';
  if (user.role === 'chairman' || user.role === 'bureau_head') return '/';
  return '/complaints';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthSession();
    throw new Error('Invalid credentials or session expired');
  }

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) errMsg = errJson.detail;
    } catch {
      // ignore parse failure
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getAccounts: () => apiFetch<DemoAccountInfo[]>('/auth/accounts'),

  login: async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: UserInfo }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthSession(data.token, data.user);
    return data;
  },

  me: () => apiFetch<UserInfo>('/me'),

  getUnits: () => apiFetch<UnitSummary[]>('/units'),

  getOverview: () => apiFetch<OverviewResponse>('/overview'),

  getComplaints: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const query = qs.toString();
    return apiFetch<PaginatedComplaints>(`/complaints${query ? `?${query}` : ''}`);
  },

  getComplaint: (id: number) => apiFetch<ComplaintDetail>(`/complaints/${id}`),

  analyzeComplaint: (payload: {
    institution_id: number;
    title: string;
    description: string;
    category?: string;
    unit_code?: string;
    severity?: string;
  }) =>
    apiFetch<AnalyzeResponse>('/complaints/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createComplaint: (payload: {
    institution_id: number;
    title: string;
    description: string;
    complainant_type: string;
    category?: string;
    unit_code?: string;
    severity?: string;
  }) =>
    apiFetch<ComplaintDetail>('/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  patchComplaint: (
    id: number,
    payload: { status?: string; assigned_officer_id?: number; note?: string }
  ) =>
    apiFetch<ComplaintDetail>(`/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  escalateComplaint: (id: number) =>
    apiFetch<ComplaintDetail>(`/complaints/${id}/escalate`, {
      method: 'POST',
    }),

  getLinkQueue: (status: 'pending' | 'resolved' | 'all' = 'pending') =>
    apiFetch<LinkQueueItem[]>(`/link-queue?status=${status}`),

  resolveLinkQueueItem: (id: number, resolution: 'confirmed' | 'dismissed') =>
    apiFetch<LinkQueueItem>(`/link-queue/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),

  getInstitutions: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const query = qs.toString();
    return apiFetch<PaginatedInstitutions>(`/institutions${query ? `?${query}` : ''}`);
  },

  getInstitution: (id: number) => apiFetch<InstitutionDetailResponse>(`/institutions/${id}`),

  getInstitutionGraph: (id: number) => apiFetch<GraphResponse>(`/institutions/${id}/graph`),

  getAlerts: (state: 'open' | 'acknowledged' | 'all' = 'open') =>
    apiFetch<AlertItem[]>(`/alerts?state=${state}`),

  acknowledgeAlert: (id: number) =>
    apiFetch<{ id: number; acknowledged: boolean; acknowledged_by: string }>(
      `/alerts/${id}/acknowledge`,
      { method: 'POST' }
    ),
};
