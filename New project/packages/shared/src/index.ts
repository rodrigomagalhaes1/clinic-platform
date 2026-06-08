const _dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Formata uma data/string de data para exibição em pt-BR.
 * Retorna "Sem data" para valores falsy e preserva o valor original
 * caso não seja uma data válida.
 *
 * @example formatDate("2026-06-08T17:00:00Z") // "08/06/2026 14:00"
 * @example formatDate(null) // "Sem data"
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Sem data";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : _dateTime.format(date);
}

/**
 * Escapa caracteres especiais HTML para prevenir XSS em templates de string.
 * Converte &, <, >, " e ' para suas entidades HTML equivalentes.
 *
 * @example escapeHtml('<script>alert("xss")</script>') // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * @example escapeHtml(null) // ''
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Converte um valor para array de strings não-vazias.
 * Aceita arrays (retorna cópia filtrada) ou strings separadas por vírgula.
 * Retorna [] para null, undefined ou string vazia.
 *
 * @example parseList("admin,manager, billing") // ["admin", "manager", "billing"]
 * @example parseList(["a", "", "b"])            // ["a", "b"]
 * @example parseList(null)                      // []
 */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

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

