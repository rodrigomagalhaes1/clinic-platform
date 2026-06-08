# API

Base local:

```text
http://localhost:3333
```

## Healthcheck

```http
GET /health
```

## Descoberta

```http
GET /v1
GET /v1/modules
```

## Pacientes

```http
GET /v1/patients
POST /v1/patients
```

Exemplo:

```json
{
  "fullName": "Maria Silva",
  "documentNumber": "12345678900",
  "phone": "+55 11 99999-9999",
  "email": "maria@example.com"
}
```

## Agenda

```http
GET /v1/appointments
POST /v1/appointments
```

Exemplo:

```json
{
  "patientId": "pat_...",
  "professionalId": "prof_demo",
  "startsAt": "2026-05-12T13:00:00.000Z",
  "endsAt": "2026-05-12T13:30:00.000Z"
}
```

## Faturamento

```http
GET /v1/billing/invoices
POST /v1/billing/invoices
```

Exemplo:

```json
{
  "patientId": "pat_...",
  "appointmentId": "apt_...",
  "payerType": "private",
  "totalAmountCents": 25000
}
```

## Financeiro

```http
GET /v1/finance/entries
POST /v1/finance/entries
```

Exemplo:

```json
{
  "direction": "receivable",
  "description": "Consulta particular",
  "amountCents": 25000,
  "dueDate": "2026-05-12"
}
```

## Agentes

```http
GET /v1/agents
```

## Multi-clinica

Use o header `X-Clinic-Id` para informar a clinica ativa. Quando omitido, a API usa `clinic_demo`.

