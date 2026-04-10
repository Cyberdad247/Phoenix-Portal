'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRealtimeQR } from '@/hooks/useRealtimeQR';
import { useLeadGen } from '@/hooks/useLeadGen';

interface QRCodeConfig {
  id: string;
  label: string;
  url: string;
  badge?: string;
  icon: string;
  description: string;
}

export function RealtimeQRSection() {
  const { qrData, isConnected, leaderboard } = useRealtimeQR();
  const { open } = useLeadGen();
  
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({
    book: Array(20).fill(0),
    interview: Array(20).fill(0),
    playlist: Array(20).fill(0)
  });

  const qrCodes: QRCodeConfig[] = [
    {
      id: 'book',
      label: 'The 1% Theorem',
      url: generateTrackingUrl('book'),
      badge: 'MOST POPULAR',
      icon: '📖',
      description: 'Instant download of the complete manuscript'
    },
    {
      id: 'interview',
      label: 'Revelator Access',
      url: generateTrackingUrl('interview'),
      icon: '🎙️',
      description: 'Unedited 3-hour consciousness breakthrough session'
    },
    {
      id: 'playlist',
      label: 'Audio Archives',
      url: generateTrackingUrl('playlist'),
      badge: 'NEW',
      icon: '🔊',
      description: 'Frequency-encoded teachings for daily activation'
    }
  ];

  useEffect(() => {
    Object.entries(qrData).forEach(([id, data]) => {
      setSparklineData(prev => ({
        ...prev,
        [id]: [...prev[id].slice(1), data.velocity]
      }));
    });
  }, [qrData]);

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-black via-[#0a0a0a] to-black border-y border-[#222]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 mb-6">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs uppercase tracking-wider text-[#d4af37]">
              {isConnected ? 'Live Network' : 'Reconnecting...'}
            </span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-[#d4af37] tracking-wider mb-4">
            MOBILE ACCESS PORTALS
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Scan to unlock. Each code bridges physical and digital realms.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {qrCodes.map((qr, index) => {
            const liveData = qrData[qr.id];
            const scans = liveData?.todayScans || 0;
            const velocity = liveData?.velocity || 0;
            const isHot = liveData?.hotspot || velocity > 5;

            return (
              <div key={qr.id} className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-b ${isHot ? 'from-[#d4af37]/20' : 'from-[#d4af37]/5'} to-transparent rounded-2xl blur-xl transition-opacity duration-500 ${isHot ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                
                <div className="relative bg-[#0a0a0a]/80 backdrop-blur border border-[#222] rounded-2xl p-8 hover:border-[#d4af37]/50 transition-all duration-500 overflow-hidden">
                  {isHot && (
                    <div className="absolute top-4 right-4">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d4af37] opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#d4af37]" />
                      </span>
                    </div>
                  )}

                  {qr.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-[#d4af37] text-black text-xs font-bold tracking-wider rounded-full">
                        {qr.badge}
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="text-5xl mb-3">{qr.icon}</div>
                    <h3 className="text-xl font-bold text-[#d4af37] tracking-wider">
                      {qr.label}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">{qr.description}</p>
                  </div>

                  <div className="relative bg-white p-4 rounded-xl w-56 h-56 mx-auto mb-6 shadow-2xl">
                    <QRCodeSVG
                      value={qr.url}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#050505"
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm uppercase tracking-wider">Today&apos;s Scans</span>
                      <span className="text-3xl font-bold">{scans.toLocaleString()}</span>
                    </div>

                    <div className="pt-4 border-t border-[#222] flex justify-between text-sm">
                      <span className="text-gray-600">All Time</span>
                      <span className="text-gray-400">
                        {(liveData?.totalScans || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => downloadQR(qr)}
                      className="py-3 px-4 border border-[#333] rounded-lg text-sm text-gray-400 hover:text-[#d4af37] hover:border-[#d4af37] transition-colors"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => open(`qr-${qr.id}`)}
                      className="py-3 px-4 bg-[#d4af37] text-black rounded-lg text-sm font-bold hover:bg-[#f4d03f] transition-colors"
                    >
                      Get Access
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {leaderboard && (
          <div className="mt-16 bg-[#0a0a0a]/50 border border-[#222] rounded-2xl p-8">
            <h3 className="text-xl font-bold text-[#d4af37] mb-6 text-center tracking-wider">
              TOP ACTIVATION SOURCES
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {leaderboard.topSources?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 flex items-center justify-center text-[#d4af37] font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-300 capitalize">{String(item).replace(/_/g, ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function generateTrackingUrl(campaign: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://phoenixportal.com';
  const params = new URLSearchParams({
    utm_source: 'qr',
    utm_medium: 'print',
    utm_campaign: campaign,
    _ts: Date.now().toString()
  });
  return `${base}/?${params.toString()}`;
}

function downloadQR(qr: QRCodeConfig) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 1000;
  canvas.height = 1200;

  const gradient = ctx.createLinearGradient(0, 0, 1000, 1200);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 1200);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, 940, 1140);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 56px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PHOENIX PORTAL', 500, 120);
  
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '36px system-ui';
  ctx.fillText(qr.label.toUpperCase(), 500, 180);

  ctx.fillStyle = '#fff';
  ctx.fillRect(250, 250, 500, 500);
  
  ctx.fillStyle = '#888';
  ctx.font = '28px system-ui';
  ctx.fillText('Scan to unlock exclusive content', 500, 850);
  
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 32px system-ui';
  ctx.fillText('VaShawn F. HEAD', 500, 950);

  const link = document.createElement('a');
  link.download = `phoenix-qr-${qr.id}.png`;
  link.href = canvas.toDataURL();
  link.click();
}