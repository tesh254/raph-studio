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
  // Optional permanent delete. When provided, a Delete action appears in the
  // detail view (with an inline confirm).
  onDelete?: (id: string) => Promise<void>;
}

export default function KnowledgeBrowser({ kindLabel, emptyHint, load, loadDetail, save, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BrowserDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);
  // Hold the loaders in refs so refresh/openDetail keep a stable identity even
  // though the pages pass fresh inline callbacks on every render.
  const loadRef = useRef(load); loadRef.current = load;
  const loadDetailRef = useRef(loadDetail); loadDetailRef.current = loadDetail;
  // Latest query/selection, so async completions (save, delete) refresh and
  // reconcile against what's current now — not what was current when they began.
  const queryRef = useRef(query); queryRef.current = query;
  const selectedIdRef = useRef(selectedId); selectedIdRef.current = selectedId;
  const deletingRef = useRef(deleting); deletingRef.current = deleting;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);

  // Abort any in-flight list request before starting a new one so a slower,
  // earlier query can't overwrite the results of a later one.
  const refresh = useCallback((q: string) => {
    listAbort.current?.abort();
    const ctrl = new AbortController();
    listAbort.current = ctrl;
    loadRef.current(q, ctrl.signal)
      .then((its) => { if (!ctrl.signal.aborted) { setItems(its); setOffline(false); } })
      .catch((e) => { if (e?.name !== 'AbortError') setOffline(true); });
  }, []);

  useEffect(() => {
    refresh('');
    // On unmount, drop the debounce timer and any in-flight requests so they
    // can't call setState after the component is gone.
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      listAbort.current?.abort();
      detailAbort.current?.abort();
    };
  }, [refresh]);

  // Dismiss the delete modal, clearing any error from an abandoned attempt so
  // it doesn't linger in the detail view (matches the edit-Cancel convention).
  const dismissDelete = () => { setConfirmingDelete(false); setError(null); };

  // Modal lifecycle while the delete confirmation is open: lock body scroll,
  // move focus into the dialog, trap Tab within it, close on Escape, and
  // restore focus to the trigger on close. deletingRef avoids re-running this
  // (and stealing focus) when the in-flight `deleting` flag toggles.
  useEffect(() => {
    if (!confirmingDelete) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () => Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [],
    );
    focusable()[0]?.focus(); // land on Cancel (the safe default) for a destructive action

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!deletingRef.current) dismissDelete();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusable();
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      deleteTriggerRef.current?.focus(); // restore focus to the Delete trigger
    };
  }, [confirmingDelete]);

  const onQuery = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => refresh(q), 220);
  };

  // Same guard for detail loads: a superseded selection must not win.
  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setEditing(false);
    setConfirmingDelete(false);
    setError(null);
    setDetail(null);
    detailAbort.current?.abort();
    const ctrl = new AbortController();
    detailAbort.current = ctrl;
    loadDetailRef.current(id, ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) setDetail(d); })
      .catch((e) => { if (e?.name !== 'AbortError') setError(e?.message || 'Failed to load'); });
  }, []);

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
      openDetail(detail.id);       // reload the saved record
      refresh(queryRef.current);   // reflect title/tag changes for the current query
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteConfirmed = async () => {
    if (!detail || !onDelete) return;
    const id = detail.id;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(id);
      setConfirmingDelete(false);
      // Only clear the detail pane if the just-deleted item is still selected —
      // the user may have navigated to another memory while the delete ran.
      if (selectedIdRef.current === id) {
        setSelectedId(null);
        setDetail(null);
      }
      refresh(queryRef.current); // drop the deleted item, honoring the current query
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
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
                {onDelete && (
                  <button
                    className="btn danger"
                    onClick={(e) => { deleteTriggerRef.current = e.currentTarget; setConfirmingDelete(true); setError(null); }}
                  >Delete</button>
                )}
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

      {onDelete && confirmingDelete && detail && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-del-title"
          aria-describedby="kb-del-desc"
          onClick={() => { if (!deleting) dismissDelete(); }}
        >
          <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <h3 id="kb-del-title" className="modal-title">Delete {kindLabel}?</h3>
            <p id="kb-del-desc" className="modal-body">
              <b>{detail.name}</b> will be permanently deleted. This can&apos;t be undone.
            </p>
            {error && <div className="kb-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={dismissDelete} disabled={deleting}>Cancel</button>
              <button className="btn danger" onClick={onDeleteConfirmed} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
