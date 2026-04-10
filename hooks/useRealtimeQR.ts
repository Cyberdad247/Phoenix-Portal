'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface QRData {
  qrId: string;
  totalScans: number;
  todayScans: number;
  deviceType: string;
  velocity: number;
  hotspot: boolean;
  timestamp: string;
}

interface LeadData {
  type: 'captured' | 'downloaded' | 'converted';
  email: string;
  source: string;
  value: number;
  rank: number;
  totalLeadsToday: string;
}

export function useRealtimeQR() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrData, setQrData] = useState<Record<string, QRData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [toast, setToast] = useState<{message: string; type: string} | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.phoenixportal.com';
    const newSocket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to Phoenix realtime server');
      setIsConnected(true);
      newSocket.emit('join-room', 'qr-dashboard');
      setToast({ message: 'Connected to live updates', type: 'success' });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from realtime server');
      setIsConnected(false);
    });

    newSocket.on('qr-update', (data: QRData) => {
      setQrData(prev => ({
        ...prev,
        [data.qrId]: data
      }));

      if (data.velocity > 10) {
        setToast({ message: `${data.qrId} going viral! ${data.velocity} scans/minute`, type: 'info' });
      }
    });

    newSocket.on('initial-qr-data', (data: QRData[]) => {
      const mapped = data.reduce((acc, item) => ({
        ...acc,
        [item.qrId]: item
      }), {});
      setQrData(mapped);
    });

    newSocket.on('new-lead', (data: LeadData) => {
      setToast({ message: `New lead from ${data.source}! Rank #${data.rank}`, type: 'success' });
    });

    newSocket.on('leaderboard-update', (data) => {
      setLeaderboard(data);
    });

    newSocket.on('progress-update', (stats) => {
      window.dispatchEvent(new CustomEvent('stats-update', { detail: stats }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emitScan = useCallback((qrId: string, metadata?: any) => {
    if (!socket?.connected) return;

    socket.emit('qr-scan', {
      qrId,
      deviceType: getDeviceType(),
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      utmParams: getUTMParams(),
      ...metadata
    });
  }, [socket]);

  const joinRoom = useCallback((room: string) => {
    socket?.emit('join-room', room);
  }, [socket]);

  return {
    socket,
    isConnected,
    qrData,
    leaderboard,
    emitScan,
    joinRoom,
    toast
  };
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('phoenix_session');
  if (!sessionId) {
    sessionId = `phx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('phoenix_session', sessionId);
  }
  return sessionId;
}

function getUTMParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || 'direct',
    medium: params.get('utm_medium') || 'none',
    campaign: params.get('utm_campaign') || 'none',
    customer_id: params.get('cid') || ''
  };
}