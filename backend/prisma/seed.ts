import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { identifier: 'admin' },
    update: {},
    create: {
      identifier: 'admin',
      fullName: 'System Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isApproved: true,
    },
  });
  console.log('Admin user seeded (Mobile No / Identifier: admin, Password: admin123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
