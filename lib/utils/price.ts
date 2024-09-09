export function formatPrice(eur: number | null, local: number | null, currency = 'лв'): string {
  if (eur == null) return '—';
  const eurStr = `${eur.toFixed(2)}€`;
  if (local != null) return `${eurStr} / ${local.toFixed(2)}${currency}`;
  return eurStr;
}

export function formatPriceShort(eur: number | null): string {
  if (eur == null) return '—';
  return `${eur.toFixed(2)}€`;
}
