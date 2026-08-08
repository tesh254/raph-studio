'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Project } from '@/lib/api';

function fmtWhen(iso?: string): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [offline, setOffline] = useState(false);
  // Monotonic request id: a slow earlier poll must not overwrite the result of
  // a newer one (or flip `offline` back after a later request succeeded).
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const r = await api.projects();
      if (id !== reqId.current) return;
      setProjects(r.items || []);
      setOffline(false);
    } catch {
      if (id !== reqId.current) return;
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  // Only a skeleton before the first response — polling keeps the last good
  // data on screen rather than flashing back to a loading state.
  const loading = projects === null && !offline;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">
          What memories and documents are scoped to. A project can hold several indexed
          repositories, so this is what decides the knowledge an agent recalls in a directory.
        </p>
      </header>

      {offline && (
        <div className="notice notice-bad" role="alert">
          <div>
            <b>Can&apos;t reach the raph studio API.</b>
            <div>Run <code>raph studio</code> locally and check the URL in the sidebar.</div>
          </div>
          <button type="button" className="btn" onClick={refresh}>Retry</button>
        </div>
      )}

      {loading && (
        <>
          <div className="sr-only" role="status">Loading projects…</div>
          <div className="project-list" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="project-card" key={i}>
                <div className="skeleton sk-title" />
                <div className="skeleton sk-line" />
                <div className="skeleton sk-chips" />
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !offline && projects && projects.length === 0 && (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true">◈</div>
          <div className="empty-title">No projects yet</div>
          <div className="empty-hint">
            Index a repository with <code>raph init --path .</code>, or run{' '}
            <code>raph backfill</code> if it was indexed before projects existed.
          </div>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="project-list">
          {projects.map((p) => {
            const repos = p.workspaces || [];
            return (
              <section className="project-card" key={p.id}>
                <div className="project-head">
                  <h2 className="project-name" title={p.name}>{p.name}</h2>
                  {/* The scope id: the value that explains why two repositories
                      recall different things. */}
                  <code className="project-id" title="Memories and documents are scoped by this id">
                    {p.id}
                  </code>
                </div>
                <div className="project-root" title={p.root}>{p.root}</div>

                <div className="repo-stats">
                  <span className="chip"><b>{repos.length}</b> {repos.length === 1 ? 'repo' : 'repos'}</span>
                  <span className="chip"><b>{p.files}</b> files</span>
                  <span className="chip"><b>{p.directories}</b> directories</span>
                  <span className="chip"><b>{p.memories}</b> {p.memories === 1 ? 'memory' : 'memories'}</span>
                  <span className="chip"><b>{p.documents}</b> {p.documents === 1 ? 'document' : 'documents'}</span>
                </div>

                {repos.length > 0 ? (
                  <ul className="project-repos">
                    {repos.map((r) => (
                      <li className="project-repo" key={r.workspace}>
                        <span className="project-repo-name" title={r.name}>{r.name}</span>
                        <span className="project-repo-meta" title={r.root || r.workspace}>
                          {r.files} file{r.files === 1 ? '' : 's'} · {r.root || r.workspace}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="project-none">
                    No indexed repository under this project yet — its memories and documents
                    still apply.
                  </div>
                )}

                <div className="repo-foot">indexed {fmtWhen(p.last_indexed)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
