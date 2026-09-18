const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const staff = await prisma.staff.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { name: "asc" },
  });
  res.json(staff);
});

router.post("/", requireRole("admin"), async (req, res) => {
  const { name, subject } = req.body;
  if (!name || !subject) return res.status(400).json({ error: "name and subject are required." });

  const staffMember = await prisma.staff.create({
    data: { organizationId: req.user.organizationId, name, subject },
  });
  res.status(201).json(staffMember);
});

module.exports = router;
