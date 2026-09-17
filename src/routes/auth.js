const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const { createAccountToken, consumeAccountToken } = require("../lib/tokens");
const { sendEmail } = require("../lib/email");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, organizationId: user.organizationId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

router.post("/signup", async (req, res) => {
  const { schoolName, adminName, email, password } = req.body;

  if (!schoolName || !adminName || !email || !password) {
    return res.status(400).json({ error: "schoolName, adminName, email, and password are all required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(schoolName);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: schoolName, slug, plan: "starter", subscriptionStatus: "trialing", seatLimit: 50 },
    });
    const user = await tx.user.create({
      data: { name: adminName, email, passwordHash, role: "admin", organizationId: org.id },
    });
    return { org, user };
  });

  const token = signToken(result.user);
  res.status(201).json({
    token,
    user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    organization: { id: result.org.id, name: result.org.name, slug: result.org.slug, plan: result.org.plan },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (!user.passwordHash) {
    return res.status(401).json({ error: "This account hasn't been activated yet. Check your invite email to set a password." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    organization: {
      id: user.organization.id, name: user.organization.name, plan: user.organization.plan,
      subscriptionStatus: user.organization.subscriptionStatus,
    },
  });
});

router.post("/platform-login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required." });

  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin) return res.status(401).json({ error: "Invalid email or password." });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password." });

  const token = jwt.sign({ sub: admin.id, isPlatformAdmin: true }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email }, isPlatformAdmin: true });
});

router.post("/accept-invite", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "token and password are required." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const user = await consumeAccountToken(token, "invite");
  if (!user) return res.status(400).json({ error: "This invite link is invalid or has expired." });

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  const jwtToken = signToken(updated);
  res.json({ token: jwtToken, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createAccountToken(user.id, "reset", 2);
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your Meridian password",
      html: `<p>Click below to reset your password. This link expires in 2 hours.</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });
  }

  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "token and password are required." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const user = await consumeAccountToken(token, "reset");
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: "Password updated. You can sign in now." });
});

module.exports = router;
