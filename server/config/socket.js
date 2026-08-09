import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

export function initSocket(httpServer) {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      // Mobile apps / emulators often send no Origin — allow when missing;
      // otherwise whitelist CLIENT_URL (comma-separated).
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(null, allowedOrigins.includes(origin));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
    pingInterval: 10000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.on('join:customer', (customerId) => {
      if (customerId) socket.join(`customer:${customerId}`);
    });
    socket.on('leave:customer', (customerId) => {
      if (customerId) socket.leave(`customer:${customerId}`);
    });
  });

  console.log('Socket.io initialized');
  return io;
}

export function getIO() {
  return io;
}

export function emitToUser(userId, event, data) {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToCustomerRoom(customerId, event, data) {
  io?.to(`customer:${customerId}`).emit(event, data);
}

export function isUserOnline(userId) {
  if (!io || !userId) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId.toString()}`);
  return Boolean(room && room.size > 0);
}
