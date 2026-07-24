'use client';

import KnowledgeBrowser from '@/components/KnowledgeBrowser';
import { api } from '@/lib/api';

function fmt(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

function statusBadgeCls(status?: string): string {
  return 'badge status-' + (status || 'fresh');
}

function tagsOf(props?: Record<string, string>): string[] {
  const raw = (props?.tags || '').trim();
  return raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

export default function HandoversPage() {
  return (
    <KnowledgeBrowser
      kindLabel="handover"
      emptyHint="No handovers yet — agents create them with add_document (doc_type: handoff) to pass work along."
      load={async (q, signal) => {
        const r = await api.handoffs(q, signal);
        return (r.items || []).map((n) => ({
          id: n.id,
          name: n.name,
          badge: n.properties?.status || 'fresh',
          badgeCls: statusBadgeCls(n.properties?.status),
          meta: `${n.properties?.writer_id || 'agent'} · ${fmt(n.updated_at)}`,
        }));
      }}
      loadDetail={async (id, signal) => {
        const doc = await api.document(id, signal);
        const n = doc.node;
        return {
          id: n.id,
          name: n.name,
          content: n.content || '',
          tags: tagsOf(n.properties),
          editable: true,
          fields: [
            { label: 'Status', value: n.properties?.status || 'fresh' },
            { label: 'Writer', value: n.properties?.writer_id || '—' },
            { label: 'Source', value: n.properties?.source || '—' },
            { label: 'Chunks', value: String(doc.chunk_count) },
            { label: 'Updated', value: fmt(n.updated_at) },
          ],
        };
      }}
      save={async (id, patch) => { await api.updateDocument({ id, ...patch }); }}
      onDelete={async (id) => { await api.deleteDocument(id); }}
    />
  );
}
