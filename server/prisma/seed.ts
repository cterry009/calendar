import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

config({ path: resolve(__dirname, '../.env.dev-user') });

const prisma = new PrismaClient();

const DEV_EMAIL = process.env.SEED_DEV_EMAIL ?? 'dev@local.test';
const DEV_PASSWORD = process.env.SEED_DEV_PASSWORD ?? 'devpassword123';
const DEV_NAME = process.env.SEED_DEV_NAME ?? 'Dev User';

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: { passwordHash, name: DEV_NAME },
    create: { email: DEV_EMAIL, passwordHash, name: DEV_NAME },
  });

  console.log('Dev user ready:');
  console.log(`  email:    ${user.email}`);
  console.log(`  password: ${DEV_PASSWORD}`);
  console.log(`  id:       ${user.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
