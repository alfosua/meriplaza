// Venezuelan identifiers (V/E cédulas, J/G RIF with modulo-11 check digit).
// Mirrors the Go libs/ident.

export type Prefix = "V" | "E" | "J" | "G" | "P" | "C";

const VALID: Record<string, boolean> = { V: true, E: true, J: true, G: true, P: true, C: true };

export interface ID {
  prefix: Prefix;
  number: string;
  checkDigit: string; // "" when the prefix has none
}

// Only J (juridical) and G (government) RIFs carry the check digit.
function hasCheckDigit(p: Prefix): boolean { return p === "J" || p === "G"; }

export function parse(input: string): ID {
  const cleaned = (input ?? "").trim().toUpperCase().replace(/[-.\s]/g, "");
  if (cleaned === "") throw new Error("ident: empty identifier");
  const prefix = cleaned[0] as Prefix;
  if (!VALID[prefix]) throw new Error(`ident: unknown prefix ${JSON.stringify(cleaned[0])}`);
  const body = cleaned.slice(1);
  if (body === "") throw new Error("ident: missing number");

  if (prefix === "P" || prefix === "C") return { prefix, number: body, checkDigit: "" };
  if (!/^[0-9]+$/.test(body)) throw new Error(`ident: non-numeric body ${JSON.stringify(body)}`);
  if (!hasCheckDigit(prefix)) return { prefix, number: body, checkDigit: "" };

  let num = body;
  let supplied = "";
  if (body.length === 9) { num = body.slice(0, 8); supplied = body.slice(8); }
  if (num.length < 5 || num.length > 9) throw new Error(`ident: number length out of range: ${num}`);

  const want = checkDigit(prefix, num);
  if (supplied !== "" && supplied !== want) {
    throw new Error(`ident: invalid check digit for ${prefix}${num}: got ${supplied} want ${want}`);
  }
  return { prefix, number: num, checkDigit: want };
}

export function format(id: ID): string {
  return id.checkDigit === "" ? `${id.prefix}-${id.number}` : `${id.prefix}-${id.number}-${id.checkDigit}`;
}

function checkDigit(prefix: Prefix, number: string): string {
  const seed: Record<string, number> = { V: 1, E: 2, J: 3, G: 4 };
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const n = number.padStart(8, "0");
  let sum = (seed[prefix] ?? 0) * 4;
  for (let i = 0; i < 8; i++) sum += (n.charCodeAt(i) - 48) * weights[i];
  let d = 11 - (sum % 11);
  if (d === 11 || d === 10) d = 0;
  return String(d);
}
