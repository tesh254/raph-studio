import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-bricolage',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: 'raph studio',
  description:
    'Live explorer for your local raph knowledge graph — nodes, edges, memory, docs, and agent activity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${robotoMono.variable}`}>
      <body>
        <div className="app">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
