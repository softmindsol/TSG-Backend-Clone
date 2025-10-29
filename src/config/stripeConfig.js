export const STRIPE_PRICES = {
  individual: {
    monthly: process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY,
    yearly: process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY,
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    yearly: process.env.STRIPE_PRICE_TEAM_YEARLY,
  },
  subAgent: {
    monthly: process.env.STRIPE_PRICE_SUBAGENT_MONTHLY,
    yearly: process.env.STRIPE_PRICE_SUBAGENT_YEARLY,
  },
};
