import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'raph studio',
  description: 'Live explorer for your local raph knowledge graph — nodes, edges, memory, docs, and agent activity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
