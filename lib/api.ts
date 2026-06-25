// Client for the local `raph studio` HTTP API. The dashboard is hosted, but it
// talks to the user's machine (default http://localhost:4545). The base URL is
// overridable at runtime and persisted in localStorage.

export const DEFAULT_API =
  process.env.NEXT_PUBLIC_RAPH_API || 'http://localhost:4545';

const STORAGE_KEY = 'raph_studio_api';

export function getApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_API;
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_API;
}

export function setApiBase(url: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
}

export interface GraphNode {
  id: string;
  domain: string;
  type: string;
  name: string;
  content?: string;
  url?: string;
  properties?: Record<string, string>;
  updated_at?: string;
}

export interface GraphEdge {
  source_id: string;
  target_id: string;
  type: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Stats {
  nodes: number;
  edges: number;
  workspaces: number;
  by_type: Record<string, number>;
  by_domain: Record<string, number>;
}

export interface AccessNode {
  node_id: string;
  name: string;
  type: string;
  url?: string;
  count: number;
}

export interface Analytics {
  total_events: number;
  last_24h: number;
  unique_nodes: number;
  searches: number;
  top_nodes: AccessNode[] | null;
  by_kind: { kind: string; count: number }[] | null;
  top_searches: { query: string; count: number }[] | null;
  recent: {
    node_id?: string;
    name?: string;
    type?: string;
    kind: string;
    query?: string;
    created_at: string;
  }[] | null;
}

export interface ActivityItem {
  id: string;
  type: string;
  domain: string;
  name: string;
  url?: string;
  updated_at?: string;
  doc_type?: string;
  status?: string;
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(getApiBase() + path, { signal, mode: 'cors' });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiBase() + path, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  stats: (signal?: AbortSignal) => getJSON<Stats>('/api/stats', signal),
  analytics: (signal?: AbortSignal) => getJSON<Analytics>('/api/analytics?limit=12', signal),
  graph: (signal?: AbortSignal) => getJSON<GraphPayload>('/api/graph', signal),
  activity: (signal?: AbortSignal) =>
    getJSON<{ items: ActivityItem[] }>('/api/activity?limit=50', signal),
  search: (query: string, limit = 12) =>
    postJSON<{ mode: string; matches: GraphNode[] }>('/api/search', { query, limit }),
  node: (id: string, signal?: AbortSignal) =>
    getJSON<GraphNode & { memory?: unknown }>(`/api/node?id=${encodeURIComponent(id)}`, signal),
};
