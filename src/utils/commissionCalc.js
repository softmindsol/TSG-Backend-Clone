// src/utils/commissionCalc.js
export function calcCommission({ engagementType, sourcing, rental, vatRate = 0.2 }) {
  let net = 0;

  if (engagementType === "Sourcing") {
    if (sourcing?.commissionType === "Percentage") {
      const base = Number(sourcing?.offerPrice || 0);
      const rate = Number(sourcing?.ratePct || 0) / 100;
      net = base * rate;
    } else if (sourcing?.commissionType === "Fixed") {
      net = Number(sourcing?.fixedFee || 0);
    }
  } else if (engagementType === "Rental") {
    const rent = Number(rental?.monthlyRent || 0);
    const months = Number(rental?.months || 0);
    net = rent * months;
  }

  net = Math.max(0, Number(net.toFixed(2)));
  const vat = Number((net * vatRate).toFixed(2));
  return { net, vat };
}
