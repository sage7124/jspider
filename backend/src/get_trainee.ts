import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: 'TRAINEE'
    },
    select: {
      id: true,
      fullName: true,
      baseSalary: true,
      collegeVisitRate: true,
      extraClassRate: true,
      otherCenterClassRate: true,
      tdsRate: true
    }
  });
  console.log("Trainees and their rates:");
  console.table(users);
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
