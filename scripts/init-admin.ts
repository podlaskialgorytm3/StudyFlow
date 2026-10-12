import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Error: Please provide ADMIN_USERNAME and ADMIN_PASSWORD in environment variables.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const existing = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`Administrator account '${updated.username}' updated successfully.`);
  } else {
    const created = await prisma.user.create({
      data: {
        username,
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
    console.log(`Administrator account '${created.username}' created successfully.`);
  }
}

main()
  .catch((e) => {
    console.error('Error initializing admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

