# Plataforma Modular para Clínica Médica

Software de gestão e automação para clínicas médicas, com foco em agentes, faturamento, financeiro, atendimento e operação.

## Objetivo

Criar uma plataforma modular que permita evoluir por partes, mantendo regras de negócio isoladas, auditoria completa e automações seguras para tarefas operacionais da clínica.

## Módulos iniciais

- Pacientes e prontuário administrativo
- Agenda, check-in e atendimento
- Faturamento médico e repasses
- Financeiro, contas a pagar/receber e fluxo de caixa
- Automação com agentes
- Relatórios gerenciais
- Usuários, permissões, auditoria e LGPD

## Estrutura

```text
apps/
  api/        API principal
  web/        Interface da aplicação
data/
  clinic.sqlite  Banco local SQLite criado automaticamente
packages/
  domain/     Entidades, contratos e regras centrais
  agents/     Orquestração de agentes e automações
  shared/     Tipos e utilitários compartilhados
docs/
  architecture.md
  modules.md
  roadmap.md
```

## Rodando a aplicação recuperada

Para subir a aplicação completa em uma única porta:

```powershell
.\run-clinic.cmd
```

Depois abra:

```text
http://localhost:5173
```

Neste modo, a interface e a API rodam juntas. O lançador fica em `apps/clinic-server-runtime.mjs`, e o runtime recuperado fica em `apps/api/src/clinic-server-runtime.mjs`. Os endpoints ficam na mesma origem:

```text
http://localhost:5173/v1
http://localhost:5173/health
```

## Rodando em modo servidor

Use o script de produção local:

```powershell
.\run-production.cmd
```

Variáveis principais:

```text
APP_ENV=production
PORT=5173
PUBLIC_BASE_URL=https://sistema.sua-clinica.com.br
CLINIC_DATABASE_PATH=data/clinic.sqlite
CLINIC_BACKUPS_PATH=data/backups
```

Checklist detalhado: [docs/deployment.md](docs/deployment.md).

O banco local é criado automaticamente em:

```text
C:\Users\Rodrigo\Documents\New project\data\clinic.sqlite
```

## Alternativa antiga: API e interface separadas

Esta alternativa existe para compatibilidade, mas não representa toda a aplicação recuperada. Para usar todos os módulos atuais, prefira `.\run-clinic.cmd`.

```powershell
.\run-dev.cmd
```

Depois abra:

```text
http://localhost:5173
```

No Windows, use o script:

```powershell
.\run-api.cmd
```

Ou:

```powershell
.\run-api.ps1
```

Enquanto o gerenciador de pacotes não estiver configurado no ambiente, a API também pode ser iniciada diretamente com Node:

```powershell
node apps\api\src\main.ts
```

URL local:

```text
http://localhost:3333
```

Endpoints iniciais:

- `GET /health`
- `GET /v1`
- `GET /v1/modules`
- `GET /v1/patients`
- `POST /v1/patients`
- `GET /v1/appointments`
- `POST /v1/appointments`
- `GET /v1/billing/invoices`
- `POST /v1/billing/invoices`
- `GET /v1/finance/entries`
- `POST /v1/finance/entries`
- `GET /v1/agents`

## Abrindo a interface web

Com a API rodando, inicie a interface web:

```powershell
.\run-web.cmd
```

Depois abra:

```text
http://localhost:5173
```

Também é possível abrir o HTML diretamente no navegador:

```text
apps\web\index.html
```

Ou use o caminho completo:

```text
C:\Users\Rodrigo\Documents\New project\apps\web\index.html
```

## Princípios

- Modularidade por domínio, não por camada técnica.
- Auditoria em toda ação crítica.
- Automações com aprovação humana quando houver risco financeiro, legal ou clínico.
- Dados sensíveis tratados com segurança e rastreabilidade.
- Integrações externas isoladas por adaptadores.
