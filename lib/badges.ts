// Shared node-type → badge class mapping. The color truth for each type lives
// in globals.css (.badge.<type>); this keeps the "which types have a dedicated
// color" list in one place instead of copy-pasted per page.
export const KNOWN_TYPES = [
  'func',
  'type',
  'file',
  'doc',
  'doc_chunk',
  'file_chunk',
  'markdown_chunk',
  'memory',
  'const',
  'var',
];

export function badgeClass(type: string): string {
  return 'badge ' + (KNOWN_TYPES.includes(type) ? type : 'other');
}
