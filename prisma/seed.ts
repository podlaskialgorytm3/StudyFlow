import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findFirst({
    where: {
      username: {
        equals: adminUsername,
        mode: 'insensitive',
      },
    },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        role: Role.ADMIN,
        settings: {
          create: {
            importantStoryPointsThreshold: 6,
            urgentWithinDays: 3,
          },
        },
      },
    });
    console.log(`Seed: Admin '${adminUsername}' created.`);
  } else {
    console.log(`Seed: Admin '${adminUsername}' already exists.`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
