const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5002;

const FRONTEND_URL = process.env.FRONTEND_URL;

const allowedOrigins = new Set([
  // Production frontend (Render/Vercel)
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),

  'https://medi-meet-rose.vercel.app',

  // Existing dev tunnel origins (kept as-is)
  'https://gkdspbv6-5173.inc1.devtunnels.ms',
  'https://gkdspbv6-5002.inc1.devtunnels.ms',

  // Local development origins (kept as-is)
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5002',
  'http://127.0.0.1:5002',
]);

const allowedOriginPatterns = [
  /^https?:\/\/localhost:\d+$/,
  /^https?:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/[a-z0-9-]+-\d+\.inc1\.devtunnels\.ms$/,
  /^https:\/\/[a-z0-9-]+-\d+\.devtunnels\.ms$/,
  /^https:\/\/.*\.vscode-tunnels\.com$/,
  /^https:\/\/.*\.ngrok-free\.dev$/,
  /^https:\/\/.*\.ngrok-free\.app$/,
  /^https:\/\/.*\.ngrok\.io$/,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.has(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Bypass-Tunnel-Reminder',
    'bypass-tunnel-reminder',
    'Ngrok-Skip-Browser-Warning',
    'ngrok-skip-browser-warning',
    'X-Requested-With',
  ],
  optionsSuccessStatus: 204,
};

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by Socket.IO CORS: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json());
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRequests = {};
const rateLimitedAuthPaths = new Set([
  '/register',
  '/login',
  '/login/verify-otp',
  '/forgotpassword',
  '/resetpassword',
  '/doctor/login',
  '/doctor/verify-otp',
  '/doctor/forgot-password',
  '/doctor/verify-reset-otp',
  '/doctor/reset-password',
]);

app.use('/api/auth', (req, res, next) => {
  if (req.method === 'OPTIONS' || !rateLimitedAuthPaths.has(req.path)) {
    return next();
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const isLocalIp =
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost';

  // Do not throttle localhost development traffic.
  if (isLocalIp && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const emailKey = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'anon';
  const limiterKey = `${ip}:${emailKey}`;
  const now = Date.now();
  authRequests[limiterKey] = (authRequests[limiterKey] || []).filter((time) => now - time < 15 * 60 * 1000);

  if (authRequests[limiterKey].length >= 20) {
    return res.status(429).json({ message: 'Too many requests. Try again later.' });
  }

  authRequests[limiterKey].push(now);
  return next();
});

io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;
  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on('join-room', (payload = {}, ack) => {
    const { roomId } = payload || {};
    if (typeof roomId !== 'string' || !roomId.trim()) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'roomId is required' });
      }
      return;
    }

    const safeRoomId = roomId.trim();
    if (safeRoomId.startsWith('user:')) {
      const requestedUserId = safeRoomId.slice('user:'.length);
      if (userId && String(userId) === requestedUserId) {
        socket.join(safeRoomId);
        if (typeof ack === 'function') {
          ack({ ok: true, roomId: safeRoomId, peerCount: 0 });
        }
      } else if (typeof ack === 'function') {
        ack({ ok: false, error: 'Not authorized to join user room' });
      }
      return;
    }

    const room = io.sockets.adapter.rooms.get(safeRoomId);
    const peerCount = room ? room.size : 0;

    socket.join(safeRoomId);
    if (typeof ack === 'function') {
      ack({ ok: true, roomId: safeRoomId, peerCount });
    }
    socket.to(safeRoomId).emit('peer-joined', { socketId: socket.id });
  });

  socket.on('call-user', (payload = {}) => {
    const { targetUserId, appointmentId, callerName } = payload || {};
    if (!targetUserId || !appointmentId) return;

    io.to(`user:${targetUserId}`).emit('incoming-call', {
      appointmentId,
      callerName: callerName || 'Doctor',
      callerSocketId: socket.id,
    });
  });

  socket.on('send-offer', (payload = {}) => {
    const { roomId, sdp } = payload || {};
    if (!roomId || !sdp) return;
    socket.to(roomId).emit('receive-offer', { sdp, from: socket.id });
  });

  socket.on('make-answer', (payload = {}) => {
    const { roomId, sdp } = payload || {};
    if (!roomId || !sdp) return;
    socket.to(roomId).emit('receive-answer', { sdp, from: socket.id });
  });

  socket.on('ice-candidate', (payload = {}) => {
    const { roomId, candidate } = payload || {};
    if (!roomId || !candidate) return;
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('hang-up', (payload = {}) => {
    const { roomId } = payload || {};
    if (!roomId) return;
    socket.to(roomId).emit('call-ended');
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/records', require('./routes/recordRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/doctor-records', require('./routes/doctorRecordsRoutes'));

app.use(errorHandler);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing backend process or set a different PORT in backend/.env.`);
    process.exit(1);
  }

  console.error('Server failed to start:', error);
  process.exit(1);
});

const startServer = async () => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('API: /api/auth, /api/doctors, /api/appointments, /api/payments, /api/ai, /api/records, /api/prescriptions');
  });

  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.server = server;
module.exports.startServer = startServer;
