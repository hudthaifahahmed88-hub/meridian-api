const express = require("express");
const PDFDocument = require("pdfkit");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/:id/report-card", async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!student) return res.status(404).json({ error: "Student not found." });

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const grades = await prisma.grade.findMany({ where: { studentId: student.id }, orderBy: { subject: "asc" } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${student.name.replace(/\s+/g, "-")}-report-card.pdf"`);

  const doc = new PDFDocument({ margin: 56 });
  doc.pipe(res);

  doc.fontSize(18).font("Helvetica-Bold").text(org.name, { align: "left" });
  doc.fontSize(11).font("Helvetica").fillColor("#5B6472").text("Student report card", { align: "left" });
  doc.moveDown(1.2);
  doc.strokeColor("#DDD4BC").moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor("#1F2A3C").fontSize(14).font("Helvetica-Bold").text(student.name);
  doc.fontSize(10.5).font("Helvetica").fillColor("#5B6472")
    .text(`Grade ${student.grade}${student.section}  ·  Guardian: ${student.guardianName}  ·  Status: ${student.status}`);
  doc.moveDown(1.5);

  doc.fontSize(12).font("Helvetica-Bold").fillColor("#1F2A3C").text("Assessment record");
  doc.moveDown(0.5);

  if (grades.length === 0) {
    doc.fontSize(10.5).font("Helvetica").fillColor("#5B6472").text("No grades recorded yet.");
  } else {
    const colX = { subject: doc.page.margins.left, assignment: 200, score: 400 };

    const headerY = doc.y;
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#5B6472");
    doc.text("Subject", colX.subject, headerY);
    doc.text("Assignment", colX.assignment, headerY);
    doc.text("Score", colX.score, headerY);
    doc.moveDown(1);

    let totalPct = 0;
    doc.font("Helvetica").fontSize(10).fillColor("#1F2A3C");
    grades.forEach((g) => {
      const rowY = doc.y;
      const pct = Math.round((g.score / g.maxScore) * 100);
      totalPct += pct;
      doc.text(g.subject, colX.subject, rowY, { width: 180 });
      doc.text(g.assignment, colX.assignment, rowY, { width: 180 });
      doc.text(`${g.score}/${g.maxScore} (${pct}%)`, colX.score, rowY);
      doc.moveDown(0.7);
    });

    doc.moveDown(0.5);
    doc.strokeColor("#DDD4BC").moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1F2A3C").text(`Average: ${Math.round(totalPct / grades.length)}%`);
  }

  doc.moveDown(2);
  doc.fontSize(8.5).font("Helvetica").fillColor("#B08A3E")
    .text(`Generated ${new Date().toLocaleDateString()} · ${org.name}`, { align: "left" });

  doc.end();
});

module.exports = router;
