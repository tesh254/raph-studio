'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface BrowserItem {
  id: string;
  name: string;
  badge?: string;      // short type/status label
  badgeCls?: string;   // full className for the badge span
  meta?: string;       // secondary line (scope, timestamp, …)
}

export interface BrowserDetail {
  id: string;
  name: string;
  content: string;
  tags: string[];
  fields: { label: string; value: string }[];
  editable: boolean;
  extra?: ReactNode;   // revisions, chunks, etc.
}

interface Props {
  kindLabel: string;   // "memory" / "handover" — used in copy
  emptyHint: string;
  load: (query: string, signal: AbortSignal) => Promise<BrowserItem[]>;
  loadDetail: (id: string, signal: AbortSignal) => Promise<BrowserDetail>;
  save: (id: string, patch: { title: string; content: string; tags: string[] }) => Promise<void>;
}

export default function KnowledgeBrowser({ kindLabel, emptyHint, load, loadDetail, save }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BrowserDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback((q: string) => {
    const ctrl = new AbortController();
    load(q, ctrl.signal)
      .then((its) => { setItems(its); setOffline(false); })
      .catch((e) => { if (e?.name !== 'AbortError') setOffline(true); });
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => refresh(''), [refresh]);

  const onQuery = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => refresh(q), 220);
  };

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setEditing(false);
    setError(null);
    setDetail(null);
    const ctrl = new AbortController();
    loadDetail(id, ctrl.signal)
      .then((d) => setDetail(d))
      .catch((e) => { if (e?.name !== 'AbortError') setError(e?.message || 'Failed to load'); });
  }, [loadDetail]);

  const startEdit = () => {
    if (!detail) return;
    setForm({ title: detail.name, content: detail.content, tags: detail.tags.join(', ') });
    setError(null);
    setEditing(true);
  };

  const onSave = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      await save(detail.id, { title: form.title.trim(), content: form.content, tags });
      setEditing(false);
      openDetail(detail.id);   // reload the saved record
      refresh(query);          // reflect title/tag changes in the list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      {offline && (
        <div className="card blush" style={{ marginBottom: 20 }}>
          Can&apos;t reach the raph studio API. Run <code>raph studio</code> locally and check the URL in the sidebar.
        </div>
      )}

      <div className="browser">
        <section className="card kb-listcard">
          <div className="searchbar">
            <input
              placeholder={`Search ${kindLabel}s…`}
              value={query}
              spellCheck={false}
              onChange={(e) => onQuery(e.target.value)}
              aria-label={`Search ${kindLabel}s`}
            />
          </div>
          <div className="kb-list">
            {items.length === 0 && <div className="empty">{query ? 'No matches' : emptyHint}</div>}
            {items.map((it) => (
              <button
                key={it.id}
                className={`kb-row ${selectedId === it.id ? 'active' : ''}`}
                onClick={() => openDetail(it.id)}
              >
                <div className="kb-row-top">
                  {it.badge && <span className={it.badgeCls || 'badge other'}>{it.badge}</span>}
                  <span className="kb-row-name">{it.name}</span>
                </div>
                {it.meta && <div className="kb-row-meta">{it.meta}</div>}
              </button>
            ))}
          </div>
        </section>

        <section className="card kb-detailcard">
          {!detail && !error && (
            <div className="empty">{selectedId ? 'Loading…' : `Select a ${kindLabel} to view or edit.`}</div>
          )}
          {error && !editing && <div className="kb-error">{error}</div>}

          {detail && !editing && (
            <>
              <div className="kb-detail-head">
                <h2 className="kb-title">{detail.name}</h2>
                {detail.editable && <button className="btn" onClick={startEdit}>Edit</button>}
              </div>
              <div className="kb-fields">
                {detail.fields.map((f) => (
                  <div className="kb-field" key={f.label}>
                    <span className="kb-field-label">{f.label}</span>
                    <span className="kb-field-value">{f.value || '—'}</span>
                  </div>
                ))}
              </div>
              {detail.tags.length > 0 && (
                <div className="chips" style={{ marginTop: 12 }}>
                  {detail.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
                </div>
              )}
              <pre className="kb-content">{detail.content || '(empty)'}</pre>
              {detail.extra}
            </>
          )}

          {detail && editing && (
            <>
              <div className="kb-detail-head">
                <h2 className="kb-title">Editing {kindLabel}</h2>
              </div>
              <label className="kb-label">Title</label>
              <input
                className="kb-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label className="kb-label">Content</label>
              <textarea
                className="kb-textarea"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={16}
              />
              <label className="kb-label">Tags (comma-separated)</label>
              <input
                className="kb-input"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              {error && <div className="kb-error" style={{ marginTop: 10 }}>{error}</div>}
              <div className="kb-actions">
                <button className="btn primary" onClick={onSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
