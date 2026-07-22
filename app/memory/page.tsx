'use client';

import KnowledgeBrowser from '@/components/KnowledgeBrowser';
import { api } from '@/lib/api';

function fmt(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

export default function MemoryPage() {
  return (
    <KnowledgeBrowser
      kindLabel="memory"
      emptyHint="No memories yet — agents write them via store_memory and store_rule."
      load={async (q, signal) => {
        const r = await api.memories(q, signal);
        return (r.items || []).map((m) => ({
          id: m.node.id,
          name: m.node.name || m.memory_key,
          badge: m.knowledge_type,
          badgeCls: 'badge other',
          meta: `${m.scope_type}:${m.scope_id} · rev ${m.revision}${m.lifecycle_state !== 'active' ? ` · ${m.lifecycle_state}` : ''}`,
        }));
      }}
      loadDetail={async (id, signal) => {
        const { record, revisions: revs } = await api.memory(id, signal);
        const revisions = revs || [];
        return {
          id: record.node.id,
          name: record.node.name,
          content: record.node.content || '',
          tags: record.display_tags || [],
          // Deprecated/replaced memories are read-only; editing would resurrect them.
          editable: record.lifecycle_state === 'active',
          fields: [
            { label: 'Type', value: record.knowledge_type },
            { label: 'Scope', value: `${record.scope_type}:${record.scope_id}` },
            { label: 'State', value: record.lifecycle_state },
            { label: 'Writer', value: record.writer_id },
            { label: 'Revision', value: String(record.revision) },
            { label: 'Updated', value: fmt(record.updated_at) },
          ],
          extra: revisions.length > 0 ? (
            <div className="kb-extra">
              <div className="kb-extra-head">History <b>{revisions.length}</b></div>
              {revisions.map((rev) => (
                <div className="kb-rev" key={rev.revision}>
                  <span className="kb-rev-n">rev {rev.revision}</span>
                  <span className="kb-rev-meta">{rev.writer_id || '—'} · {fmt(rev.created_at)}</span>
                </div>
              ))}
            </div>
          ) : null,
        };
      }}
      save={async (id, patch) => { await api.updateMemory({ node_id: id, ...patch }); }}
    />
  );
}
