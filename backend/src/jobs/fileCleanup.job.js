const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');

/**
 * Cronjob xóa file hết hạn (TTL: 48 giờ)
 * Chạy mỗi giờ theo cron expression trong .env
 */
const startFileCleanupJob = (io = null) => {
  const cronExpression = process.env.CLEANUP_CRON || '0 * * * *';

  console.log(`⏰ File cleanup job đã đăng ký: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    console.log(`\n🧹 [${new Date().toISOString()}] Bắt đầu dọn dẹp file hết hạn...`);

    try {
      // Tìm tất cả file đã hết hạn và chưa bị xóa
      const expiredFiles = await prisma.file.findMany({
        where: {
          deletedAt: null,
          expiresAt: { lt: new Date() },
        },
        include: {
          uploader: { select: { id: true, displayName: true } },
        },
      });

      if (expiredFiles.length === 0) {
        console.log('✅ Không có file hết hạn cần xóa');
        return;
      }

      console.log(`📋 Tìm thấy ${expiredFiles.length} file hết hạn`);

      let deletedCount = 0;
      let errorCount = 0;
      const deletedFileNames = [];

      for (const file of expiredFiles) {
        try {
          // Xóa file vật lý
          const filePath = path.resolve(file.storagePath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`  🗑️  Đã xóa file: ${file.originalName}`);
          } else {
            console.log(`  ⚠️  File không tồn tại trên disk: ${file.originalName}`);
          }

          // Đánh dấu đã xóa trong DB
          await prisma.file.update({
            where: { id: file.id },
            data: { deletedAt: new Date() },
          });

          deletedCount++;
          deletedFileNames.push({
            id: file.id,
            fileName: file.originalName,
            uploadedBy: file.uploader?.displayName || 'Unknown',
          });
        } catch (fileError) {
          console.error(`  ❌ Lỗi xóa file ${file.originalName}:`, fileError.message);
          errorCount++;
        }
      }

      console.log(`✅ Dọn dẹp xong: ${deletedCount} file đã xóa, ${errorCount} lỗi\n`);

      // Thông báo qua WebSocket nếu có io
      if (io && deletedFileNames.length > 0) {
        io.emit('file:expired', {
          deletedFiles: deletedFileNames,
          deletedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('❌ Lỗi trong cleanup job:', error);
    }
  });
};

module.exports = { startFileCleanupJob };
