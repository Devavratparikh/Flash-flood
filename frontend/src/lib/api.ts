/**
 * Thin fetch client for the himvaah backend.
 *
 * Base URL comes from VITE_API_URL (defaults to http://localhost:4000).
 * The auth token is kept in localStorage and attached to every request.
 */
import type {
  Area,
  BroadcastLog,
  CommunityReport,
  District,
  HistoricEvent,
  Horizon,
  Insights,
  Preferences,
  SystemStats,
  Tier,
  User,
  WeatherNow,
} from "./types";

export const API_URL =
  (import.meta as { env?: Record<string, string> }).env?.["VITE_API_URL"] ??
  "http://localhost:4000";

const TOKEN_KEY = "himvaah.token";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const api = {
  // auth ---------------------------------------------------------------
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      ...json({ email, password }),
    }),
  register: (payload: {
    email: string;
    password: string;
    name: string;
    role?: string;
    districtId?: string | null;
  }) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      ...json(payload),
    }),
  me: () => request<{ user: User }>("/api/auth/me"),

  // reads ------------------------------------------------------------
  overview: () => request<{ stats: SystemStats; areas: Area[] }>("/api/overview"),
  districts: () => request<District[]>("/api/districts"),
  areas: () => request<Area[]>("/api/areas"),
  area: (id: string) => request<Area>(`/api/areas/${id}`),
  areaWeather: (id: string) =>
    request<{ weather: WeatherNow; horizons: Horizon[] }>(`/api/areas/${id}/weather`),
  areaScores: (id: string, horizon = "nowcast") =>
    request<{ score: number; tier: Tier; confidence: number; computedAt: string }[]>(
      `/api/areas/${id}/scores?horizon=${horizon}`,
    ),
  reports: (areaId?: string) =>
    request<CommunityReport[]>(`/api/reports${areaId ? `?areaId=${areaId}` : ""}`),
  broadcasts: () => request<BroadcastLog[]>("/api/broadcasts"),
  history: (districtId?: string, from?: string) => {
    const q = new URLSearchParams();
    if (districtId && districtId !== "all") q.set("districtId", districtId);
    if (from) q.set("from", from);
    const s = q.toString();
    return request<HistoricEvent[]>(`/api/history${s ? `?${s}` : ""}`);
  },
  insights: () => request<Insights>("/api/insights"),
  preferences: () => request<Preferences>("/api/me/preferences"),

  // writes ---------------------------------------------------------
  submitReport: (form: FormData) =>
    request<CommunityReport>("/api/reports", { method: "POST", body: form }),
  verifyReport: (id: string, verified: boolean) =>
    request<CommunityReport>(`/api/reports/${id}/verify`, {
      method: "PATCH",
      ...json({ verified }),
    }),
  createBroadcast: (payload: {
    tier: Tier;
    message: string;
    messageHi?: string;
    areaIds: string[];
    channels: string[];
  }) => request<BroadcastLog>("/api/broadcasts", { method: "POST", ...json(payload) }),
  pushReading: (
    areaId: string,
    payload: {
      rainfall1h: number;
      soilSaturation: number;
      reservoirLevel?: number;
      damStatus?: string;
    },
  ) =>
    request<{ queued: boolean; area: Area }>(`/api/areas/${areaId}/readings`, {
      method: "POST",
      ...json(payload),
    }),
  updatePreferences: (payload: Partial<Preferences>) =>
    request<Preferences>("/api/me/preferences", { method: "PUT", ...json(payload) }),
};
