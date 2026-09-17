const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const fees = await prisma.fee.findMany({
    where: { organizationId: req.user.organizationId },
    include: { student: { select: { name: true } } },
  });
  res.json(fees);
});

router.post("/:id/payment", requireRole("admin"), async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "A positive amount is required." });

  const fee = await prisma.fee.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!fee) return res.status(404).json({ error: "Fee record not found." });

  const amountPaid = fee.amountPaid + amount;
  const status = amountPaid >= fee.amountDue ? "paid" : amountPaid > 0 ? "partial" : "unpaid";

  const updated = await prisma.fee.update({
    where: { id: fee.id },
    data: { amountPaid, status },
  });
  res.json(updated);
});

module.exports = router;
