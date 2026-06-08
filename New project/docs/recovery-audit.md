# Auditoria de Recuperacao

Data: 2026-05-22

## Estado atual

- Aplicacao local validada em `http://localhost:5173/`.
- Servidor unificado ativo em `apps/api/src/clinic-server-runtime.mjs`, com `apps/clinic-server-runtime.mjs` como lancador.
- Banco ativo: `data/clinic.sqlite`.
- Backup manual criado antes da auditoria: `data/backups/clinic-2026-05-22T20-51-48-218Z.sqlite`.
- Usuario local validado: `admin@clinic.local`.

## Como subir o projeto recuperado

Use o modo unificado:

```powershell
.\run-clinic.cmd
```

Depois abra:

```text
http://localhost:5173/
```

O modo antigo com API separada em `http://localhost:3333` nao representa a aplicacao completa atual. A API completa esta sendo servida pela mesma porta da interface, em `http://localhost:5173/v1`.

## Validacoes feitas

- `GET /health` em `5173`: ok.
- `GET /v1` em `5173`: ok.
- Login local: ok.
- Endpoints principais de leitura usados pelo front: ok.
- Navegacao visual por 30 rotas principais: ok.
- Console do browser durante a navegacao: sem erros.
- `run-clinic.cmd` reiniciado com sucesso apos mover o runtime para `apps/api/src`.
- API de recepcao extraida para `apps/api/src/modules/appointments-frontdesk.mjs`.
- Tela de recepcao passou a consumir `/v1/frontdesk/summary`, mostrar proxima acao operacional e usar acoes de status contextuais.

Rotas principais verificadas:

- Dashboard
- Atendimento: recepcao, encaixe, pronto atendimento, pacientes, agenda e totem
- Central de Laudos: worklist, PACS e laudos
- Laboratorio: pedidos/coletas, LIS e laboratorio de apoio
- Faturamento: faturas, lotes, glosas e repasses
- Financeiro: a receber, a pagar, caixa e conciliacao
- Relacionamento: URA e WhatsApp
- Seguranca: usuarios, permissoes e LGPD
- Configuracoes: cadastros, integracoes e menus do sistema
- Recursos Humanos

## Pontos de atencao

- `apps/api/src/clinic-server-runtime.mjs` agora contem o runtime completo recuperado. `apps/api/src/server.ts` ainda permanece como implementacao antiga/minima e pode ser aposentado ou usado como base para uma modularizacao futura.
- `npm` nao esta disponivel no PATH desta maquina, entao `npm run typecheck` nao foi executado.
- URA aparece como desconectada localmente, estado esperado sem conector externo ativo.
- WhatsApp esta em homologacao/offline e mostra falhas de envio por telefones invalidos/provedor indisponivel. Isso parece dado operacional/configuracao externa, nao erro de carregamento do app.
- `git` nao esta disponivel no PATH desta maquina, entao nao foi possivel avaliar status de versionamento.
- Scripts `.cmd` foram ajustados para preferir `%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe` quando disponivel, evitando o `node` do WindowsApps que retornava "Acesso negado".

## Endpoints verificados com sucesso

Todos retornaram HTTP 200 durante a auditoria autenticada:

- `/v1/auth/me`
- `/v1/patients`
- `/v1/appointments`
- `/v1/totem/queues`
- `/v1/totem/counters`
- `/v1/totem/tickets`
- `/v1/totem/calls`
- `/v1/totem/display`
- `/v1/totem/display-config`
- `/v1/totem/audit`
- `/v1/worklist`
- `/v1/pacs/studies`
- `/v1/laboratory/orders`
- `/v1/laboratory/samples`
- `/v1/laboratory/interfaces`
- `/v1/laboratory/support-exams`
- `/v1/billing/invoices`
- `/v1/billing/batches`
- `/v1/billing/denials`
- `/v1/billing/payouts`
- `/v1/finance/entries`
- `/v1/relationship/queues`
- `/v1/relationship/calls`
- `/v1/relationship/whatsapp/config`
- `/v1/relationship/whatsapp/readiness`
- `/v1/relationship/whatsapp/safety-dashboard`
- `/v1/relationship/whatsapp/flows`
- `/v1/relationship/whatsapp/templates`
- `/v1/relationship/whatsapp/autonomy-rules`
- `/v1/relationship/whatsapp/autonomy-profiles`
- `/v1/relationship/whatsapp/journeys`
- `/v1/relationship/whatsapp/prep-rules`
- `/v1/relationship/whatsapp/evolution/status`
- `/v1/relationship/whatsapp/supervision`
- `/v1/relationship/whatsapp/exceptions`
- `/v1/relationship/whatsapp/autonomy-reviews`
- `/v1/relationship/whatsapp/profile-updates`
- `/v1/relationship/whatsapp/consents`
- `/v1/relationship/whatsapp/conversations`
- `/v1/relationship/whatsapp/messages`
- `/v1/relationship/whatsapp/outbox`
- `/v1/relationship/whatsapp/tasks`
- `/v1/relationship/whatsapp/ocr`
- `/v1/relationship/whatsapp/audit`
- `/v1/relationship/ura/config`
- `/v1/relationship/ura/flows`
- `/v1/relationship/ura/live`
- `/v1/relationship/ura/audit`
- `/v1/relationship/ura/readiness`
- `/v1/relationship/ura/events`
- `/v1/relationship/ura/connector`
- `/v1/relationship/ura/commands`
- `/v1/security/users`
- `/v1/security/audit`
- `/v1/registries`
- `/v1/settings/navigation`
- `/v1/appointments/notes`
