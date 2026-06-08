export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function toCurrencyFromCents(amountCents: number, locale = "pt-BR", currency = "BRL") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

/**
 * Normaliza uma string para comparações case-insensitive sem acento.
 * Remove diacríticos (NFD) e converte para minúsculas.
 *
 * Usado em: busca de agenda, filtros financeiros, matching de planos,
 * pesquisa de RH, detecção de tipo de exame, validação de guias.
 *
 * @example normalize("Clínica São Paulo") // "clinica sao paulo"
 */
export function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

