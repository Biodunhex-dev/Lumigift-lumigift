const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USDC_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type CurrencyAmount = number | string;

function toFiniteNumber(amount: CurrencyAmount): number {
  const numericAmount = typeof amount === "number" ? amount : Number(amount.trim());

  if (!Number.isFinite(numericAmount)) {
    throw new TypeError("Currency amount must be a finite number");
  }

  return numericAmount;
}

export function formatNGN(amount: CurrencyAmount): string {
  return NGN_FORMATTER.format(toFiniteNumber(amount));
}

export function formatUSDC(amount: CurrencyAmount): string {
  return `${USDC_FORMATTER.format(toFiniteNumber(amount))} USDC`;
}
