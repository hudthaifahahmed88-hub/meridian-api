const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const students = await prisma.student.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { name: "asc" },
  });
  res.json(students);
});

router.get("/:id", async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!student) return res.status(404).json({ error: "Student not found." });
  res.json(student);
});

router.post("/", requireRole("admin", "teacher"), async (req, res) => {
  const { name, grade, section, guardianName } = req.body;
  if (!name || !grade || !section || !guardianName) {
    return res.status(400).json({ error: "name, grade, section, and guardianName are required." });
  }

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const seatsUsed = await prisma.student.count({ where: { organizationId: req.user.organizationId } });
  if (seatsUsed >= org.seatLimit) {
    return res.status(402).json({ error: `Seat limit reached (${org.seatLimit}). Upgrade your plan to enroll more students.` });
  }

  const student = await prisma.student.create({
    data: { organizationId: req.user.organizationId, name, grade, section, guardianName },
  });
  res.status(201).json(student);
});

router.patch("/:id", requireRole("admin", "teacher"), async (req, res) => {
  const { name, grade, section, guardianName, status, gpa } = req.body;
  const existing = await prisma.student.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!existing) return res.status(404).json({ error: "Student not found." });

  const student = await prisma.student.update({
    where: { id: existing.id },
    data: { name, grade, section, guardianName, status, gpa },
  });
  res.json(student);
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const existing = await prisma.student.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!existing) return res.status(404).json({ error: "Student not found." });

  await prisma.student.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/import", requireRole("admin", "teacher"), async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students must be a non-empty array." });
  }

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const seatsUsed = await prisma.student.count({ where: { organizationId: req.user.organizationId } });

  const results = { created: 0, skipped: [] };
  const rowsToCreate = [];

  students.forEach((row, i) => {
    const { name, grade, section, guardianName } = row;
    if (!name || !grade || !section || !guardianName) {
      results.skipped.push({ row: i + 1, reason: "missing a required field (name, grade, section, guardianName)" });
      return;
    }
    if (seatsUsed + rowsToCreate.length >= org.seatLimit) {
      results.skipped.push({ row: i + 1, reason: `seat limit (${org.seatLimit}) reached` });
      return;
    }
    rowsToCreate.push({ organizationId: req.user.organizationId, name, grade, section, guardianName });
  });

  if (rowsToCreate.length > 0) {
    await prisma.student.createMany({ data: rowsToCreate });
    results.created = rowsToCreate.length;
  }

  res.status(201).json(results);
});

module.exports = router;
