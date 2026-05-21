/**
 * Branded money types. The engine works in integer pence; routes and the
 * database speak whole pounds. Branding makes a missed conversion a type
 * error rather than a silent 100×-wrong projection — see the review of the
 * goals/trajectory pipeline.
 */

export type Pence = number & { readonly __brand: "Pence" };
export type Pounds = number & { readonly __brand: "Pounds" };

export function pence(n: number): Pence {
  return Math.round(n) as Pence;
}

export function pounds(n: number): Pounds {
  return n as Pounds;
}

export function poundsToPence(p: Pounds): Pence {
  return Math.round((p as number) * 100) as Pence;
}

export function penceToPounds(p: Pence): Pounds {
  return ((p as number) / 100) as Pounds;
}

/** For whole-pound display values; rounds half-away-from-zero. */
export function penceToWholePounds(p: Pence): number {
  return Math.round((p as number) / 100);
}

export function addPence(a: Pence, b: Pence): Pence {
  return ((a as number) + (b as number)) as Pence;
}

export function subPence(a: Pence, b: Pence): Pence {
  return ((a as number) - (b as number)) as Pence;
}

/** Escape hatch — only at trusted boundaries (DB row → domain). */
export function unsafePence(n: number): Pence {
  return n as Pence;
}
