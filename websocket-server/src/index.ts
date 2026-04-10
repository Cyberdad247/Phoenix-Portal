import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';

const redis = new Redis(process.env.UPSTASH_REDIS_URL!);
const redisPub = new Redis(process.env.UPSTASH_REDIS_URL!);
const redisSub = new Redis(process.env.UPSTASH_REDIS_URL!);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://phoenixportal.com',
      'https://headartworks.com',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

const ROOMS = {
  QR_DASHBOARD: 'qr-dashboard',
  LEAD_UPDATES: 'lead-updates',
  ANALYTICS: 'analytics'
};

interface QRScanEvent {
  qrId: string;
  location?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  timestamp: string;
  utmParams?: Record<string, string>;
  sessionId: string;
}

interface LeadEvent {
  type: 'captured' | 'downloaded' | 'converted';
  customerId?: string;
  email: string;
  source: string;
  value: number;
  timestamp: string;
}

class PhoenixRealtimeServer {
  constructor() {
    this.initializeRedis();
    this.initializeSocketHandlers();
    this.startLeaderboardUpdates();
  }

  private initializeRedis() {
    redisSub.subscribe('qr-scans', 'lead-events', 'system-updates');
    
    redisSub.on('message', (channel, message) => {
      const data = JSON.parse(message);
      
      switch (channel) {
        case 'qr-scans':
          this.broadcastQRUpdate(data);
          break;
        case 'lead-events':
          this.broadcastLeadUpdate(data);
          break;
        case 'system-updates':
          io.emit('system-update', data);
          break;
      }
    });
  }

