export type AgentRiskLevel = "low" | "medium" | "high";

export type AgentToolPolicy = {
  name: string;
  description: string;
  riskLevel: AgentRiskLevel;
  requiresHumanApproval: boolean;
  allowedReadScopes: string[];
  allowedWriteScopes: string[];
};

export type AgentDefinition = {
  id: string;
  name: string;
  purpose: string;
  tools: AgentToolPolicy[];
};

export const initialAgents: AgentDefinition[] = [
  {
    id: "appointment-confirmation",
    name: "Agente de Confirmacao de Consultas",
    purpose: "Identificar consultas proximas, sugerir mensagens e registrar confirmacoes.",
    tools: [
      {
        name: "sendAppointmentConfirmation",
        description: "Envia mensagem de confirmacao para paciente.",
        riskLevel: "medium",
        requiresHumanApproval: false,
        allowedReadScopes: ["appointments", "patients.contact"],
        allowedWriteScopes: ["appointments.confirmation_attempts"]
      }
    ]
  },
  {
    id: "pre-billing-review",
    name: "Agente de Pre-Faturamento",
    purpose: "Encontrar atendimentos sem cobranca, dados incompletos e possiveis glosas.",
    tools: [
      {
        name: "createBillingReviewTask",
        description: "Cria tarefa para revisao humana de pendencias de faturamento.",
        riskLevel: "low",
        requiresHumanApproval: false,
        allowedReadScopes: ["appointments", "billing", "patients.administrative"],
        allowedWriteScopes: ["tasks"]
      }
    ]
  },
  {
    id: "collections-assistant",
    name: "Agente de Cobranca",
    purpose: "Priorizar inadimplencias e sugerir comunicacoes de cobranca.",
    tools: [
      {
        name: "sendCollectionMessage",
        description: "Envia mensagem de cobranca para responsavel financeiro.",
        riskLevel: "high",
        requiresHumanApproval: true,
        allowedReadScopes: ["finance.receivables", "patients.contact"],
        allowedWriteScopes: ["finance.collection_attempts"]
      }
    ]
  }
];

