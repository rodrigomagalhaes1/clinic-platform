export type ApiModule = {
  name: string;
  icon: string;
  description: string;
};

export const modules: ApiModule[] = [
  {
    name: "front-desk",
    icon: "concierge-bell",
    description: "Recepcao, check-in, fila de chegada e pendencias de atendimento."
  },
  {
    name: "patients",
    icon: "users",
    description: "Cadastro de pacientes, responsaveis e documentos administrativos."
  },
  {
    name: "scheduling",
    icon: "calendar-days",
    description: "Agenda, confirmacoes, check-in e lista de espera."
  },
  {
    name: "billing",
    icon: "receipt-text",
    description: "Faturamento medico, guias, lotes, glosas e repasses."
  },
  {
    name: "finance",
    icon: "wallet-cards",
    description: "Contas a pagar, contas a receber, caixa e conciliacao."
  },
  {
    name: "agents",
    icon: "bot",
    description: "Automacoes assistidas por agentes com politicas de aprovacao."
  },
  {
    name: "settings",
    icon: "settings",
    description: "Configuracoes da clinica, unidades, usuarios, permissoes e automacoes."
  },
  {
    name: "security",
    icon: "shield-check",
    description: "Usuarios, permissoes, auditoria e LGPD."
  }
];
