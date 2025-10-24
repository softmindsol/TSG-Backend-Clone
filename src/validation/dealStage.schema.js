// src/validation/dealStage.schema.js
import Joi from "joi";

export const updateStageSchema = Joi.object({
  stage: Joi.string()
    .valid("Discovery","Viewings","Offer Mode","Offer Accepted","Exchange","Completion")
    .required(),
  note: Joi.string().max(500).allow("", null),
});
