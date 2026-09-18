const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  if (!org) return res.status(404).json({ error: "Organization not found." });

  const seatsUsed = await prisma.student.count({ where: { organizationId: org.id } });

  res.json({
    id: org.id, name: org.name, plan: org.plan,
    subscriptionStatus: org.subscriptionStatus, seatLimit: org.seatLimit, seatsUsed,
  });
});

module.exports = router;
