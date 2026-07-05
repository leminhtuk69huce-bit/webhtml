const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * Xử lý WebSocket connections với Socket.io
 * - Authenticate user bằng JWT khi connect
 * - Push reminder khi user kết nối
 * - Broadcast reminder mỗi 30 phút
 */

// Lưu map userId -> Set<socketId> để quản lý nhiều tab
const connectedUsers = new Map();

const initSocketHandler = (io) => {
  // Middleware xác thực Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('NO_TOKEN'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (err) {
        return next(new Error('INVALID_TOKEN'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId, isActive: true },
        include: {
          permissions: { select: { module: true } },
        },
      });

      if (!user) {
        return next(new Error('USER_NOT_FOUND'));
      }

      // Gắn user info vào socket
      socket.user = {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        permissions: user.permissions.map((p) => p.module),
      };

      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('AUTH_ERROR'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`🔌 Socket connected: ${user.displayName} (${socket.id})`);

    // Đăng ký socket vào user's room
    socket.join(`user:${user.id}`);

    // Lưu vào map
    if (!connectedUsers.has(user.id)) {
      connectedUsers.set(user.id, new Set());
    }
    connectedUsers.get(user.id).add(socket.id);

    // Push reminders ngay khi kết nối (nếu có quyền CALENDAR)
    if (user.role === 'ADMIN' || user.permissions.includes('CALENDAR')) {
      await pushRemindersToUser(socket, user.id);
    }

    // Client request refresh reminders thủ công
    socket.on('reminder:refresh', async () => {
      if (user.role === 'ADMIN' || user.permissions.includes('CALENDAR')) {
        await pushRemindersToUser(socket, user.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${user.displayName} — ${reason}`);
      const userSockets = connectedUsers.get(user.id);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(user.id);
        }
      }
    });
  });

  // Broadcast reminder mỗi 30 phút đến tất cả user đang online có quyền CALENDAR
  setInterval(async () => {
    console.log('🔔 Broadcasting reminders to all connected users...');

    for (const [userId] of connectedUsers) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { permissions: { select: { module: true } } },
        });

        if (!user) continue;

        const hasCalendar =
          user.role === 'ADMIN' ||
          user.permissions.some((p) => p.module === 'CALENDAR');

        if (hasCalendar) {
          const reminders = await getUpcomingReminders();
          if (reminders.length > 0) {
            io.to(`user:${userId}`).emit('reminder:check', { reminders });
          }
        }
      } catch (err) {
        console.error(`Reminder broadcast error for user ${userId}:`, err);
      }
    }
  }, 30 * 60 * 1000); // 30 phút

  return io;
};

// Helper: lấy reminders và push đến socket cụ thể
async function pushRemindersToUser(socket, userId) {
  try {
    const reminders = await getUpcomingReminders();
    socket.emit('reminder:check', { reminders });
    console.log(`🔔 Pushed ${reminders.length} reminders to ${socket.user.displayName}`);
  } catch (error) {
    console.error('Push reminders error:', error);
  }
}

// Helper: query events sắp deadline (hôm nay + ngày mai)
async function getUpcomingReminders() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 2);
  tomorrow.setHours(0, 0, 0, 0);

  const events = await prisma.event.findMany({
    where: {
      deadlineAt: {
        gte: now,
        lt: tomorrow,
      },
    },
    include: {
      user: { select: { id: true, displayName: true } },
    },
    orderBy: { deadlineAt: 'asc' },
  });

  return events.map((e) => {
    const hoursLeft = Math.ceil((new Date(e.deadlineAt) - now) / (1000 * 60 * 60));
    const todayStr = now.toDateString();
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);

    return {
      id: e.id,
      title: e.title,
      deadlineAt: e.deadlineAt,
      isToday: new Date(e.deadlineAt).toDateString() === todayStr,
      isTomorrow: new Date(e.deadlineAt).toDateString() === tomorrowDate.toDateString(),
      hoursLeft,
      color: e.color,
      createdBy: e.user,
    };
  });
}

module.exports = { initSocketHandler, connectedUsers };
