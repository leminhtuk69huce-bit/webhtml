const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed database...');

  // Tạo Admin mặc định
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@student-workspace.local',
      passwordHash: adminPassword,
      displayName: 'Quản trị viên',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin đã tạo:', admin.username);

  // Tạo 2 Member mẫu
  const memberPassword = await bcrypt.hash('Member@123', 12);

  const member1 = await prisma.user.upsert({
    where: { username: 'nguyen_van_a' },
    update: {},
    create: {
      username: 'nguyen_van_a',
      email: 'vana@student.edu.vn',
      passwordHash: memberPassword,
      displayName: 'Nguyễn Văn A',
      role: 'MEMBER',
      isActive: true,
    },
  });

  // Cấp quyền cho member1
  await prisma.userPermission.createMany({
    data: [
      { userId: member1.id, module: 'CALENDAR', grantedBy: admin.id },
      { userId: member1.id, module: 'NAS', grantedBy: admin.id },
      { userId: member1.id, module: 'TASK_MANAGEMENT', grantedBy: admin.id },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Member1 đã tạo:', member1.username);

  const member2 = await prisma.user.upsert({
    where: { username: 'tran_thi_b' },
    update: {},
    create: {
      username: 'tran_thi_b',
      email: 'thib@student.edu.vn',
      passwordHash: memberPassword,
      displayName: 'Trần Thị B',
      role: 'MEMBER',
      isActive: true,
    },
  });

  // Cấp quyền cho member2 (chỉ Calendar và Task)
  await prisma.userPermission.createMany({
    data: [
      { userId: member2.id, module: 'CALENDAR', grantedBy: admin.id },
      { userId: member2.id, module: 'TASK_MANAGEMENT', grantedBy: admin.id },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Member2 đã tạo:', member2.username);

  // Tạo một vài Event mẫu
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  await prisma.event.createMany({
    data: [
      {
        userId: member1.id,
        title: 'Nộp báo cáo cuối kỳ',
        description: 'Nộp qua email giảng viên Nguyễn Minh',
        eventDate: tomorrow,
        deadlineAt: new Date(tomorrow.setHours(23, 59, 0, 0)),
        color: '#ef4444',
      },
      {
        userId: admin.id,
        title: 'Họp nhóm tuần này',
        description: 'Tại phòng F201, thảo luận tiến độ dự án',
        eventDate: today,
        deadlineAt: new Date(today.setHours(18, 0, 0, 0)),
        color: '#6366f1',
      },
    ],
  });
  console.log('✅ Events mẫu đã tạo');

  // Tạo Tasks mẫu
  await prisma.task.createMany({
    data: [
      {
        title: 'Thiết kế UI màn hình Login',
        description: 'Dùng Figma, theo glassmorphism design system',
        status: 'DONE',
        repoUrl: 'https://github.com/group/student-workspace',
        assigneeId: member1.id,
        createdById: admin.id,
        position: 0,
      },
      {
        title: 'Viết API Authentication',
        description: 'JWT access + refresh token, bcrypt password',
        status: 'DONE',
        repoUrl: 'https://github.com/group/student-workspace/issues/1',
        assigneeId: member1.id,
        createdById: admin.id,
        position: 0,
      },
      {
        title: 'Xây dựng Kanban Board UI',
        description: 'Drag & Drop giữa các cột, React DnD Kit',
        status: 'IN_PROGRESS',
        repoUrl: 'https://github.com/group/student-workspace/issues/5',
        assigneeId: member2.id,
        createdById: admin.id,
        position: 0,
      },
      {
        title: 'Tích hợp WebSocket cho reminders',
        description: 'Socket.io push thông báo deadline',
        status: 'ALMOST_DONE',
        repoUrl: 'https://github.com/group/student-workspace/issues/8',
        assigneeId: member1.id,
        createdById: admin.id,
        position: 0,
      },
      {
        title: 'Viết tài liệu API',
        description: 'Swagger/OpenAPI documentation',
        status: 'TODO',
        repoUrl: null,
        assigneeId: member2.id,
        createdById: admin.id,
        position: 0,
      },
    ],
  });
  console.log('✅ Tasks mẫu đã tạo');

  console.log('\n🎉 Seed hoàn tất!');
  console.log('📋 Tài khoản mặc định:');
  console.log('   Admin: admin / Admin@123');
  console.log('   Member1: nguyen_van_a / Member@123');
  console.log('   Member2: tran_thi_b / Member@123');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
