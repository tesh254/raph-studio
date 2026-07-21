'use client';

// The graph moved to the home page; keep old /graph/ links working.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function GraphRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
