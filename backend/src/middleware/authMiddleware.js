const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * Middleware xác thực JWT access token
 * Attach req.user sau khi verify thành công
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Không có token xác thực',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token đã hết hạn',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Token không hợp lệ',
        code: 'INVALID_TOKEN',
      });
    }

    // Lấy thông tin user từ database để đảm bảo còn hoạt động
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        permissions: {
          select: { module: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
        code: 'USER_INACTIVE',
      });
    }

    // Gắn thông tin user vào request
    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions.map((p) => p.module),
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi xác thực',
      code: 'AUTH_ERROR',
    });
  }
};

module.exports = authMiddleware;
