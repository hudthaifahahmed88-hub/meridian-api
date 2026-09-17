const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { createAccountToken } = require("../lib/tokens");
const { sendEmail } = require("../lib/email");

const router = express.Router();
router.use(requireAuth);

router.get("/", requireRole("admin"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { organizationId: req.user.organizationId },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, createdAt: true },
  });
  res.json(users.map((u) => ({ ...u, passwordHash: undefined, activated: !!u.passwordHash })));
});

router.post("/invite", requireRole("admin"), async (req, res) => {
  const { email, name, role } = req.body;
  if (!email || !name || !["teacher", "student", "parent"].includes(role)) {
    return res.status(400).json({ error: "email, name, and a valid role (teacher|student|parent) are required." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const user = await prisma.user.create({
    data: { email, name, role, organizationId: req.user.organizationId, passwordHash: null },
  });

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const token = await createAccountToken(user.id, "invite", 24 * 7);
  const link = `${process.env.CLIENT_URL}/accept-invite?token=${token}`;

  await sendEmail({
    to: email,
    subject: `You've been invited to ${org.name} on Meridian`,
    html: `<p>You've been invited to join <strong>${org.name}</strong> as a ${role}.</p><p><a href="${link}">Set your password to get started</a></p><p>This link expires in 7 days.</p>`,
  });

  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

module.exports = router;
