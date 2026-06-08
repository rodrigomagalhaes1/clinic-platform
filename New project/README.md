# Plataforma Modular para Clínica Médica

Software de gestão e automação para clínicas médicas, com foco em agentes, faturamento, financeiro, atendimento e operação.

[![CI](https://github.com/rodrigomagalhaes1/clinic-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/rodrigomagalhaes1/clinic-platform/actions/workflows/ci.yml)

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
  api/                   API principal TypeScript (Node.js ESM, porta 5173)
  web/                   Interface web (Vite + JS vanilla, porta 5174 em dev)
  clinic-server-runtime.mjs   Servidor full-stack legado (API + web, porta única)
packages/
  shared/    Utilitários compartilhados (normalize, escapeHtml, formatDate…)
  agents/    Definições e políticas de agentes de automação
  domain/    Tipos e entidades de domínio (TypeScript)
data/
  clinic.sqlite  Banco SQLite criado automaticamente na primeira execução
```

## Pré-requisitos

- **Node.js 22+** (requerido para `node:sqlite`)
- **npm 10+** (vem com o Node.js)

## Configuração inicial

```powershell
# Clone e instale as dependências de todos os workspaces
git clone https://github.com/rodrigomagalhaes1/clinic-platform.git
cd clinic-platform/"New project"
npm install

# Copie o arquivo de variáveis de ambiente
copy .env.example .env
```

## Rodando localmente

### Modo recomendado — Full Stack (API + web na mesma porta)

```powershell
.\run-clinic.cmd
```

Acesse em: **http://localhost:5173**

Credenciais padrão: `admin@clinic.local` / `admin123`

### Modo dev — Vite com HMR

Para desenvolvimento com hot-reload no frontend:

```powershell
.\run-dev.cmd
```

Isso inicia dois processos:
- **Servidor Full Stack** em http://localhost:5173 (API + web estático)
- **Vite dev server** em http://localhost:5174 (HMR — proxia `/v1` para 5173)

## Testes

```powershell
# Todos os workspaces
npm test

# Workspace específico
npm test --workspace packages/shared
npm test --workspace packages/agents
npm test --workspace apps/api
```

**97 testes** distribuídos entre os pacotes:

| Pacote | Testes |
|---|---|
| `@clinic/shared` | 58 — funções utilitárias |
| `@clinic/agents` | 12 — estrutura e políticas dos agentes |
| `@clinic/api` | 27 — integração HTTP de todos os endpoints |

## CI

GitHub Actions roda automaticamente em cada push e PR:

- **Tests** — `npm test --workspaces` (vitest)
- **Typecheck** — `npm run typecheck --workspaces` (tsc)
- **Build** — `npm run build --workspaces` (tsc + vite build)

## Pacotes workspace

| Pacote | Descrição | Consumido por |
|---|---|---|
| `@clinic/shared` | normalize, escapeHtml, formatDate, toCurrencyFromCents, parseList, toLocalDateTime | web, api |
| `@clinic/agents` | Definições de agentes e políticas de ferramentas | api |
| `@clinic/domain` | Tipos TypeScript de domínio (Patient, Appointment, FinancialEntry…) | api |

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `5173` | Porta do servidor |
| `APP_ENV` | `development` | Ambiente (`development` / `production`) |
| `CLINIC_DATABASE_PATH` | `data/clinic.sqlite` | Caminho do banco SQLite |
| `CLINIC_BACKUPS_PATH` | `data/backups` | Diretório de backups |
| `CLINIC_MEDIA_PATH` | `data/media` | Diretório de arquivos de mídia |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | URL pública base |

## Princípios

- Modularidade por domínio, não por camada técnica.
- Auditoria em toda ação crítica.
- Automações com aprovação humana quando houver risco financeiro, legal ou clínico.
- Dados sensíveis tratados com segurança e rastreabilidade.
- Integrações externas isoladas por adaptadores.
