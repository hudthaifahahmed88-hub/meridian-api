const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { stripe, PLAN_PRICE_IDS, PLAN_SEAT_LIMITS } = require("../lib/stripe");

const router = express.Router();

router.post("/checkout", requireAuth, requireRole("admin"), async (req, res) => {
  const { plan } = req.body;
  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: "Unknown plan. Use starter, growth, or enterprise." });

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.CLIENT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/billing/canceled`,
    metadata: { organizationId: org.id, plan },
  });

  res.json({ url: session.url });
});

router.get("/portal", requireAuth, requireRole("admin"), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  if (!org.stripeCustomerId) {
    return res.status(400).json({ error: "This organization has no billing account yet — start a checkout first." });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${process.env.CLIENT_URL}/settings/billing`,
  });
  res.json({ url: session.url });
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const { organizationId, plan } = session.metadata;
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan,
          subscriptionStatus: "active",
          stripeSubscriptionId: session.subscription,
          seatLimit: PLAN_SEAT_LIMITS[plan] || 50,
        },
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: sub.customer } });
      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { subscriptionStatus: sub.status },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: sub.customer } });
      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { subscriptionStatus: "canceled" },
        });
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

module.exports = router;
