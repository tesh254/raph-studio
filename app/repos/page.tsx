'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Repo } from '@/lib/api';

function fmtWhen(iso?: string): string {
  if (!iso) return 'unknown';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api.repos();
      setRepos(r.items || []);
      setOffline(false);
    } catch {
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
  const loading = repos === null && !offline;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Repositories</h1>
        <p className="page-sub">Codebases indexed into this raph graph.</p>
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
        <div className="repo-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="repo-card" key={i}>
              <div className="skeleton sk-title" />
              <div className="skeleton sk-line" />
              <div className="skeleton sk-chips" />
            </div>
          ))}
        </div>
      )}

      {!loading && !offline && repos && repos.length === 0 && (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true">⌗</div>
          <div className="empty-title">No repositories indexed yet</div>
          <div className="empty-hint">
            Index one with <code>raph index</code> in a project, or the{' '}
            <code>index_codebase</code> MCP tool.
          </div>
        </div>
      )}

      {repos && repos.length > 0 && (
        <div className="repo-grid">
          {repos.map((r) => {
            const domains = r.by_domain
              ? Object.entries(r.by_domain).sort((a, b) => b[1] - a[1])
              : [];
            return (
              <section className="repo-card" key={r.workspace}>
                <div className="repo-card-head">
                  <h2 className="repo-name" title={r.name}>{r.name}</h2>
                  <span className="repo-files">{r.files} file{r.files === 1 ? '' : 's'}</span>
                </div>
                <div className="repo-root" title={r.root || r.workspace}>
                  {r.root || r.workspace}
                </div>
                <div className="repo-stats">
                  <span className="chip"><b>{r.nodes}</b> nodes</span>
                  {domains.map(([d, c]) => (
                    <span className="chip" key={d}>{d} <b>{c}</b></span>
                  ))}
                </div>
                <div className="repo-foot">indexed {fmtWhen(r.last_indexed)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
