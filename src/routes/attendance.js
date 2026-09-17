const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const start = new Date(date.setHours(0, 0, 0, 0));
  const end = new Date(date.setHours(23, 59, 59, 999));

  const records = await prisma.attendance.findMany({
    where: { organizationId: req.user.organizationId, date: { gte: start, lte: end } },
    include: { student: { select: { name: true } } },
  });
  res.json(records);
});

router.post("/", requireRole("admin", "teacher"), async (req, res) => {
  const { studentId, status, date } = req.body;
  if (!studentId || !["present", "absent", "late"].includes(status)) {
    return res.status(400).json({ error: "studentId and a valid status (present|absent|late) are required." });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, organizationId: req.user.organizationId },
  });
  if (!student) return res.status(404).json({ error: "Student not found in your organization." });

  const record = await prisma.attendance.create({
    data: {
      organizationId: req.user.organizationId,
      studentId,
      status,
      date: date ? new Date(date) : new Date(),
    },
  });
  res.status(201).json(record);
});

module.exports = router;
