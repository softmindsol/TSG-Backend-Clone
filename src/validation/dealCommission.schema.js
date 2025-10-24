// src/validation/dealCommission.schema.js
import Joi from "joi";

const sourcingPercent = Joi.object({
  commissionType: Joi.string().valid("Percentage").required(),
  offerPrice: Joi.number().min(0).required(),
  ratePct: Joi.number().min(0).required(), // e.g. 2 = 2%
  fixedFee: Joi.forbidden(),
});

const sourcingFixed = Joi.object({
  commissionType: Joi.string().valid("Fixed").required(),
  fixedFee: Joi.number().min(0).required(),
  offerPrice: Joi.forbidden(),
  ratePct: Joi.forbidden(),
});

const sourcing = Joi.alternatives().try(sourcingPercent, sourcingFixed);

const rental = Joi.object({
  monthlyRent: Joi.number().min(0).required(),
  months: Joi.number().integer().min(0).required(),
});

export const upsertCommissionSchema = Joi.object({
  engagementType: Joi.string().valid("Sourcing", "Rental").required(),
  sourcing: Joi.when("engagementType", {
    is: "Sourcing",
    then: sourcing.required(),
    otherwise: Joi.forbidden(),
  }),
  rental: Joi.when("engagementType", {
    is: "Rental",
    then: rental.required(),
    otherwise: Joi.forbidden(),
  }),
  currency: Joi.string().default("GBP"),
});
