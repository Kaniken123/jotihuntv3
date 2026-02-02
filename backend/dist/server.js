"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const cron = __importStar(require("node-cron"));
const database_1 = require("./utils/database");
const socketManager_1 = require("./socketManager");
const jotihuntApi_1 = require("./services/jotihuntApi");
const auth_1 = __importDefault(require("./routes/auth"));
const jotihunt_1 = __importDefault(require("./routes/jotihunt"));
const locations_1 = __importDefault(require("./routes/locations"));
const users_1 = __importDefault(require("./routes/users"));
const chat_1 = __importDefault(require("./routes/chat"));
const hunts_1 = __importDefault(require("./routes/hunts"));
const rules_1 = __importDefault(require("./routes/rules"));
const admin_1 = __importDefault(require("./routes/admin"));
const hints_1 = __importDefault(require("./routes/hints"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Define allowed origins for CORS (web app and mobile app)
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://dfef01c8947a.ngrok-free.app",
    "capacitor://localhost", // Capacitor iOS
    "http://localhost", // Capacitor Android
    "ionic://localhost" // Ionic apps
];
const io = new socket_io_1.Server(server, {
    path: '/api/socket.io/',
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "wss:"],
            fontSrc: ["'self'", "https:", "data:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            // For development, allow any origin
            if (process.env.NODE_ENV !== 'production') {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Add cache headers for static content
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    next();
}, express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Serve APK downloads for mobile app
app.use('/downloads', express_1.default.static(path_1.default.join(__dirname, '../downloads')));
app.use('/api/auth', auth_1.default);
app.use('/api/jotihunt', jotihunt_1.default);
app.use('/api/locations', locations_1.default);
app.use('/api', users_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/hunts', hunts_1.default);
app.use('/api/rules', rules_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/hints', hints_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Join tenant-specific rooms
    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        console.log(`User ${socket.id} joined room ${roomName}`);
    });
    // Join tenant-specific general chat
    socket.on('join-tenant-general', (tenantId) => {
        socket.join(`tenant-${tenantId}-general-chat`);
        console.log(`User ${socket.id} joined tenant ${tenantId} general chat`);
    });
    // Join tenant-specific team rooms  
    socket.on('join-team', (teamId, tenantId) => {
        socket.join(`tenant-${tenantId}-team-${teamId}`);
        console.log(`User ${socket.id} joined tenant ${tenantId} team ${teamId}`);
    });
    socket.on('leave-team', (teamId, tenantId) => {
        socket.leave(`tenant-${tenantId}-team-${teamId}`);
        console.log(`User ${socket.id} left tenant ${tenantId} team ${teamId}`);
    });
    socket.on('team-message', (data) => {
        socket.to(`tenant-${data.tenantId}-team-${data.teamId}`).emit('new-message', data);
    });
    socket.on('location-update', (data) => {
        socket.to(`tenant-${data.tenantId}-team-${data.teamId}`).emit('location-updated', data);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
const startServer = async () => {
    try {
        await (0, database_1.initializeDatabase)();
        // Initialize Socket.IO
        (0, socketManager_1.setSocketIO)(io);
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
                    const results = await jotihuntApi_1.JotihuntApiService.syncAll();
                    console.log(`[${new Date().toISOString()}] Auto-sync completed:`, {
                        subscriptions: `${results.subscriptions.synced} synced, ${results.subscriptions.errors} errors`,
                        areas: `${results.areas.synced} synced, ${results.areas.errors} errors`,
                        articles: `${results.articles.synced} synced, ${results.articles.errors} errors`
                    });
                    // Update cache with auto-sync timestamp
                    const { db } = await Promise.resolve().then(() => __importStar(require('./utils/database')));
                    await db('api_cache')
                        .insert({
                        cache_key: 'last_auto_sync',
                        data: JSON.stringify({ auto_sync: true, results }),
                        last_sync: new Date()
                    })
                        .onConflict('cache_key')
                        .merge();
                }
                catch (error) {
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
        }
        else {
            console.log('⚠️  Automatic sync disabled (set ENABLE_AUTO_SYNC=true to enable)');
        }
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            if (enableAutoSync) {
                console.log(`🔄 Auto-sync: Every 3 minutes (1 call/minute safe)`);
            }
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=server.js.map