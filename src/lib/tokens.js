const crypto = require("crypto");
const prisma = require("../db");

function generateToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

async function createAccountToken(userId, purpose, ttlHours = 48) {
  const { raw, hash } = generateToken();
  await prisma.accountToken.create({
    data: { userId, purpose, tokenHash: hash, expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000) },
  });
  return raw;
}

async function consumeAccountToken(rawToken, purpose) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const record = await prisma.accountToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });

  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.accountToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.user;
}

module.exports = { createAccountToken, consumeAccountToken };
