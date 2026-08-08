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

export interface TimelinePoint {
  date: string; // YYYY-MM-DD (UTC)
  memories: number;
  handoffs: number;
}

export interface Timeline {
  days: number;
  points: TimelinePoint[];
  total_memories: number;
  active_memories: number;
  total_handoffs: number;
  fresh_handoffs: number;
  used_handoffs: number;
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

// Shared POST transport + error handling. Response parsing is left to callers
// so JSON and empty-body endpoints don't duplicate the request/error path.
async function postRequest(path: string, body: unknown): Promise<Response> {
  const res = await fetch(getApiBase() + path, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Surface the server's error text (used by the edit forms) when present.
    const detail = (await res.text().catch(() => '')).trim();
    throw new Error(detail || `${path} → HTTP ${res.status}`);
  }
  return res;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await postRequest(path, body);
  return (await res.json()) as T;
}

// For POST endpoints that return an empty 200 (no JSON body), e.g. deletes.
async function postVoid(path: string, body: unknown): Promise<void> {
  await postRequest(path, body);
}

export interface MemoryRecord {
  node: GraphNode & { content?: string };
  memory_key: string;
  scope_type: string;
  scope_id: string;
  lifecycle_state: string;
  knowledge_type: string;
  source: string;
  writer_id: string;
  created_at: string;
  updated_at: string;
  normalized_tags: string[] | null;
  display_tags: string[] | null;
  revision: number;
  replaced_by_node_id?: string;
  deprecated_message?: string;
}

export interface MemoryRevision {
  node_id: string;
  revision: number;
  title: string;
  content: string;
  source: string;
  writer_id: string;
  created_at: string;
}

export interface DocumentPayload {
  node: GraphNode & { content?: string };
  chunks?: GraphNode[];
  related?: GraphNode[];
  chunk_count: number;
}

// An indexed codebase, as returned by /api/repos. Repos are workspaces the
// indexer tagged with a filesystem root; the server groups them because the
// per-node workspace never reaches the client.
export interface Repo {
  workspace: string;
  root: string;
  name: string;
  nodes: number;
  files: number;
  by_domain: Record<string, number> | null;
  last_indexed?: string;
}

// A project, as returned by /api/projects. A project is what memories and
// documents are scoped to — one project can hold several indexed roots (a
// monorepo's packages), which is why repos alone can't explain what an agent
// recalls in a given directory. `id` is that scope value.
export interface Project {
  id: string;
  name: string;
  root: string;
  workspaces: Repo[] | null;
  files: number;
  directories: number;
  memories: number;
  documents: number;
  last_indexed?: string;
}

export const api = {
  stats: (signal?: AbortSignal) => getJSON<Stats>('/api/stats', signal),
  repos: (signal?: AbortSignal) => getJSON<{ items: Repo[] }>('/api/repos', signal),
  projects: (signal?: AbortSignal) => getJSON<{ items: Project[] }>('/api/projects', signal),
  analytics: (signal?: AbortSignal) => getJSON<Analytics>('/api/analytics?limit=12', signal),
  timeline: (days = 30, signal?: AbortSignal) =>
    getJSON<Timeline>(`/api/timeline?days=${days}`, signal),
  graph: (signal?: AbortSignal) => getJSON<GraphPayload>('/api/graph', signal),
  activity: (signal?: AbortSignal) =>
    getJSON<{ items: ActivityItem[] }>('/api/activity?limit=50', signal),
  search: (query: string, limit = 12) =>
    postJSON<{ mode: string; matches: GraphNode[] }>('/api/search', { query, limit }),
  node: (id: string, signal?: AbortSignal) =>
    getJSON<GraphNode & { memory?: unknown }>(`/api/node?id=${encodeURIComponent(id)}`, signal),
  neighbors: (id: string) =>
    postJSON<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/api/neighbors', { node_id: id }),

  memories: (query = '', signal?: AbortSignal) =>
    getJSON<{ items: MemoryRecord[] }>(`/api/memories?query=${encodeURIComponent(query)}`, signal),
  memory: (id: string, signal?: AbortSignal) =>
    getJSON<{ record: MemoryRecord; revisions: MemoryRevision[] }>(`/api/memory?id=${encodeURIComponent(id)}`, signal),
  updateMemory: (body: { node_id: string; title: string; content: string; tags: string[] }) =>
    postJSON<MemoryRecord>('/api/memory/update', body),
  deleteMemory: (nodeID: string) => postVoid('/api/memory/delete', { node_id: nodeID }),

  handoffs: (query = '', signal?: AbortSignal) =>
    getJSON<{ items: GraphNode[] }>(`/api/handoffs?query=${encodeURIComponent(query)}`, signal),
  document: (id: string, signal?: AbortSignal) =>
    getJSON<DocumentPayload>(`/api/document?id=${encodeURIComponent(id)}`, signal),
  updateDocument: (body: { id: string; title: string; content: string; tags: string[] }) =>
    postJSON<DocumentPayload>('/api/document/update', body),
  deleteDocument: (id: string) => postVoid('/api/document/delete', { id }),
};
