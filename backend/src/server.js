require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const eventRoutes = require('./modules/events/events.routes');
const fileRoutes = require('./modules/files/files.routes');
const taskRoutes = require('./modules/tasks/tasks.routes');

// Jobs & Socket
const { startFileCleanupJob } = require('./jobs/fileCleanup.job');
const { initSocketHandler } = require('./socket/socket.handler');

const app = express();
const server = http.createServer(app);

// ============================================================
// Socket.io Setup
// ============================================================
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e9, // 1GB cho upload qua socket nếu cần
});

// ============================================================
// Express Middleware
// ============================================================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log requests trong development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================
// API Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tasks', taskRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route không tồn tại: ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Lỗi máy chủ',
  });
});

// ============================================================
// Initialize WebSocket Handler
// ============================================================
initSocketHandler(io);

// ============================================================
// Start Background Jobs
// ============================================================
startFileCleanupJob(io);

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║       Student Workspace Backend Server           ║
╠══════════════════════════════════════════════════╣
║  🚀 Server:    http://localhost:${PORT}             ║
║  📡 WebSocket: ws://localhost:${PORT}               ║
║  🌿 Env:       ${(process.env.NODE_ENV || 'development').padEnd(34)}║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
