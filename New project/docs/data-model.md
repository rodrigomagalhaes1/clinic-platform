# Modelo de Dados Inicial

Este documento descreve as entidades centrais da plataforma. O objetivo e manter o dominio claro antes de escolher detalhes finais de banco, ORM e integracoes.

## Clinica

Representa a organizacao dona dos dados.

Campos principais:

- `id`
- `legalName`
- `tradeName`
- `taxId`
- `timezone`
- `createdAt`

Relacionamentos:

- Possui unidades, usuarios, profissionais, pacientes e configuracoes.

## Unidade

Representa uma filial ou local de atendimento.

Campos principais:

- `id`
- `clinicId`
- `name`
- `address`
- `active`

## Paciente

Representa uma pessoa atendida pela clinica.

Campos principais:

- `id`
- `clinicId`
- `fullName`
- `documentNumber`
- `birthDate`
- `phone`
- `email`
- `createdAt`

Observacoes:

- Dados clinicos e administrativos devem ter permissoes separadas.
- Exportacoes e visualizacoes sensiveis precisam gerar auditoria.

## Profissional

Representa medico ou outro profissional de saude.

Campos principais:

- `id`
- `clinicId`
- `fullName`
- `council`
- `councilNumber`
- `specialty`
- `active`

## Consulta

Representa um agendamento ou atendimento.

Campos principais:

- `id`
- `clinicId`
- `unitId`
- `patientId`
- `professionalId`
- `startsAt`
- `endsAt`
- `status`
- `payerType`

Status iniciais:

- `scheduled`
- `confirmed`
- `checked_in`
- `completed`
- `cancelled`
- `no_show`

## Fatura medica

Representa uma cobranca gerada a partir de atendimento, pacote, procedimento ou guia.

Campos principais:

- `id`
- `clinicId`
- `patientId`
- `appointmentId`
- `payerType`
- `status`
- `totalAmountCents`
- `createdAt`

Status iniciais:

- `draft`
- `ready`
- `submitted`
- `paid`
- `denied`
- `cancelled`

## Lancamento financeiro

Representa conta a pagar ou receber.

Campos principais:

- `id`
- `clinicId`
- `direction`
- `description`
- `amountCents`
- `dueDate`
- `paidAt`

## Evento de auditoria

Registra acoes humanas, automacoes e integracoes.

Campos principais:

- `id`
- `clinicId`
- `actorType`
- `actorId`
- `action`
- `resourceType`
- `resourceId`
- `occurredAt`
- `metadata`

## Execucao de agente

Registra cada execucao automatizada.

Campos principais:

- `id`
- `clinicId`
- `agentId`
- `triggerType`
- `status`
- `startedAt`
- `finishedAt`
- `requiresApproval`
- `approvedBy`
- `auditEventId`

