import './globals.css';
import type { Metadata } from 'next';
import { RealtimeQRSection } from '@/components/phoenix/RealtimeQRSection';

export const metadata: Metadata = {
  title: 'VaShawn F. HEAD | The Phoenix Portal - The 1% Theorem',
  description: 'Unlock the Skeleton Key. Psychic Defragmentation methodology by VaShawn F. HEAD.',
};

export default function Home() {
  return (
    <main className="phoenix-portal bg-[#050505] text-[#e0e0e0] min-h-screen">
      <RealtimeQRSection />
    </main>
  );
}