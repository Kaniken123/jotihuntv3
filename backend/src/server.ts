import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import * as cron from 'node-cron';

import { initializeDatabase } from './utils/database';
import { setSocketIO } from './socketManager';
import { JotihuntApiService } from './services/jotihuntApi';
import authRoutes from './routes/auth';
import jotihuntRoutes from './routes/jotihunt';
import locationRoutes from './routes/locations';
import userRoutes from './routes/users';
import chatRoutes from './routes/chat';
import huntRoutes from './routes/hunts';
import rulesRoutes from './routes/rules';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/jotihunt', jotihuntRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hunts', huntRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-team', (teamId) => {
    socket.join(`team-${teamId}`);
    console.log(`User ${socket.id} joined team ${teamId}`);
  });

  socket.on('leave-team', (teamId) => {
    socket.leave(`team-${teamId}`);
    console.log(`User ${socket.id} left team ${teamId}`);
  });

  socket.on('team-message', (data) => {
    socket.to(`team-${data.teamId}`).emit('new-message', data);
  });

  socket.on('location-update', (data) => {
    socket.to(`team-${data.teamId}`).emit('location-updated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const startServer = async () => {
  try {
    await initializeDatabase();
    
    // Initialize Socket.IO
    setSocketIO(io);
    
    // Setup automatic sync every 30 seconds
    const isProduction = process.env.NODE_ENV === 'production';
    const enableAutoSync = process.env.ENABLE_AUTO_SYNC !== 'false'; // Default to true unless explicitly disabled
    
    if (enableAutoSync) {
      console.log('Setting up automatic API sync every 30 seconds...');
      
      // Run sync every 30 seconds (*/30 * * * * *)
      cron.schedule('*/30 * * * * *', async () => {
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
      
      console.log('✅ Automatic sync scheduled every 30 seconds');
    } else {
      console.log('⚠️  Automatic sync disabled (set ENABLE_AUTO_SYNC=true to enable)');
    }
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      if (enableAutoSync) {
        console.log(`🔄 Auto-sync: Every 30 seconds`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();