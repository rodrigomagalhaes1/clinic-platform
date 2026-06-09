/**
 * Formata uma data/string de data para exibição em pt-BR.
 * Retorna "Sem data" para valores falsy e preserva o valor original
 * caso não seja uma data válida.
 *
 * @example formatDate("2026-06-08T17:00:00Z") // "08/06/2026 14:00"
 * @example formatDate(null) // "Sem data"
 */
export declare function formatDate(value: string | Date | null | undefined): string;
/**
 * Escapa caracteres especiais HTML para prevenir XSS em templates de string.
 * Converte &, <, >, " e ' para suas entidades HTML equivalentes.
 *
 * @example escapeHtml('<script>alert("xss")</script>') // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * @example escapeHtml(null) // ''
 */
export declare function escapeHtml(value: unknown): string;
/**
 * Converte um valor para array de strings não-vazias.
 * Aceita arrays (retorna cópia filtrada) ou strings separadas por vírgula.
 * Retorna [] para null, undefined ou string vazia.
 *
 * @example parseList("admin,manager, billing") // ["admin", "manager", "billing"]
 * @example parseList(["a", "", "b"])            // ["a", "b"]
 * @example parseList(null)                      // []
 */
export declare function parseList(value: unknown): string[];
/**
 * Converte um Date para o formato `YYYY-MM-DDTHH:MM` usado em inputs
 * do tipo `datetime-local`, ajustado para o fuso horário local.
 *
 * @example toLocalDateTime(new Date("2026-06-08T15:00:00Z")) // "2026-06-08T12:00" (UTC-3)
 */
export declare function toLocalDateTime(date: Date): string;
export type Result<T, E = Error> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare function toCurrencyFromCents(amountCents: number, locale?: string, currency?: string): string;
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
export declare function optionalString(value: unknown): string | undefined;
/**
 * Gera um ID único com prefixo legível usando crypto.randomUUID().
 * O formato é `<prefix>_<uuid>`, onde o UUID é gerado pelo runtime.
 *
 * @example createId("pat") // "pat_550e8400-e29b-41d4-a716-446655440000"
 * @example createId("apt") // "apt_f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export declare function createId(prefix: string): string;
/**
 * Normaliza uma string para comparações case-insensitive sem acento.
 * Remove diacríticos (NFD) e converte para minúsculas.
 *
 * Usado em: busca de agenda, filtros financeiros, matching de planos,
 * pesquisa de RH, detecção de tipo de exame, validação de guias.
 *
 * @example normalize("Clínica São Paulo") // "clinica sao paulo"
 */
export declare function normalize(value: unknown): string;