  private initializeSocketHandlers() {
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      socket.on('join-room', (room: string) => {
        socket.join(room);
        console.log(`${socket.id} joined ${room}`);
        
        if (room === ROOMS.QR_DASHBOARD) {
          this.sendInitialQRData(socket);
        }
      });

      socket.on('qr-scan', async (scanData: QRScanEvent) => {
        await this.handleQRScan(scanData, socket);
      });

      socket.on('lead-captured', async (leadData: LeadEvent) => {
        await this.handleLeadCapture(leadData, socket);
      });

      socket.on('get-leaderboard', async (callback) => {
        const data = await this.getLeaderboardData();
        callback(data);
      });

      socket.on('subscribe-analytics', (timeframe: string) => {
        socket.join(`${ROOMS.ANALYTICS}-${timeframe}`);
        this.sendAnalyticsSnapshot(socket, timeframe);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private async handleQRScan(scanData: QRScanEvent, socket: any) {
    const { qrId, deviceType, utmParams, sessionId } = scanData;
    
    const today = new Date().toISOString().split('T')[0];
    const counterKey = `qr:scans:${qrId}:${today}`;
    const totalScans = await redis.incr(counterKey);
    
    const scanRecord = {
      ...scanData,
      processedAt: new Date().toISOString()
    };
    
    await redis.lpush(`qr:history:${qrId}`, JSON.stringify(scanRecord));
    await redis.ltrim(`qr:history:${qrId}`, 0, 999);

    const updatePayload = {
      qrId,
      totalScans,
      todayScans: totalScans,
      deviceType,
      timestamp: scanData.timestamp,
      hotspot: await this.detectHotspot(qrId),
      velocity: await this.calculateScanVelocity(qrId)
    };

    io.to(ROOMS.QR_DASHBOARD).emit('qr-update', updatePayload);
    redisPub.publish('qr-scans', JSON.stringify(updatePayload));

    socket.emit('scan-confirmed', {
      status: 'success',
      message: 'Access granted',
      redirectUrl: this.getRedirectUrl(qrId, utmParams)
    });

    console.log(`QR Scan: ${qrId} | Total: ${totalScans}`);
  }

  private async handleLeadCapture(leadData: LeadEvent, socket: any) {
    await redis.zincrby('leaderboard:leads', 1, leadData.source);
    await redis.zincrby('leaderboard:value', leadData.value, leadData.source);

    const broadcastData = {
      ...leadData,
      rank: await this.getLeadRank(leadData.source),
      totalLeadsToday: await redis.get('stats:leads:today')
    };

    io.to(ROOMS.LEAD_UPDATES).emit('new-lead', broadcastData);
    redisPub.publish('lead-events', JSON.stringify(broadcastData));
    this.broadcastProgressUpdate();
  }

  private async detectHotspot(qrId: string): Promise<boolean> {
    const recentScans = await redis.lrange(`qr:history:${qrId}`, 0, 10);
    return recentScans.length >= 5;
  }

  private async calculateScanVelocity(qrId: string): Promise<number> {
    const oneMinuteAgo = Date.now() - 60000;
    const scans = await redis.lrange(`qr:history:${qrId}`, 0, 100);
    
    return scans.filter((scan: string) => {
      const data = JSON.parse(scan);
      return new Date(data.timestamp).getTime() > oneMinuteAgo;
    }).length;
  }

  private async sendInitialQRData(socket: any) {
    const qrIds = ['book', 'interview', 'playlist'];
    const data = await Promise.all(
      qrIds.map(async (id) => ({
        qrId: id,
        totalScans: await this.getTotalScans(id),
        todayScans: await this.getTodayScans(id),
        velocity: await this.calculateScanVelocity(id),
        history: await redis.lrange(`qr:history:${id}`, 0, 10)
      }))
    );
    
    socket.emit('initial-qr-data', data);
  }

  private async getTotalScans(qrId: string): Promise<number> {
    const keys = await redis.keys(`qr:scans:${qrId}:*`);
    let total = 0;
    for (const key of keys) {
      total += parseInt(await redis.get(key) || '0');
    }
    return total;
  }

  private async getTodayScans(qrId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    return parseInt(await redis.get(`qr:scans:${qrId}:${today}`) || '0');
  }

  private async getLeaderboardData() {
    const sources = await redis.zrevrange('leaderboard:leads', 0, 9, 'WITHSCORES');
    return {
      topSources: sources,
      lastUpdated: new Date().toISOString()
    };
  }

  private async getLeadRank(source: string): Promise<number> {
    const rank = await redis.zrevrank('leaderboard:leads', source);
    return rank !== null ? rank + 1 : 0;
  }

  private broadcastQRUpdate(data: any) {
    io.to(ROOMS.QR_DASHBOARD).emit('qr-update', data);
  }

  private broadcastLeadUpdate(data: any) {
    io.to(ROOMS.LEAD_UPDATES).emit('lead-update', data);
  }

  private async broadcastProgressUpdate() {
    const stats = {
      totalLeads: await redis.get('stats:leads:total'),
      todayLeads: await redis.get('stats:leads:today'),
      conversionRate: await this.calculateConversionRate()
    };
    
    io.emit('progress-update', stats);
  }

  private async calculateConversionRate(): Promise<number> {
    const leads = parseInt(await redis.get('stats:leads:today') || '0');
    const visitors = parseInt(await redis.get('stats:visitors:today') || '1');
    return Math.round((leads / visitors) * 100);
  }

  private async sendAnalyticsSnapshot(socket: any, timeframe: string) {
    const data = await this.getAnalyticsData(timeframe);
    socket.emit('analytics-snapshot', data);
  }

  private async getAnalyticsData(timeframe: string) {
    return {
      timeframe,
      scans: [],
      leads: [],
      conversions: []
    };
  }

  private getRedirectUrl(qrId: string, utmParams?: Record<string, string>): string {
    const baseUrls: Record<string, string> = {
      book: 'https://phoenixportal.com/download/ebook',
      interview: 'https://phoenixportal.com/watch/interview',
      playlist: 'https://phoenixportal.com/playlist'
    };
    
    const url = new URL(baseUrls[qrId] || baseUrls.book);
    
    if (utmParams) {
      Object.entries(utmParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }

  private startLeaderboardUpdates() {
    setInterval(async () => {
      const data = await this.getLeaderboardData();
      io.to(ROOMS.ANALYTICS).emit('leaderboard-update', data);
    }, 30000);
  }
}

const phoenixServer = new PhoenixRealtimeServer();

httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: io.engine.clientsCount,
      uptime: process.uptime()
    }));
  }
});

const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Phoenix WebSocket Server running on port ${PORT}`);
});