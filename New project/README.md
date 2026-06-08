# Plataforma Modular para Clinica Medica

Software de gestao e automacao para clinicas medicas, com foco em agentes, faturamento, financeiro, atendimento e operacao.

## Objetivo

Criar uma plataforma modular que permita evoluir por partes, mantendo regras de negocio isoladas, auditoria completa e automacoes seguras para tarefas operacionais da clinica.

## Modulos iniciais

- Pacientes e prontuario administrativo
- Agenda, check-in e atendimento
- Faturamento medico e repasses
- Financeiro, contas a pagar/receber e fluxo de caixa
- Automacao com agentes
- Relatorios gerenciais
- Usuarios, permissoes, auditoria e LGPD

## Estrutura

```text
apps/
  api/        API principal
  web/        Interface da aplicacao
data/
  clinic.sqlite  Banco local SQLite criado automaticamente
packages/
  domain/     Entidades, contratos e regras centrais
  agents/     Orquestracao de agentes e automacoes
  shared/     Tipos e utilitarios compartilhados
docs/
  architecture.md
  modules.md
  roadmap.md
```

## Rodando a aplicacao recuperada

Para subir a aplicacao completa em uma unica porta:

```powershell
.\run-clinic.cmd
```

Depois abra:

```text
http://localhost:5173
```

Neste modo, a interface e a API rodam juntas. O lancador fica em `apps/clinic-server-runtime.mjs`, e o runtime recuperado fica em `apps/api/src/clinic-server-runtime.mjs`. Os endpoints ficam na mesma origem:

```text
http://localhost:5173/v1
http://localhost:5173/health
```

## Rodando em modo servidor

Use o script de producao local:

```powershell
.\run-production.cmd
```

Variaveis principais:

```text
APP_ENV=production
PORT=5173
PUBLIC_BASE_URL=https://sistema.sua-clinica.com.br
CLINIC_DATABASE_PATH=data/clinic.sqlite
CLINIC_BACKUPS_PATH=data/backups
```

Checklist detalhado: [docs/deployment.md](docs/deployment.md).

O banco local e criado automaticamente em:

```text
C:\Users\Rodrigo\Documents\New project\data\clinic.sqlite
```

## Alternativa antiga: API e interface separadas

Esta alternativa existe para compatibilidade, mas nao representa toda a aplicacao recuperada. Para usar todos os modulos atuais, prefira `.\run-clinic.cmd`.

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

Enquanto o gerenciador de pacotes nao estiver configurado no ambiente, a API tambem pode ser iniciada diretamente com Node:

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

Tambem e possivel abrir o HTML diretamente no navegador:

```text
apps\web\index.html
```

Ou use o caminho completo:

```text
C:\Users\Rodrigo\Documents\New project\apps\web\index.html
```

## Principios

- Modularidade por dominio, nao por camada tecnica.
- Auditoria em toda acao critica.
- Automacoes com aprovacao humana quando houver risco financeiro, legal ou clinico.
- Dados sensiveis tratados com seguranca e rastreabilidade.
- Integracoes externas isoladas por adaptadores.
