const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../config/database');
const authMiddleware = require('../../middleware/authMiddleware');
const { adminOnly } = require('../../middleware/permissionGuard');

const router = express.Router();

// Áp dụng auth + admin check cho tất cả routes trong file này
router.use(authMiddleware, adminOnly);

// ============================================================
// GET /api/users — Danh sách tất cả users
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          permissions: { select: { module: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          avatarUrl: u.avatarUrl,
          permissions: u.permissions.map((p) => p.module),
          createdAt: u.createdAt,
        })),
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// POST /api/users — Tạo user mới
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { username, email, displayName, password, permissions = [] } = req.body;

    if (!username || !email || !displayName || !password) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc (username, email, displayName, password)',
      });
    }

    // Kiểm tra trùng username/email
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: existing.username === username
          ? 'Username đã tồn tại'
          : 'Email đã tồn tại',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        displayName,
        passwordHash,
        role: 'MEMBER',
        permissions: {
          create: permissions.map((module) => ({
            module,
            grantedBy: req.user.id,
          })),
        },
      },
      include: { permissions: { select: { module: true } } },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        permissions: user.permissions.map((p) => p.module),
      },
      message: 'Tạo tài khoản thành công',
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// GET /api/users/:id — Chi tiết user
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { permissions: { select: { module: true } } },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        permissions: user.permissions.map((p) => p.module),
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// PATCH /api/users/:id — Cập nhật user
// ============================================================
router.patch('/:id', async (req, res) => {
  try {
    const { displayName, email, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res.json({
      success: true,
      data: { id: user.id, displayName: user.displayName, isActive: user.isActive },
      message: 'Cập nhật thành công',
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// PATCH /api/users/:id/permissions — Cập nhật quyền module
// ============================================================
router.patch('/:id/permissions', async (req, res) => {
  try {
    const { permissions } = req.body;
    const userId = req.params.id;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'permissions phải là mảng',
      });
    }

    // Xóa tất cả quyền cũ, tạo lại
    await prisma.userPermission.deleteMany({ where: { userId } });

    if (permissions.length > 0) {
      await prisma.userPermission.createMany({
        data: permissions.map((module) => ({
          userId,
          module,
          grantedBy: req.user.id,
        })),
      });
    }

    return res.json({
      success: true,
      data: { userId, permissions },
      message: 'Cập nhật quyền thành công',
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// POST /api/users/:id/reset-password — Reset mật khẩu
// ============================================================
router.post('/:id/reset-password', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    }

    if (user.role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        error: 'Không thể reset mật khẩu Admin',
      });
    }

    // Tạo mật khẩu tạm thời ngẫu nhiên: 10 ký tự
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    const tempPassword = Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Thu hồi tất cả refresh tokens của user này
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    return res.json({
      success: true,
      data: {
        temporaryPassword: tempPassword,
        userId,
        displayName: user.displayName,
      },
      message: `Mật khẩu của ${user.displayName} đã được đặt lại`,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// DELETE /api/users/:id — Xóa user (soft delete)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Không thể tự xóa tài khoản của mình',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return res.json({
      success: true,
      message: `Tài khoản ${user.displayName} đã bị vô hiệu hóa`,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
