# Plataforma Modular para Clínica Médica

Software de gestão e automação para clínicas médicas, com foco em agentes, faturamento, financeiro, atendimento e operação.

## Objetivo

Criar uma plataforma modular que permita evoluir por partes, mantendo regras de negócio isoladas, auditoria completa e automações seguras para tarefas operacionais da clínica.

## Módulos

- Pacientes e prontuário administrativo
- Agenda, check-in e atendimento
- Faturamento médico e repasses
- Financeiro, contas a pagar/receber e fluxo de caixa
- Automação com agentes
- Relacionamento (WhatsApp, URA/Asterisk)
- Usuários, permissões, auditoria e LGPD

## Estrutura

```text
apps/
  api/                   API principal (Node.js ESM)
  web/                   Interface web (Vite + JS vanilla)
  clinic-server-runtime.mjs   Servidor full-stack (API + web, porta única)
packages/
  shared/    Utilitários compartilhados (normalize, escapeHtml, formatDate…)
  agents/    Definições e políticas de agentes de automação
  domain/    Tipos e entidades de domínio (TypeScript)
data/
  clinic.sqlite  Banco SQLite criado automaticamente na primeira execução
```

## Rodando localmente

### Modo recomendado — Full Stack (API + web na mesma porta)

```powershell
node apps\clinic-server-runtime.mjs
```

Acesse em: **http://localhost:5173**

Credenciais padrão: `admin@clinic.local` / `admin123`

### Modo dev — Vite com HMR

Para desenvolvimento com hot-reload e resolução TypeScript dos workspace packages:

```powershell
# Terminal 1 — servidor de API
node apps\clinic-server-runtime.mjs

# Terminal 2 — Vite dev server
npx vite apps/web --config apps/web/vite.config.js --port 5174
```

Acesse em: **http://localhost:5174**

O Vite proxia `/v1` e `/health` para o servidor na porta 5173.

### Via .claude/launch.json (Claude Code)

As configurações de todos os servidores estão em `.claude/launch.json` e podem ser iniciadas pelo `preview_start` do Claude Code.

## Testes

```powershell
# Todos os workspaces
npm test

# Apenas @clinic/shared
node node_modules/vitest/vitest.mjs run --root packages/shared
```

**58 testes** cobrindo as funções utilitárias de `@clinic/shared`.

## CI

GitHub Actions roda automaticamente em cada push e PR:

- **test** — `npm test` (vitest)
- **typecheck** — `npm run typecheck`

## Pacotes workspace

| Pacote | Descrição | Consumido por |
|---|---|---|
| `@clinic/shared` | normalize, escapeHtml, formatDate, toCurrencyFromCents, parseList, toLocalDateTime | web + api |
| `@clinic/agents` | Definições de agentes e políticas de ferramentas | api |
| `@clinic/domain` | Tipos TypeScript de domínio (Patient, Appointment…) | — |

## Variáveis de ambiente

```text
PORT=5173
APP_ENV=production
CLINIC_DATABASE_PATH=data/clinic.sqlite
CLINIC_BACKUPS_PATH=data/backups
PUBLIC_BASE_URL=https://sistema.sua-clinica.com.br
```

## Princípios

- Modularidade por domínio, não por camada técnica.
- Auditoria em toda ação crítica.
- Automações com aprovação humana quando houver risco financeiro, legal ou clínico.
- Dados sensíveis tratados com segurança e rastreabilidade.
- Integrações externas isoladas por adaptadores.
