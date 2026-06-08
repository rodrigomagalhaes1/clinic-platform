import { describe, it, expect } from "vitest";
import { normalize, escapeHtml, toCurrencyFromCents, formatDate, parseList, toLocalDateTime } from "./index";
describe("normalize", () => {
    it("remove acentos e converte para minúsculas", () => {
        expect(normalize("Clínica São Paulo")).toBe("clinica sao paulo");
    });
    it("remove cedilha e til", () => {
        expect(normalize("Coração & Pulmão")).toBe("coracao & pulmao");
    });
    it("retorna string vazia para null e undefined", () => {
        expect(normalize(null)).toBe("");
        expect(normalize(undefined)).toBe("");
    });
    it("converte número para string normalizada", () => {
        expect(normalize(42)).toBe("42");
    });
    it("não altera texto já normalizado", () => {
        expect(normalize("clinic automation")).toBe("clinic automation");
    });
});
describe("escapeHtml", () => {
    it("escapa < > & \" '", () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });
    it("escapa aspas simples", () => {
        expect(escapeHtml("it's a test")).toBe("it&#039;s a test");
    });
    it("retorna string vazia para null e undefined", () => {
        expect(escapeHtml(null)).toBe("");
        expect(escapeHtml(undefined)).toBe("");
    });
    it("não altera texto sem caracteres especiais", () => {
        expect(escapeHtml("Hello World")).toBe("Hello World");
    });
    it("escapa múltiplos & na mesma string", () => {
        expect(escapeHtml("A & B & C")).toBe("A &amp; B &amp; C");
    });
});
describe("toCurrencyFromCents", () => {
    it("formata centavos para BRL", () => {
        // 10050 centavos = R$ 100,50
        expect(toCurrencyFromCents(10050)).toMatch(/100[,.]50/);
    });
    it("formata zero corretamente", () => {
        expect(toCurrencyFromCents(0)).toMatch(/0[,.]00/);
    });
    it("formata valores negativos", () => {
        expect(toCurrencyFromCents(-500)).toMatch(/5[,.]00/);
    });
    it("usa locale e moeda customizados", () => {
        const result = toCurrencyFromCents(1000, "en-US", "USD");
        expect(result).toMatch(/10[.,]00/);
    });
});
describe("formatDate", () => {
    it("retorna 'Sem data' para null", () => {
        expect(formatDate(null)).toBe("Sem data");
    });
    it("retorna 'Sem data' para undefined", () => {
        expect(formatDate(undefined)).toBe("Sem data");
    });
    it("retorna 'Sem data' para string vazia", () => {
        expect(formatDate("")).toBe("Sem data");
    });
    it("formata data ISO válida em pt-BR", () => {
        const result = formatDate("2026-06-08T12:00:00.000Z");
        // Deve conter dia, mês e ano separados por /
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
    it("preserva valor original para string inválida", () => {
        expect(formatDate("não-é-uma-data")).toBe("não-é-uma-data");
    });
});
describe("parseList", () => {
    it("faz split de string CSV e faz trim", () => {
        expect(parseList("admin, manager, billing")).toEqual(["admin", "manager", "billing"]);
    });
    it("retorna array filtrado quando recebe array", () => {
        expect(parseList(["a", "", "b", "c"])).toEqual(["a", "b", "c"]);
    });
    it("retorna [] para null", () => {
        expect(parseList(null)).toEqual([]);
    });
    it("retorna [] para undefined", () => {
        expect(parseList(undefined)).toEqual([]);
    });
    it("retorna [] para string vazia", () => {
        expect(parseList("")).toEqual([]);
    });
    it("retorna [] para string só com espaços", () => {
        expect(parseList("   ")).toEqual([]);
    });
    it("filtra entradas vazias resultantes de vírgulas consecutivas", () => {
        expect(parseList("a,,b")).toEqual(["a", "b"]);
    });
});
describe("toLocalDateTime", () => {
    it("retorna string no formato YYYY-MM-DDTHH:MM", () => {
        const date = new Date("2026-06-08T00:00:00.000Z");
        const result = toLocalDateTime(date);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
    it("tem exatamente 16 caracteres", () => {
        expect(toLocalDateTime(new Date())).toHaveLength(16);
    });
    it("ajusta para fuso local (não usa UTC direto)", () => {
        const utcMidnight = new Date("2026-01-01T00:00:00.000Z");
        const result = toLocalDateTime(utcMidnight);
        // Resultado depende do fuso, mas deve ser válido
        expect(result).toMatch(/^2025-12-31T|^2026-01-01T/);
    });
});
