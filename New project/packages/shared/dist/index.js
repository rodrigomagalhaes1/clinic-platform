const _dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
/**
 * Formata uma data/string de data para exibição em pt-BR.
 * Retorna "Sem data" para valores falsy e preserva o valor original
 * caso não seja uma data válida.
 *
 * @example formatDate("2026-06-08T17:00:00Z") // "08/06/2026 14:00"
 * @example formatDate(null) // "Sem data"
 */
export function formatDate(value) {
    if (!value)
        return "Sem data";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : _dateTime.format(date);
}
/**
 * Escapa caracteres especiais HTML para prevenir XSS em templates de string.
 * Converte &, <, >, " e ' para suas entidades HTML equivalentes.
 *
 * @example escapeHtml('<script>alert("xss")</script>') // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * @example escapeHtml(null) // ''
 */
export function escapeHtml(value) {
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
export function parseList(value) {
    if (Array.isArray(value))
        return value.map(String).filter(Boolean);
    if (!value)
        return [];
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}
/**
 * Converte um Date para o formato `YYYY-MM-DDTHH:MM` usado em inputs
 * do tipo `datetime-local`, ajustado para o fuso horário local.
 *
 * @example toLocalDateTime(new Date("2026-06-08T15:00:00Z")) // "2026-06-08T12:00" (UTC-3)
 */
export function toLocalDateTime(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
export function toCurrencyFromCents(amountCents, locale = "pt-BR", currency = "BRL") {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency
    }).format(amountCents / 100);
}
/**
 * Retorna a string se for não-vazia, ou `undefined` caso contrário.
 * Útil para mapear campos opcionais de request bodies onde a ausência
 * do valor deve ser representada como `undefined` (não como string vazia).
 *
 * @example optionalString("hello")     // "hello"
 * @example optionalString("")          // undefined
 * @example optionalString(null)        // undefined
 * @example optionalString(undefined)   // undefined
 * @example optionalString(42)          // undefined (only strings accepted)
 */
export function optionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
/**
 * Gera um ID único com prefixo legível usando crypto.randomUUID().
 * O formato é `<prefix>_<uuid>`, onde o UUID é gerado pelo runtime.
 *
 * @example createId("pat") // "pat_550e8400-e29b-41d4-a716-446655440000"
 * @example createId("apt") // "apt_f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
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
export function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
