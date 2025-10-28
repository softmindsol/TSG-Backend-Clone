// src/utils/commission.js
export const VAT_RATE = Number(process.env.VAT_RATE ?? 0.20); // 20%

export function computeCommissionFrom({ commissionType, ratePct, fixedFee }, offerAmount) {
  const to2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  let net = 0;
  if (commissionType === "Percentage") {
    net = Number(offerAmount || 0) * (Number(ratePct || 0) / 100);
  } else if (commissionType === "Fixed") {
    net = Number(fixedFee || 0);
  }
  net = Math.max(0, to2(net));
  const vat = to2(net * VAT_RATE);

  return { net, vat };
}
