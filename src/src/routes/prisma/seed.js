require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || "Platform Owner";

  if (!email || !password) {
    console.error("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD before running this.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("PLATFORM_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Platform admin ready: ${admin.email}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
