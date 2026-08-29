import './loadEnv'; // MUST be first: loads backend/.env before any module reads process.env
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import * as cron from 'node-cron';

import { initializeDatabase } from './utils/database';
import { setSocketIO } from './socketManager';
import { setupSocket } from './socketAuth';
import { JotihuntApiService } from './services/jotihuntApi';
import authRoutes from './routes/auth';
import jotihuntRoutes from './routes/jotihunt';
import locationRoutes from './routes/locations';
import userRoutes from './routes/users';
import chatRoutes from './routes/chat';
import huntRoutes from './routes/hunts';
import rulesRoutes from './routes/rules';
import adminRoutes from './routes/admin';
import hintsRoutes from './routes/hints';

const app = express();
// Behind nginx: trust the first proxy hop so req.ip reflects the real client
// (X-Forwarded-For) — required for per-IP rate limiting to work correctly.
app.set('trust proxy', 1);
const server = createServer(app);
const io = new Server(server, {
  path: '/api/socket.io/',
  cors: {
    // Reflect the request origin. nginx restricts which hostnames reach the
    // app and JWT guards authenticated routes, so a strict allowlist here only
    // breaks production whenever FRONTEND_URL is misconfigured.
    origin: true,
    credentials: true,
    methods: ["GET", "POST"],
  }
});

const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add cache headers for static content
const uploadsCacheHeaders = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  next();
};
const uploadsStatic = express.static(path.join(__dirname, '../uploads'));

// Chat attachments use /uploads/... ; hunt photos are stored as
// /api/uploads/hunts/... . Serve both prefixes from the same directory.
app.use('/uploads', uploadsCacheHeaders, uploadsStatic);
app.use('/api/uploads', uploadsCacheHeaders, uploadsStatic);


app.use('/api/auth', authRoutes);
app.use('/api/jotihunt', jotihuntRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hunts', huntRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hints', hintsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authenticated Socket.IO: verifies the JWT on connect and assigns rooms from
// the user's membership server-side. Clients can no longer join arbitrary rooms.
setupSocket(io);

const startServer = async () => {
  try {
    await initializeDatabase();
    
    // Initialize Socket.IO
    setSocketIO(io);
    
    // Setup automatic sync every 30 seconds
    const isProduction = process.env.NODE_ENV === 'production';
    const enableAutoSync = process.env.ENABLE_AUTO_SYNC !== 'false'; // Default to true unless explicitly disabled
    
    if (enableAutoSync) {
      console.log('Setting up automatic API sync every 3 minutes...');
      
      // Run sync every 3 minutes (*/3 * * * *) to stay under 3 calls/minute safe limit
      // This gives us 3 calls every 3 minutes = 1 call/minute (well within safe limit)
      const cronJob = cron.schedule('*/3 * * * *', async () => {
        try {
          console.log(`[${new Date().toISOString()}] Running automatic API sync...`);
          const results = await JotihuntApiService.syncAll();
          
          console.log(`[${new Date().toISOString()}] Auto-sync completed:`, {
            subscriptions: `${results.subscriptions.synced} synced, ${results.subscriptions.errors} errors`,
            areas: `${results.areas.synced} synced, ${results.areas.errors} errors`, 
            articles: `${results.articles.synced} synced, ${results.articles.errors} errors`
          });
          
          // Update cache with auto-sync timestamp
          const { db } = await import('./utils/database');
          await db('api_cache')
            .insert({
              cache_key: 'last_auto_sync',
              data: JSON.stringify({ auto_sync: true, results }),
              last_sync: new Date()
            })
            .onConflict('cache_key')
            .merge();
            
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Auto-sync failed:`, error);
        }
      });
      
      console.log('✅ Automatic sync scheduled every 3 minutes (1 call/minute - safe limit)');
      
      // Graceful shutdown handling
      const shutdown = () => {
        console.log('Shutting down gracefully...');
        cronJob.stop();
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      };
      
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } else {
      console.log('⚠️  Automatic sync disabled (set ENABLE_AUTO_SYNC=true to enable)');
    }
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      if (enableAutoSync) {
        console.log(`🔄 Auto-sync: Every 3 minutes (1 call/minute safe)`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();