const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../../config/database');
const authMiddleware = require('../../middleware/authMiddleware');
const { permissionGuard } = require('../../middleware/permissionGuard');
const { upload, UPLOAD_DIR } = require('../../config/multer');

const router = express.Router();

// Tất cả routes cần auth + quyền NAS
router.use(authMiddleware, permissionGuard('NAS'));

// ============================================================
// GET /api/files — Danh sách file
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      deletedAt: null,
      expiresAt: { gt: new Date() }, // chưa hết hạn
      ...(search && {
        originalName: { contains: search, mode: 'insensitive' },
      }),
    };

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          uploader: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.file.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        files: files.map(mapFile),
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// POST /api/files/upload — Upload file (stream, tối đa 1GB)
// ============================================================
router.post('/upload', (req, res) => {
  // Dùng multer với single file
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File quá lớn. Kích thước tối đa là 1GB',
          code: 'FILE_TOO_LARGE',
        });
      }
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Lỗi khi tải file lên',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Không có file được gửi lên',
      });
    }

    try {
      const FILE_TTL_HOURS = parseInt(process.env.FILE_TTL_HOURS) || 48;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + FILE_TTL_HOURS);

      const file = await prisma.file.create({
        data: {
          uploaderId: req.user.id,
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype || null,
          sizeBytes: BigInt(req.file.size),
          storagePath: req.file.path,
          expiresAt,
        },
        include: {
          uploader: { select: { id: true, displayName: true } },
        },
      });

      return res.status(201).json({
        success: true,
        data: mapFile(file),
        message: `File "${req.file.originalname}" đã tải lên thành công`,
      });
    } catch (dbError) {
      // Xóa file đã upload nếu lưu DB thất bại
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error('DB save error after upload:', dbError);
      res.status(500).json({ success: false, error: 'Lỗi khi lưu thông tin file' });
    }
  });
});

// ============================================================
// GET /api/files/:id/download — Tải file về (stream)
// ============================================================
router.get('/:id/download', async (req, res) => {
  try {
    const file = await prisma.file.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File không tồn tại hoặc đã bị xóa',
      });
    }

    if (file.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'File đã hết hạn (quá 48 giờ)',
        code: 'FILE_EXPIRED',
      });
    }

    const filePath = path.resolve(file.storagePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File không tồn tại trên server',
      });
    }

    // Tăng download count
    await prisma.file.update({
      where: { id: file.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Encode tên file UTF-8 cho header
    const encodedName = encodeURIComponent(file.originalName).replace(/'/g, "%27");

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', file.sizeBytes.toString());
    res.setHeader('X-File-Id', file.id); // Frontend dùng để hiện nút Xóa

    // Stream file để không load vào RAM
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Lỗi đọc file' });
      }
    });
    readStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// ============================================================
// DELETE /api/files/:id — Xóa file
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File không tồn tại hoặc đã bị xóa',
      });
    }

    // Chỉ người upload hoặc Admin mới được xóa
    if (file.uploaderId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa file này',
      });
    }

    // Xóa file vật lý
    const filePath = path.resolve(file.storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Soft delete trong DB
    await prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    return res.json({
      success: true,
      message: `File "${file.originalName}" đã được xóa`,
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// Helper function
function mapFile(f) {
  return {
    id: f.id,
    originalName: f.originalName,
    sizeBytes: f.sizeBytes.toString(),
    mimeType: f.mimeType,
    uploadedBy: f.uploader || null,
    uploadedAt: f.uploadedAt,
    expiresAt: f.expiresAt,
    downloadCount: f.downloadCount,
    isExpired: f.expiresAt < new Date(),
  };
}

module.exports = router;
