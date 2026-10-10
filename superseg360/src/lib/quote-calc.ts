export interface ItemInput {
  quantity: number;
  unitPriceCents: number;
  discountPercent: number;
}

export interface ItemTotals {
  grossCents: number;
  totalCents: number;
}

export interface QuoteTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

const hundredths = (n: number) => BigInt(Math.round(n * 100));

function divRoundHalfUp(num: bigint, den: bigint): bigint {
  return (num * 2n + den) / (2n * den);
}

/**
 * Replica exatamente a coluna gerada `quote_items.total_cents` do banco
 * (aritmetica inteira, arredondamento "meio para cima"), evitando erros de ponto flutuante.
 */
export function calcItem({ quantity, unitPriceCents, discountPercent }: ItemInput): ItemTotals {
  const q = hundredths(quantity);
  const price = BigInt(Math.round(unitPriceCents));
  const disc = hundredths(discountPercent);
  const gross = divRoundHalfUp(q * price, 100n);
  const net = divRoundHalfUp(q * price * (10000n - disc), 1_000_000n);
  return { grossCents: Number(gross), totalCents: Number(net) };
}

export function calcQuote(items: ItemInput[]): QuoteTotals {
  let subtotal = 0;
  let total = 0;
  for (const item of items) {
    const t = calcItem(item);
    subtotal += t.grossCents;
    total += t.totalCents;
  }
  return { subtotalCents: subtotal, discountCents: subtotal - total, totalCents: total };
}
