export type EarlyRepaymentType = "reduce_term" | "reduce_payment";

export interface MortgageParams {
  propertyPrice: number;
  downPayment: number;
  annualRate: number;
  totalMonthlyBudget: number;
  earlyRepaymentType: EarlyRepaymentType;
  expectedAppreciationPercent: number;
  investmentReturnPercent: number;
}

export interface MonthlySnapshot {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  totalPaid: number;
  totalInterestPaid: number;
}

export interface MortgageResult {
  loanAmount: number;
  monthlyPayment: number;
  schedule: MonthlySnapshot[];
  totalMonths: number;
  totalPaid: number;
  totalInterest: number;
  avgMonthlyOverpayment: number;
  // buying investment
  propertyValueAtEnd: number;
  investmentReturn: number;
  totalInvested: number;
  roi: number;
  roiAnnualized: number;
  // rent vs buy
  rentMonthly: number;
  rentMonthlyInvestment: number;
  rentingEndWealth: number;
  rentingVsBuyingDiff: number;
}

function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
}

export function calculate(params: MortgageParams): MortgageResult {
  const {
    propertyPrice,
    downPayment,
    annualRate,
    totalMonthlyBudget,
    earlyRepaymentType,
    expectedAppreciationPercent,
    investmentReturnPercent,
  } = params;

  const loanAmount = propertyPrice - downPayment;
  const monthlyRate = annualRate / 100 / 12;

  const maxTermMonths = 360;
  let basePayment = annuityPayment(loanAmount, monthlyRate, maxTermMonths);

  const schedule: MonthlySnapshot[] = [];
  let balance = loanAmount;
  let currentPayment = basePayment;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  let month = 0;

  while (balance > 0.01 && month < 600) {
    month++;
    const interestCharge = balance * monthlyRate;
    const regularPrincipal = currentPayment - interestCharge;

    const extra = Math.max(0, totalMonthlyBudget - currentPayment);
    const extraPrincipal = Math.min(extra, balance - regularPrincipal);
    const totalPrincipal = Math.min(regularPrincipal + extraPrincipal, balance);
    const actualPayment = Math.min(totalMonthlyBudget, interestCharge + balance);

    balance -= totalPrincipal;
    totalPaid += actualPayment;
    totalInterestPaid += interestCharge;

    schedule.push({
      month,
      payment: actualPayment,
      principal: totalPrincipal,
      interest: interestCharge,
      balance: Math.max(0, balance),
      totalPaid,
      totalInterestPaid,
    });

    if (balance <= 0.01) break;

    if (earlyRepaymentType === "reduce_payment" && extraPrincipal > 0 && balance > 0) {
      const remainingMonths = maxTermMonths - month;
      if (remainingMonths > 0) {
        currentPayment = annuityPayment(balance, monthlyRate, remainingMonths);
      }
    }
  }

  const totalMonths = schedule.length;
  const totalInterest = totalInterestPaid;
  const avgMonthlyOverpayment = totalInterest / totalMonths;

  // Buying: investment analysis
  const years = totalMonths / 12;
  const propertyValueAtEnd =
    propertyPrice * Math.pow(1 + expectedAppreciationPercent / 100, years);
  const investmentReturn = propertyValueAtEnd - propertyPrice;
  const totalInvested = downPayment + totalPaid;
  const roi = ((propertyValueAtEnd - totalInvested) / totalInvested) * 100;
  const roiAnnualized = (Math.pow(propertyValueAtEnd / totalInvested, 1 / years) - 1) * 100;

  // Renting scenario:
  // - rent = avgMonthlyOverpayment (the "pure cost of money" = interest portion)
  // - down payment is not spent upfront → invested from day 0
  // - each month: save (totalMonthlyBudget - rent) and invest it
  const rentMonthly = avgMonthlyOverpayment;
  const rentMonthlyInvestment = totalMonthlyBudget - rentMonthly;
  const monthlyInvestRate = investmentReturnPercent / 100 / 12;

  const fvDownPayment = downPayment * Math.pow(1 + monthlyInvestRate, totalMonths);
  const fvMonthly =
    monthlyInvestRate > 0
      ? rentMonthlyInvestment *
        (Math.pow(1 + monthlyInvestRate, totalMonths) - 1) /
        monthlyInvestRate
      : rentMonthlyInvestment * totalMonths;

  const rentingEndWealth = fvDownPayment + fvMonthly;
  // positive = buying wins, negative = renting wins
  const rentingVsBuyingDiff = propertyValueAtEnd - rentingEndWealth;

  return {
    loanAmount,
    monthlyPayment: basePayment,
    schedule,
    totalMonths,
    totalPaid,
    totalInterest,
    avgMonthlyOverpayment,
    propertyValueAtEnd,
    investmentReturn,
    totalInvested,
    roi,
    roiAnnualized,
    rentMonthly,
    rentMonthlyInvestment,
    rentingEndWealth,
    rentingVsBuyingDiff,
  };
}

export function formatMoney(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " млн ₽";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.?0+$/, "") + " тыс ₽";
  }
  return value.toFixed(0) + " ₽";
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} лет`);
  if (m > 0) parts.push(`${m} мес`);
  return parts.join(" ");
}
