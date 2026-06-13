// Decimal-safe money for the SalesFactory edge backend.
//
// Mirrors the Go libs/money: amounts are stored as an integer number of minor
// units (BigInt) at SCALE decimal places, never as JS number/float. Wire format
// is a decimal string ("600.66") + ISO-4217 currency code.

export const SCALE = 6;

const POW: bigint[] = Array.from({ length: SCALE + 1 }, (_, i) => 10n ** BigInt(i));

export class Money {
  readonly units: bigint;
  readonly currency: string;

  private constructor(units: bigint, currency: string) {
    this.units = units;
    this.currency = currency;
  }

  static zero(currency: string): Money {
    return new Money(0n, normCurrency(currency));
  }

  /** Parse a decimal string such as "600.66" into Money. Throws on invalid. */
  static parse(amount: string, currency: string): Money {
    const cur = normCurrency(currency);
    if (cur.length !== 3) throw new Error(`money: invalid currency ${JSON.stringify(currency)}`);
    let s = (amount ?? "").trim();
    if (s === "") throw new Error("money: empty amount");

    let neg = false;
    if (s[0] === "-") { neg = true; s = s.slice(1); }
    else if (s[0] === "+") s = s.slice(1);

    const dot = s.indexOf(".");
    let intPart = dot === -1 ? s : s.slice(0, dot);
    let fracPart = dot === -1 ? "" : s.slice(dot + 1);
    if (intPart === "" && fracPart === "") throw new Error(`money: invalid amount ${JSON.stringify(amount)}`);
    if (intPart === "") intPart = "0";
    if (!isDigits(intPart) || (fracPart !== "" && !isDigits(fracPart))) {
      throw new Error(`money: invalid amount ${JSON.stringify(amount)}`);
    }
    if (fracPart.length > SCALE) throw new Error(`money: amount ${JSON.stringify(amount)} exceeds ${SCALE} decimals`);

    const fracPadded = fracPart.padEnd(SCALE, "0");
    let units = BigInt(intPart + fracPadded);
    if (neg) units = -units;
    return new Money(units, cur);
  }

  isZero(): boolean { return this.units === 0n; }
  sign(): number { return this.units > 0n ? 1 : this.units < 0n ? -1 : 0; }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.units + other.units, this.currency);
  }
  sub(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.units - other.units, this.currency);
  }
  equals(other: Money): boolean {
    return this.currency === other.currency && this.units === other.units;
  }

  /** Format with `places` fractional digits, rounded half-up. */
  format(places = 2): string {
    if (places < 0) places = 0;
    if (places > SCALE) places = SCALE;
    const neg = this.units < 0n;
    let abs = this.units < 0n ? -this.units : this.units;

    if (places < SCALE) {
      const div = POW[SCALE - places];
      const half = div / 2n;
      const q = abs / div;
      const r = abs % div;
      abs = r >= half ? q + 1n : q;
    }
    let digits = abs.toString();
    if (places === 0) return (neg && abs !== 0n ? "-" : "") + digits;
    while (digits.length <= places) digits = "0" + digits;
    const intPart = digits.slice(0, digits.length - places);
    const fracPart = digits.slice(digits.length - places);
    return (neg && abs !== 0n ? "-" : "") + intPart + "." + fracPart;
  }

  toString(): string { return this.format(2); }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`money: currency mismatch ${this.currency} vs ${other.currency}`);
    }
  }
}

/** Multiply money by a decimal quantity string, rounding half-up to `decimals`. */
export function mulDecimal(m: Money, qty: string, decimals = 2): Money {
  return scaleRoundedToMoney(ratMul(m.units, parseRat(qty)), m.currency, decimals);
}

/** Compute m * (ratePercent/100), rounding half-up to `decimals`. */
export function percentOf(m: Money, ratePercent: string, decimals = 2): Money {
  const rate = parseRat(ratePercent);
  // (units * rateNum) / (rateDen * 100)
  return scaleRoundedToMoney(
    { num: m.units * rate.num, den: rate.den * 100n },
    m.currency,
    decimals,
  );
}

/** Divide money by a positive rate string (e.g. Bs -> USD at BCV), half-up. */
export function divByRate(m: Money, rate: string, targetCurrency: string, decimals = 2): Money {
  const r = parseRat(rate);
  if (r.num <= 0n) throw new Error(`money: invalid rate ${JSON.stringify(rate)}`);
  // m.units is at SCALE; result currency string built from rounded value.
  return scaleRoundedToMoney({ num: m.units * r.den, den: r.num }, normCurrency(targetCurrency), decimals);
}

// --- internal rational helpers (num/den of bigints) ---

type Rat = { num: bigint; den: bigint };

function parseRat(s: string): Rat {
  s = (s ?? "").trim();
  let neg = false;
  if (s[0] === "-") { neg = true; s = s.slice(1); }
  const dot = s.indexOf(".");
  if (dot === -1) {
    if (!isDigits(s || "0")) throw new Error(`invalid decimal ${JSON.stringify(s)}`);
    const n = BigInt(s || "0");
    return { num: neg ? -n : n, den: 1n };
  }
  const intPart = s.slice(0, dot) || "0";
  const fracPart = s.slice(dot + 1);
  if (!isDigits(intPart) || !isDigits(fracPart || "0")) throw new Error(`invalid decimal ${JSON.stringify(s)}`);
  const den = 10n ** BigInt(fracPart.length);
  const num = BigInt(intPart) * den + BigInt(fracPart || "0");
  return { num: neg ? -num : num, den };
}

// ratMul multiplies a money-units integer (at SCALE) by a rational, returning a
// rational still scaled at SCALE.
function ratMul(unitsAtScale: bigint, r: Rat): Rat {
  return { num: unitsAtScale * r.num, den: r.den };
}

// scaleRoundedToMoney takes a rational that represents a value already scaled by
// 10^SCALE (i.e. value*10^SCALE = num/den), rounds it to `decimals` places
// half-up, and returns Money.
function scaleRoundedToMoney(r: Rat, currency: string, decimals: number): Money {
  // value = (num/den) / 10^SCALE. We want round(value * 10^decimals).
  // = round( num / (den * 10^(SCALE-decimals)) )   [decimals <= SCALE]
  const shift = POW[SCALE - decimals];
  const denom = r.den * shift;
  const neg = (r.num < 0n) !== (denom < 0n);
  const absNum = r.num < 0n ? -r.num : r.num;
  const absDen = denom < 0n ? -denom : denom;
  let q = absNum / absDen;
  const rem = absNum % absDen;
  if (rem * 2n >= absDen) q += 1n;
  // q is the amount in 10^-decimals units; build a decimal string then parse.
  const dec = scaledIntToDecimal(neg ? -q : q, decimals);
  return Money.parse(dec, currency);
}

function scaledIntToDecimal(q: bigint, decimals: number): string {
  const neg = q < 0n;
  let digits = (q < 0n ? -q : q).toString();
  if (decimals === 0) return (neg ? "-" : "") + digits;
  while (digits.length <= decimals) digits = "0" + digits;
  const intPart = digits.slice(0, digits.length - decimals);
  const fracPart = digits.slice(digits.length - decimals);
  return (neg ? "-" : "") + intPart + "." + fracPart;
}

function normCurrency(c: string): string { return (c ?? "").trim().toUpperCase(); }
function isDigits(s: string): boolean { return s.length > 0 && /^[0-9]+$/.test(s); }
