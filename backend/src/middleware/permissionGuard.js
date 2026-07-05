/**
 * Middleware kiểm tra quyền truy cập module
 * ADMIN bypass tất cả kiểm tra
 * @param {string} moduleName - Tên module: 'CALENDAR' | 'NAS' | 'TASK_MANAGEMENT'
 */
const permissionGuard = (moduleName) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Chưa xác thực',
        code: 'NOT_AUTHENTICATED',
      });
    }

    // ADMIN có quyền truy cập tất cả module
    if (user.role === 'ADMIN') {
      return next();
    }

    // Kiểm tra MEMBER có quyền module này không
    if (!user.permissions.includes(moduleName)) {
      return res.status(403).json({
        success: false,
        error: `Bạn không có quyền truy cập module ${moduleName}`,
        code: 'PERMISSION_DENIED',
        module: moduleName,
      });
    }

    next();
  };
};

/**
 * Middleware chỉ cho phép ADMIN
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Chưa xác thực',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Chức năng này chỉ dành cho Admin',
      code: 'ADMIN_ONLY',
    });
  }

  next();
};

module.exports = { permissionGuard, adminOnly };
