const express = require("express");
const prisma = require("../db");
const { requireAuth, requirePlatformAdmin } = require("../middleware/auth");
const { PLAN_MONTHLY_PRICE } = require("../lib/stripe");

const router = express.Router();
router.use(requireAuth, requirePlatformAdmin);

router.get("/overview", async (req, res) => {
  const orgs = await prisma.organization.findMany();
  const totalStudents = await prisma.student.count();

  const activeOrgs = orgs.filter((o) => o.subscriptionStatus === "active");
  const mrr = activeOrgs.reduce((sum, o) => sum + (PLAN_MONTHLY_PRICE[o.plan] || 0), 0);
  const totalSeats = orgs.reduce((sum, o) => sum + o.seatLimit, 0);

  const seatsUsedByOrg = await prisma.student.groupBy({ by: ["organizationId"], _count: true });
  const usedSeats = seatsUsedByOrg.reduce((sum, row) => sum + row._count, 0);

  res.json({
    mrr,
    activeOrganizations: activeOrgs.length,
    totalOrganizations: orgs.length,
    totalStudents,
    seatUtilizationPct: totalSeats ? Math.round((usedSeats / totalSeats) * 100) : 0,
    revenueByOrg: activeOrgs.map((o) => ({ name: o.name, plan: o.plan, monthly: PLAN_MONTHLY_PRICE[o.plan] || 0 })),
  });
});

router.get("/organizations", async (req, res) => {
  const orgs = await prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await prisma.student.groupBy({ by: ["organizationId"], _count: true });
  const countMap = Object.fromEntries(counts.map((c) => [c.organizationId, c._count]));

  res.json(orgs.map((o) => ({
    id: o.id, name: o.name, city: o.city, plan: o.plan, subscriptionStatus: o.subscriptionStatus,
    seatLimit: o.seatLimit, seatsUsed: countMap[o.id] || 0, createdAt: o.createdAt,
  })));
});

module.exports = router;
