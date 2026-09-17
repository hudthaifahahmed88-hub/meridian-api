const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const PLAN_SEAT_LIMITS = {
  starter: 50,
  growth: 150,
  enterprise: 100000,
};

const PLAN_MONTHLY_PRICE = { starter: 199, growth: 499, enterprise: 1499 };

module.exports = { stripe, PLAN_PRICE_IDS, PLAN_SEAT_LIMITS, PLAN_MONTHLY_PRICE };
