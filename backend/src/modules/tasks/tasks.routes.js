const express = require('express');
const prisma = require('../../config/database');
const authMiddleware = require('../../middleware/authMiddleware');
const { permissionGuard } = require('../../middleware/permissionGuard');

const router = express.Router();

// Tất cả routes cần auth + quyền TASK_MANAGEMENT
router.use(authMiddleware, permissionGuard('TASK_MANAGEMENT'));

// ============================================================
// GET /api/tasks — Lấy tất cả tasks nhóm theo status
// ============================================================
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });

    // Nhóm theo status
    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      ALMOST_DONE: [],
      DONE: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(mapTask(task));
      }
    });

    return res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// POST /api/tasks — Tạo task mới
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { title, description, repoUrl, assigneeId, status = 'TODO' } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Tên công việc là bắt buộc',
      });
    }

    // Tìm position cuối cùng trong cột
    const lastTask = await prisma.task.findFirst({
      where: { status },
      orderBy: { position: 'desc' },
    });

    const position = lastTask ? lastTask.position + 1 : 0;

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        repoUrl: repoUrl || null,
        assigneeId: assigneeId || null,
        status,
        createdById: req.user.id,
        position,
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: mapTask(task),
      message: 'Tạo công việc thành công',
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// PUT /api/tasks/:id — Cập nhật task
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { title, description, repoUrl, assigneeId, status } = req.body;
    const taskId = req.params.id;

    const existing = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công việc' });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(repoUrl !== undefined && { repoUrl }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(status !== undefined && { status }),
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    return res.json({
      success: true,
      data: mapTask(task),
      message: 'Cập nhật công việc thành công',
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// PATCH /api/tasks/:id/move — Di chuyển task (Drag & Drop)
// ============================================================
router.patch('/:id/move', async (req, res) => {
  try {
    const { newStatus, newPosition, affectedTaskIds = [] } = req.body;
    const taskId = req.params.id;

    const validStatuses = ['TODO', 'IN_PROGRESS', 'ALMOST_DONE', 'DONE'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Trạng thái không hợp lệ',
      });
    }

    // Cập nhật task được kéo
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        position: newPosition,
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    // Reorder các task khác trong cùng cột nếu cần
    if (affectedTaskIds.length > 0) {
      const updates = affectedTaskIds.map((affectedId, index) =>
        prisma.task.update({
          where: { id: affectedId },
          data: { position: index >= newPosition ? index + 1 : index },
        })
      );
      await Promise.all(updates);
    }

    return res.json({
      success: true,
      data: mapTask(updatedTask),
      message: 'Đã di chuyển công việc',
    });
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// DELETE /api/tasks/:id — Xóa task
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công việc' });
    }

    await prisma.task.delete({ where: { id: taskId } });

    return res.json({
      success: true,
      message: 'Đã xóa công việc thành công',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// Helper function
function mapTask(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    repoUrl: t.repoUrl,
    position: t.position,
    assignee: t.assignee,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

module.exports = router;
