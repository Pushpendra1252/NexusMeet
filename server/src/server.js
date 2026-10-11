import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

// Request logger for development
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'NexusMeet Video Conferencing API',
    phase: 'Phase 7 - Reliability Audit & Code Quality',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Attach Socket.IO event handlers
setupSocketHandlers(io);

// Phase placeholder route notice for future endpoints
app.use('/api/*', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented Yet',
    message: 'Authentication and database routes will be enabled in future phases.',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server with Socket.IO attached
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` NexusMeet Server running on port ${PORT}`);
  console.log(` Socket.IO signaling active on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Allowed Client Origin: ${CLIENT_URL}`);
  console.log(`===============================================`);
});
