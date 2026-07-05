const express = require('express');
const prisma = require('../../config/database');
const authMiddleware = require('../../middleware/authMiddleware');
const { permissionGuard } = require('../../middleware/permissionGuard');

const router = express.Router();

// Tất cả routes cần auth + quyền CALENDAR
router.use(authMiddleware, permissionGuard('CALENDAR'));

// ============================================================
// GET /api/events?month=7&year=2026 — Lấy events theo tháng
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = parseInt(month) || now.getMonth() + 1;
    const y = parseInt(year) || now.getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const events = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { eventDate: 'asc' },
    });

    return res.json({
      success: true,
      data: {
        events: events.map(mapEvent),
        month: m,
        year: y,
      },
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// GET /api/events/reminders — Events sắp đến hạn (hôm nay + ngày mai)
// ============================================================
router.get('/reminders', async (req, res) => {
  try {
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

    const reminders = events.map((e) => {
      const hoursLeft = Math.ceil((new Date(e.deadlineAt) - now) / (1000 * 60 * 60));
      const isToday = new Date(e.deadlineAt).toDateString() === now.toDateString();
      const tomorrowDate = new Date(now);
      tomorrowDate.setDate(now.getDate() + 1);
      const isTomorrow = new Date(e.deadlineAt).toDateString() === tomorrowDate.toDateString();

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        deadlineAt: e.deadlineAt,
        isToday,
        isTomorrow,
        hoursLeft,
        color: e.color,
        createdBy: e.user,
      };
    });

    return res.json({ success: true, data: { reminders } });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// POST /api/events — Tạo event mới
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { title, description, eventDate, deadlineAt, color } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({
        success: false,
        error: 'Tiêu đề và ngày là bắt buộc',
      });
    }

    const event = await prisma.event.create({
      data: {
        userId: req.user.id,
        title,
        description: description || null,
        eventDate: new Date(eventDate),
        deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
        color: color || '#6366f1',
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: mapEvent(event),
      message: 'Tạo sự kiện thành công',
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// PUT /api/events/:id — Cập nhật event
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { title, description, eventDate, deadlineAt, color } = req.body;
    const eventId = req.params.id;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sự kiện' });
    }

    // Chỉ người tạo hoặc Admin được sửa
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền sửa sự kiện này',
      });
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(deadlineAt !== undefined && { deadlineAt: deadlineAt ? new Date(deadlineAt) : null }),
        ...(color !== undefined && { color }),
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return res.json({
      success: true,
      data: mapEvent(event),
      message: 'Cập nhật sự kiện thành công',
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// DELETE /api/events/:id — Xóa event
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sự kiện' });
    }

    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa sự kiện này',
      });
    }

    await prisma.event.delete({ where: { id: eventId } });

    return res.json({ success: true, message: 'Xóa sự kiện thành công' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// Helper function
function mapEvent(e) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    eventDate: e.eventDate,
    deadlineAt: e.deadlineAt,
    color: e.color,
    createdBy: e.user,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

module.exports = router;
