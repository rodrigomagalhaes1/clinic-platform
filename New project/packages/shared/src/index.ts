export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function toCurrencyFromCents(amountCents: number, locale = "pt-BR", currency = "BRL") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

