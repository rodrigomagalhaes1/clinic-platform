import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { createAppointmentsModule } from "./modules/appointments.mjs";
import { composeRouteModules } from "./modules/router.mjs";
import { createUraModule } from "./modules/relationship-ura.mjs";
import { createWhatsappModule } from "./modules/relationship-whatsapp.mjs";
import { createSettingsRegistriesModule } from "./modules/settings-registries.mjs";
import { createTotemModule } from "./modules/totem.mjs";
import { createWorklistModule } from "./modules/worklist.mjs";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const webRoot = join(projectRoot, "apps", "web");
const appEnv = typeof process === "undefined" ? "development" : process.env.APP_ENV ?? "development";
const publicBaseUrl = typeof process === "undefined" ? "http://localhost:5173" : process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5173}`;
const configuredDatabasePath = typeof process === "undefined" ? undefined : process.env.CLINIC_DATABASE_PATH;
const configuredBackupsPath = typeof process === "undefined" ? undefined : process.env.CLINIC_BACKUPS_PATH;
const configuredMediaPath = typeof process === "undefined" ? undefined : process.env.CLINIC_MEDIA_PATH;
const databasePath = resolveProjectPath(configuredDatabasePath, join(projectRoot, "data", "clinic.sqlite"));
const backupsRoot = resolveProjectPath(configuredBackupsPath, join(projectRoot, "data", "backups"));
const mediaRoot = resolveProjectPath(configuredMediaPath, join(projectRoot, "data", "media"));
const port = Number(typeof process === "undefined" ? 5173 : process.env.PORT ?? 5173);
const execFileAsync = promisify(execFile);

if (globalThis.clinicServerRuntime?.close) {
  await new Promise((resolve) => globalThis.clinicServerRuntime.close(resolve));
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const modules = [
  { name: "front-desk", icon: "concierge-bell", description: "Recepcao, check-in, fila de chegada e pendencias de atendimento." },
  { name: "patients", icon: "users", description: "Cadastro de pacientes, responsaveis e documentos administrativos." },
  { name: "scheduling", icon: "calendar-days", description: "Agenda, confirmacoes, check-in e lista de espera." },
  { name: "laboratory", icon: "stethoscope", description: "LIS, coleta, amostras, exames laboratoriais e resultados." },
  { name: "pacs", icon: "file-text", description: "PACS DICOM, estudos, series, instancias, C-STORE, C-FIND e visualizador." },
  { name: "billing", icon: "receipt-text", description: "Faturamento medico, guias, lotes, glosas e repasses." },
  { name: "finance", icon: "wallet-cards", description: "Contas a pagar, contas a receber, caixa e conciliacao." },
  { name: "relationship", icon: "phone-message", description: "URA, WhatsApp, reputacao, redes sociais e respostas assistidas." },
  { name: "agents", icon: "bot", description: "Automacoes assistidas por agentes com politicas de aprovacao." },
  { name: "settings", icon: "settings", description: "Configuracoes da clinica, unidades, usuarios, permissoes e automacoes." },
  { name: "security", icon: "shield-check", description: "Usuarios, permissoes, auditoria e LGPD." }
];

function resolveProjectPath(value, fallback) {
  if (!value) return fallback;
  return normalize(isAbsolute(value) ? value : join(projectRoot, value));
}

const initialAgents = [
  {
    id: "appointment-confirmation",
    name: "Agente de Confirmacao de Consultas",
    purpose: "Identificar consultas proximas, sugerir mensagens e registrar confirmacoes.",
    tools: [{ name: "sendAppointmentConfirmation", riskLevel: "medium", requiresHumanApproval: false }]
  },
  {
    id: "pre-billing-review",
    name: "Agente de Pre-Faturamento",
    purpose: "Encontrar atendimentos sem cobranca, dados incompletos e possiveis glosas.",
    tools: [{ name: "createBillingReviewTask", riskLevel: "low", requiresHumanApproval: false }]
  },
  {
    id: "collections-assistant",
    name: "Agente de Cobranca",
    purpose: "Priorizar inadimplencias e sugerir comunicacoes de cobranca.",
    tools: [{ name: "sendCollectionMessage", riskLevel: "high", requiresHumanApproval: true }]
  },
  {
    id: "relationship-assistant",
    name: "Agente de Relacionamento",
    purpose: "Classificar chamadas, WhatsApp, avaliacoes e comentarios, sugerindo respostas naturais com escalonamento humano.",
    tools: [
      { name: "draftHumanizedReply", riskLevel: "medium", requiresHumanApproval: false },
      { name: "publishPublicReply", riskLevel: "high", requiresHumanApproval: true }
    ]
  }
];

const relationshipQueues = [
  { id: "scheduling", name: "Agendamento", dtmf: "1", transferTarget: "SIP/fila-agendamento" },
  { id: "results", name: "Resultados", dtmf: "2", transferTarget: "SIP/fila-resultados" },
  { id: "finance", name: "Financeiro", dtmf: "3", transferTarget: "SIP/fila-financeiro" },
  { id: "human", name: "Atendente", dtmf: "4", transferTarget: "SIP/fila-atendimento" }
];

const registryStatusOptions = ["active", "inactive"];
const modalityOptions = ["MR", "CT", "US", "CR", "DX", "MG", "OT"];

function statusField() {
  return { name: "status", label: "Status", type: "select", options: registryStatusOptions };
}

function namedRegistry(type, collection, label, group, extraFields = [], options = {}) {
  const primaryField = options.primaryField ?? "name";
  const nameLabel = options.nameLabel ?? "Nome";
  return {
    type,
    collection,
    label,
    group,
    primaryField,
    statusField: options.statusField ?? "status",
    fields: [
      { name: primaryField, label: nameLabel, required: true },
      ...extraFields,
      statusField()
    ]
  };
}

const branchField = { name: "branch", label: "Filial" };
const registryDefinitions = [
  namedRegistry("dashboard-indicators", "registry_dashboard_indicators", "Painel de Indicadores", "Dashboard", [{ name: "scope", label: "Escopo" }]),
  namedRegistry("dashboard-goals", "registry_dashboard_goals", "Painel de Metas", "Dashboard", [{ name: "metric", label: "Metrica" }, { name: "target", label: "Meta" }]),

  namedRegistry("schedule-flows", "registry_schedule_flows", "Agendamento", "Agenda", [branchField, { name: "defaultDuration", label: "Duracao padrao" }]),
  namedRegistry("schedule-packages", "registry_schedule_packages", "Agendamento por Pacote", "Agenda", [branchField, { name: "quantity", label: "Quantidade" }]),
  namedRegistry("calendars", "registry_calendars", "Calendario", "Agenda", [branchField, { name: "room", label: "Sala" }]),
  namedRegistry("waiting-lists", "registry_waiting_lists", "Lista de Espera", "Agenda", [branchField, { name: "priority", label: "Prioridade" }]),
  namedRegistry("equipment", "registry_equipment", "Aparelho", "Agenda", [branchField, { name: "modality", label: "Modalidade", type: "select", options: modalityOptions }]),
  namedRegistry("exam-assignments", "registry_exam_assignments", "Atribuição de Exames", "Agenda", [branchField, { name: "procedure", label: "Procedimento" }, { name: "room", label: "Sala" }]),
  namedRegistry("scales", "registry_scales", "Escala", "Agenda", [branchField, { name: "professional", label: "Profissional" }]),
  namedRegistry("holidays", "registry_holidays", "Feriados", "Agenda", [branchField, { name: "date", label: "Data" }]),
  namedRegistry("unavailable-times", "registry_unavailable_times", "Indisponibilidade", "Agenda", [branchField, { name: "reason", label: "Motivo" }]),
  namedRegistry("schedule-preferences", "registry_schedule_preferences", "Preferencias", "Agenda", [branchField, { name: "value", label: "Valor" }]),
  namedRegistry("schedule-restrictions", "registry_schedule_restrictions", "Restrições", "Agenda", [branchField, { name: "rule", label: "Regra" }]),
  namedRegistry("restrictive-questions", "registry_restrictive_questions", "Perguntas Restritivas", "Agenda", [branchField, { name: "trigger", label: "Gatilho" }]),
  namedRegistry("rooms", "registry_rooms", "Sala", "Agenda", [branchField, { name: "equipment", label: "Aparelho" }, { name: "modality", label: "Modalidade", type: "select", options: modalityOptions }]),

  namedRegistry("attendance-flows", "registry_attendance_flows", "Atendimento", "Atendimento", [branchField, { name: "rule", label: "Regra" }]),
  namedRegistry("discount-approvals", "registry_discount_approvals", "Aprovação Desconto", "Atendimento", [branchField, { name: "limit", label: "Limite" }]),
  namedRegistry("patient-rules", "registry_patient_rules", "Paciente", "Atendimento", [branchField, { name: "documentRequired", label: "Documento obrigatorio" }]),
  namedRegistry("attendance-documents", "registry_attendance_documents", "Documento", "Atendimento", [branchField, { name: "documentType", label: "Tipo" }]),
  namedRegistry("delivery-methods", "registry_delivery_methods", "Forma de Entrega", "Atendimento", [branchField, { name: "channel", label: "Canal" }]),
  namedRegistry("situation-reasons", "registry_situation_reasons", "Motivos de Situação", "Atendimento", [branchField, { name: "situation", label: "Situação" }]),
  namedRegistry("attendance-rules", "registry_attendance_rules", "Regras de Atendimento", "Atendimento", [branchField, { name: "condition", label: "Condicao" }]),
  namedRegistry("situations", "registry_situations", "Situação", "Atendimento", [branchField, { name: "color", label: "Cor" }]),
  namedRegistry("totem-configs", "registry_totem_configs", "Totem - Configuração", "Atendimento", [branchField, { name: "mode", label: "Modo" }]),
  namedRegistry("totem-counters", "registry_totem_counters", "Guiche", "Atendimento", [branchField, { name: "service", label: "Servico" }]),
  namedRegistry("totem-groups", "registry_totem_groups", "Grupo de Totem", "Atendimento", [branchField, { name: "prefix", label: "Prefixo" }]),
  namedRegistry("room-groups", "registry_room_groups", "Grupo de Salas", "Atendimento", [branchField]),
  namedRegistry("services", "registry_services", "Servicos", "Atendimento", [branchField, { name: "queue", label: "Fila" }]),
  namedRegistry("attendance-priorities", "registry_attendance_priorities", "Prioridade de Atendimento", "Atendimento", [branchField, { name: "weight", label: "Peso" }]),
  namedRegistry("cid-codes", "registry_cid_codes", "CID", "Atendimento", [{ name: "code", label: "Codigo" }]),

  namedRegistry("insurances", "registry_insurances", "Convênio", "Convênio", [{ name: "guideType", label: "Tipo de guia", type: "select", options: ["SADT", "Consulta", "Internacao", "Particular"] }, { name: "guideRequired", label: "Guia obrigatória", type: "select", options: ["Sim", "Nao"] }, branchField]),
  namedRegistry("insurance-enrollments", "registry_insurance_enrollments", "Matrícula por Plano", "Convênio", [{ name: "insurance", label: "Convênio" }, { name: "plan", label: "Plano" }]),
  namedRegistry("plans", "registry_plans", "Plano Convênio", "Convênio", [{ name: "insurance", label: "Convênio" }, branchField]),

  namedRegistry("companies", "registry_companies", "Empresa", "Empresa", [{ name: "cnpj", label: "CNPJ" }]),
  namedRegistry("branches", "registry_branches", "Filial", "Empresa", [{ name: "branchType", label: "Tipo", type: "select", options: ["Filial", "Matriz", "Posto"] }, { name: "neighborhood", label: "Bairro" }]),
  namedRegistry("billing-companies", "registry_billing_companies", "Empresa Faturamento", "Empresa", [{ name: "cnpj", label: "CNPJ" }, branchField]),
  namedRegistry("sectors", "registry_sectors", "Setor", "Empresa", [branchField]),
  namedRegistry("units", "registry_units", "Unidade", "Empresa", [branchField]),

  namedRegistry("payment-resources", "registry_payment_resources", "Recurso de pagamento", "Faturamento", [branchField, { name: "account", label: "Conta" }]),
  namedRegistry("denial-justifications", "registry_denial_justifications", "Justificativa de Glosa", "Faturamento", [{ name: "code", label: "Codigo" }]),
  namedRegistry("denial-reasons", "registry_denial_reasons", "Motivo de Glosa", "Faturamento", [{ name: "code", label: "Codigo" }]),

  namedRegistry("banks", "registry_banks", "Banco", "Financeiro", [{ name: "code", label: "Codigo" }]),
  namedRegistry("financial-categories", "registry_financial_categories", "Categoria Financeira", "Financeiro", [{ name: "direction", label: "Direção", type: "select", options: ["receivable", "payable", "both"] }, { name: "chartAccount", label: "Plano de conta" }]),
  namedRegistry("financial-rules", "registry_financial_rules", "Regra Financeira", "Financeiro", [
    { name: "trigger", label: "Gatilho", type: "select", options: ["insurance_invoice", "private_invoice", "billing_denial", "doctor_payout", "manual_receivable", "manual_payable"] },
    { name: "category", label: "Categoria" },
    { name: "costCenter", label: "Centro de custo" },
    { name: "cashAccount", label: "Conta/caixa" },
    { name: "paymentMethod", label: "Forma de pagamento" },
    { name: "dueDays", label: "Prazo vencimento" }
  ], { primaryField: "ruleName", nameLabel: "Regra" }),
  namedRegistry("cost-centers", "registry_cost_centers", "Centro de Custo", "Financeiro", [branchField]),
  namedRegistry("accounts", "registry_accounts", "Conta", "Financeiro", [{ name: "bank", label: "Banco" }]),
  namedRegistry("payment-methods", "registry_payment_methods", "Forma de Pagamento", "Financeiro", [{ name: "settlementDays", label: "Prazo baixa" }]),
  namedRegistry("chart-accounts", "registry_chart_accounts", "Plano de Conta", "Financeiro", [{ name: "nature", label: "Natureza" }]),
  namedRegistry("movement-types", "registry_movement_types", "Tipo de Movimentação", "Financeiro", [{ name: "direction", label: "Direção", type: "select", options: ["receivable", "payable"] }]),
  namedRegistry("closing-periods", "registry_closing_periods", "Período de Fechamento", "Financeiro", [branchField, { name: "period", label: "Período" }]),

  namedRegistry("hm-groups", "registry_hm_groups", "Grupo de HM", "Honorário Médico", [branchField]),
  namedRegistry("hm-items", "registry_hm_items", "Itens de HM", "Honorário Médico", [{ name: "group", label: "Grupo" }, { name: "rate", label: "Percentual" }]),
  namedRegistry("hm-equipment", "registry_hm_equipment", "HM por Aparelho", "Honorário Médico", [{ name: "equipment", label: "Aparelho" }, { name: "rate", label: "Percentual" }]),
  namedRegistry("payment-deduction-rates", "registry_payment_deduction_rates", "Taxa dedução por forma de pagamento", "Honorário Médico", [{ name: "paymentMethod", label: "Forma de pagamento" }, { name: "rate", label: "Taxa" }]),

  namedRegistry("print-models", "registry_print_models", "Modelo de Impressão", "Impressão", [{ name: "description", label: "Descrição" }, { name: "printType", label: "Tipo", type: "select", options: ["Laudo", "Etiqueta", "Guia", "Recibo"] }, branchField], { primaryField: "model", nameLabel: "Modelo" }),

  namedRegistry("registry-references", "registry_references", "Referências de Cadastros", "Integração", [{ name: "source", label: "Origem" }, { name: "target", label: "Destino" }]),
  namedRegistry("external-systems", "registry_integrations", "Cadastro de Sistemas", "Integração", [branchField, { name: "situation", label: "Situação", type: "select", options: ["Homologacao", "Producao", "Inativo"] }], { primaryField: "description", nameLabel: "Descrição", statusField: "status" }),
  namedRegistry("insurance-gateways", "registry_insurance_gateways", "Convênio Gateway", "Integração", [{ name: "url", label: "URL" }, { name: "login", label: "Login" }], { primaryField: "gateway", nameLabel: "Gateway", statusField: "status" }),
  namedRegistry("invoice-configs", "registry_invoice_configs", "Configuração Nota Fiscal", "Integração", [branchField, { name: "cnpj", label: "CNPJ" }], { primaryField: "issuer", nameLabel: "Emissor" }),

  namedRegistry("cities", "registry_cities", "Município", "Locais", [{ name: "state", label: "UF" }]),
  namedRegistry("origins", "registry_origins", "Procedencia", "Locais", [branchField]),

  namedRegistry("professions", "registry_professions", "Profissão", "Paciente", []),
  namedRegistry("marital-statuses", "registry_marital_statuses", "Estado Civil", "Paciente", []),
  namedRegistry("communication-channels", "registry_communication_channels", "Canal de Comunicação", "Paciente", [{ name: "channelType", label: "Tipo" }]),

  namedRegistry("discount-groups", "registry_discount_groups", "Grupo de Desconto", "Precificação", [{ name: "rate", label: "Percentual" }]),
  namedRegistry("access-discount-groups", "registry_access_discount_groups", "Grupo de Acréscimo / Desconto por Via Acesso", "Precificação", [{ name: "access", label: "Via acesso" }, { name: "rate", label: "Percentual" }]),
  namedRegistry("indexes", "registry_indexes", "Indexador", "Precificação", [{ name: "value", label: "Valor" }]),
  namedRegistry("sizes", "registry_sizes", "Porte", "Precificação", [{ name: "level", label: "Nível" }]),
  namedRegistry("price-tables", "registry_price_tables", "Tabela Preço", "Precificação", [branchField, { name: "insurance", label: "Convênio" }]),

  namedRegistry("anamneses", "registry_anamneses", "Anamnese", "Procedimento", [{ name: "question", label: "Pergunta" }]),
  namedRegistry("procedure-categories", "registry_procedure_categories", "Categoria de Procedimento", "Procedimento", [branchField]),
  namedRegistry("report-groups", "registry_report_groups", "Grupo de Laudo", "Procedimento", [{ name: "modality", label: "Modalidade", type: "select", options: modalityOptions }]),
  namedRegistry("modalities", "registry_modalities", "Modalidade", "Procedimento", [{ name: "dicomCode", label: "Codigo DICOM" }]),
  namedRegistry("procedures", "registry_procedures", "Procedimento", "Procedimento", [{ name: "modality", label: "Modalidade", type: "select", options: modalityOptions }, { name: "duration", label: "Duracao" }, { name: "keywords", label: "Palavras-chave" }, { name: "preparation", label: "Preparo" }]),
  namedRegistry("keywords", "registry_keywords", "Palavras-chave", "Procedimento", [{ name: "procedure", label: "Procedimento" }]),
  namedRegistry("procedure-links", "registry_procedure_links", "Vínculos de Procedimentos", "Procedimento", [{ name: "sourceProcedure", label: "Procedimento origem" }, { name: "targetProcedure", label: "Procedimento vinculado" }]),
  namedRegistry("exam-priorities", "registry_exam_priorities", "Prioridades de Exame", "Procedimento", [{ name: "weight", label: "Peso" }]),

  namedRegistry("employees", "registry_employees", "Colaborador", "Profissional", [
    { name: "nickname", label: "Apelido" },
    { name: "sex", label: "Sexo", type: "select", options: ["F", "M", "Outro"] },
    { name: "birthDate", label: "Data de Nascimento", type: "date" },
    { name: "admissionDate", label: "Data de Admissao", type: "date" },
    { name: "terminationDate", label: "Data de Desligamento", type: "date" },
    { name: "cpf", label: "CPF" },
    { name: "rg", label: "RG" },
    { name: "issuingAgency", label: "Orgao Expedidor" },
    { name: "phone", label: "Telefone", type: "tel" },
    { name: "mobile", label: "Celular", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "zipCode", label: "CEP" },
    { name: "neighborhood", label: "Bairro" },
    { name: "address", label: "Endereco" },
    { name: "addressNumber", label: "Numero" },
    { name: "addressComplement", label: "Complemento" },
    { name: "branches", label: "Filiais" },
    { name: "unit", label: "Unidade" },
    { name: "role", label: "Funcao" }
  ]),
  namedRegistry("user-groups", "registry_user_groups", "Grupo de Usuário", "Profissional", [
    branchField,
    { name: "description", label: "Descricao" },
    { name: "modules", label: "Modulos" },
    { name: "permissions", label: "Permissoes" }
  ]),
  namedRegistry("requesting-doctor-groups", "registry_requesting_doctor_groups", "Grupo de Médicos Solicitantes", "Profissional", [branchField]),
  namedRegistry("doctors", "registry_doctors", "Médico", "Profissional", [
    { name: "nickname", label: "Apelido" },
    { name: "sex", label: "Sexo", type: "select", options: ["F", "M", "Outro"] },
    { name: "council", label: "Conselho", type: "select", options: ["CRM", "CRO", "CRP", "COREN"] },
    { name: "councilNumber", label: "Número conselho" },
    { name: "councilState", label: "Estado Conselho" },
    { name: "specialty", label: "Especialidade" },
    { name: "birthDate", label: "Data de Nascimento", type: "date" },
    { name: "phone", label: "Telefone", type: "tel" },
    { name: "mobile", label: "Celular", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "cpf", label: "CPF" },
    { name: "rg", label: "RG" },
    { name: "issuingAgency", label: "Orgao Expedidor" },
    { name: "zipCode", label: "CEP" },
    { name: "neighborhood", label: "Bairro" },
    { name: "address", label: "Endereco" },
    { name: "branches", label: "Filiais" },
    { name: "unit", label: "Unidade" },
    { name: "requester", label: "Solicitante", type: "select", options: ["Sim", "Nao"] }
  ]),
  namedRegistry("technicians", "registry_technicians", "Tecnico", "Profissional", [{ name: "council", label: "Conselho" }, { name: "councilNumber", label: "Numero conselho" }]),
  namedRegistry("non-cooperative-doctors", "registry_non_cooperative_doctors", "Médico Não Cooperado", "Profissional", [{ name: "council", label: "Conselho" }, { name: "councilNumber", label: "Número conselho" }]),
  namedRegistry("specialties", "registry_specialties", "Especialidades", "Profissional", []),

  namedRegistry("formulas", "registry_formulas", "Fórmula", "Prontuário Eletrônico", [{ name: "expression", label: "Expressão" }]),
  namedRegistry("phrases", "registry_phrases", "Frase", "Prontuário Eletrônico", [{ name: "text", label: "Texto" }]),
  namedRegistry("exam-types", "registry_exam_types", "Tipo Exame", "Prontuário Eletrônico", [{ name: "category", label: "Categoria" }]),

  namedRegistry("stocks", "registry_stocks", "Estoque", "Suprimentos", [branchField]),
  namedRegistry("suppliers", "registry_suppliers", "Fornecedor", "Suprimentos", [{ name: "cnpj", label: "CNPJ" }]),
  namedRegistry("materials", "registry_materials", "Material", "Suprimentos", [{ name: "unit", label: "Unidade" }]),
  namedRegistry("supply-categories", "registry_supply_categories", "Categoria", "Suprimentos", []),
  namedRegistry("material-kits", "registry_material_kits", "Kit de Material", "Suprimentos", [{ name: "materials", label: "Materiais" }]),

  namedRegistry("security-policies", "registry_security_policies", "Política de Segurança", "Segurança", [{ name: "value", label: "Valor" }]),
  namedRegistry("ip-access-controls", "registry_ip_access_controls", "Controle de acesso por IP", "Segurança", [{ name: "ipRange", label: "Faixa de IP" }])
];

const registryDefinitionsByType = new Map(registryDefinitions.map((definition) => [definition.type, definition]));

mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  create table if not exists records (
    collection text not null,
    id text not null,
    payload text not null,
    created_at text not null,
    updated_at text not null,
    primary key (collection, id)
  );
`);

const upsert = database.prepare(`
  insert into records (collection, id, payload, created_at, updated_at)
  values (?, ?, ?, datetime('now'), datetime('now'))
  on conflict(collection, id) do update set payload = excluded.payload, updated_at = datetime('now')
`);
const listRows = database.prepare("select payload from records where collection = ? order by created_at desc");
const getRow = database.prepare("select payload from records where collection = ? and id = ? limit 1");
const deleteRow = database.prepare("delete from records where collection = ? and id = ?");

function list(collection) {
  return listRows.all(collection).map((record) => JSON.parse(String(record.payload)));
}

function create(collection, row) {
  upsert.run(collection, row.id, JSON.stringify(row));
  return row;
}

function get(collection, recordId) {
  const record = getRow.get(collection, recordId);
  return record ? JSON.parse(String(record.payload)) : undefined;
}

function remove(collection, recordId) {
  deleteRow.run(collection, recordId);
}

function id(prefix) {
  return `${prefix}_${randomUUID()}`;
}

const uraModule = createUraModule({
  readBody,
  sendJson,
  sendError,
  logAudit,
  list,
  get,
  create,
  id,
  clinicId,
  optional,
  booleanValue,
  publicBaseUrl,
  relationshipQueues,
  simulateRelationshipCall,
  inferRelationshipIntent,
  normalizeText,
  systemUser,
});
const whatsappModule = createWhatsappModule({
  readBody,
  sendJson,
  sendError,
  corsHeaders,
  securityHeaders,
  list,
  get,
  create,
  clinicId,
  optional,
  booleanValue,
  systemUser,
  getWhatsappConfig,
  publicWhatsappConfig,
  ingestWhatsappWebhook,
  auditWhatsapp,
  buildWhatsappReadiness,
  buildWhatsappSafetyDashboard,
  whatsappFlows,
  createWhatsappFlow,
  whatsappTemplates,
  createWhatsappTemplate,
  whatsappAutonomyRules,
  createWhatsappAutonomyRule,
  whatsappAutonomyProfiles,
  createWhatsappAutonomyProfile,
  whatsappJourneys,
  createWhatsappJourney,
  validateWhatsappInsurance,
  whatsappPrepRules,
  createWhatsappPrepRule,
  getEvolutionStatus,
  createEvolutionInstance,
  connectEvolutionInstance,
  buildWhatsappSupervision,
  buildWhatsappExceptionQueue,
  buildWhatsappAutonomyReviews,
  whatsappProfileUpdates,
  whatsappConsents,
  createWhatsappConsent,
  resolveWhatsappProfileUpdate,
  assumeWhatsappConversation,
  releaseWhatsappConversation,
  resolveWhatsappConversation,
  approveWhatsappAutonomyReview,
  rejectWhatsappAutonomyReview,
  createManualWhatsappReply,
  whatsappOutbox,
  sendWhatsappMessage,
  resolveWhatsappOutboundFailure,
  updateWhatsappMessageStatus,
  ingestWhatsappMessage,
  identifyWhatsappPatient,
  publicPatientIdentity,
  buildAppointmentAvailability
});
const settingsRegistriesModule = createSettingsRegistriesModule({
  readBody,
  sendJson,
  sendError,
  logAudit,
  list,
  create,
  remove,
  id,
  clinicId,
  optional,
  hasPermission,
  updateSystemNavigationOverride,
  systemNavigationOverrides,
  sanitizeRegistryPayload,
  registryDefinitions,
  registryDefinitionsByType
});
const totemModule = createTotemModule({
  readBody,
  sendJson,
  sendError,
  logAudit,
  list,
  get,
  create,
  id,
  clinicId,
  optional
});
const appointmentsModule = createAppointmentsModule({
  readBody,
  sendJson,
  sendError,
  logAudit,
  list,
  get,
  create,
  id,
  clinicId,
  optional,
  requirePermission,
  findRegistryByName,
  normalizeText,
  procedureDurationMinutes,
  inferModality
});
const worklistModule = createWorklistModule({
  sendJson,
  logAudit,
  create,
  get,
  requireAnyPermission,
  buildWorklistOrders,
  buildWorklistOrder,
  inferAeTitle
});
const routeModules = composeRouteModules([
  uraModule,
  whatsappModule,
  settingsRegistriesModule,
  totemModule,
  appointmentsModule,
  worklistModule
]);
seedRegistryData();
seedOperationalData();
seedSecurityData();
const backupTimer = setInterval(runDueBackup, 60 * 1000);
backupTimer.unref?.();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const method = request.method ?? "GET";

  if (method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "clinic-automation-api",
      environment: appEnv,
      publicBaseUrl,
      database: databasePath,
      backups: backupsRoot,
      security: list("users").length > 0 ? "enabled" : "not_configured",
      uptimeSeconds: Math.round(process.uptime?.() ?? 0),
      checkedAt: new Date().toISOString()
    });
    return;
  }

  if (await routeModules.handleWebhook({ request, response, url, method })) {
    return;
  }

  if (method === "POST" && url.pathname === "/v1/auth/login") {
    const body = await readBody(request);
    const user = list("users").find((item) => item.email === String(body.email ?? "").toLowerCase() && item.status === "active");
    if (!user || !verifyPassword(String(body.password ?? ""), user.passwordHash)) {
      logAudit(request, { action: "auth.login_failed", resource: "auth", details: { email: body.email } });
      sendError(response, 401, "Credenciais invalidas");
      return;
    }

    const session = createSession(user, request);
    logAudit(request, { user, action: "auth.login", resource: "auth", resourceId: session.id });
    sendJson(response, 200, { data: { token: session.token, user: publicUser(user), expiresAt: session.expiresAt } });
    return;
  }

  const requiresAuthentication = url.pathname.startsWith("/v1/");
  const currentUser = requiresAuthentication ? authenticateRequest(request) : undefined;
  if (requiresAuthentication && !currentUser) {
    sendError(response, 401, "Sessao invalida ou expirada");
    return;
  }

  if (requiresAuthentication && ["POST", "PATCH"].includes(method) && !url.pathname.startsWith("/v1/auth/")) {
    logAudit(request, { user: currentUser, action: `${method} ${url.pathname}`, resource: url.pathname });
  }

  const requestedModule = moduleForPath(url.pathname);
  if (requestedModule && method !== "GET" && url.pathname !== "/v1/settings/navigation/access-denied" && !canAccessModule(currentUser, requestedModule)) {
    sendError(response, 403, "Usuario sem acesso a este modulo");
    return;
  }

  if (method === "GET" && url.pathname === "/v1/auth/me") {
    sendJson(response, 200, { data: publicUser(currentUser) });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/auth/logout") {
    const token = bearerToken(request);
    const session = list("sessions").find((item) => item.token === token);
    if (session) create("sessions", { ...session, status: "revoked", revokedAt: new Date().toISOString() });
    logAudit(request, { user: currentUser, action: "auth.logout", resource: "auth", resourceId: session?.id });
    sendJson(response, 200, { data: { ok: true } });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/audit") {
    requireRole(response, currentUser, ["admin", "manager"]);
    if (response.writableEnded) return;
    sendJson(response, 200, { data: list("audit_events").slice(0, 120) });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/readiness") {
    sendJson(response, 200, { data: productionReadiness() });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/deployment") {
    requireRole(response, currentUser, ["admin", "manager"]);
    if (response.writableEnded) return;
    sendJson(response, 200, { data: deploymentReadiness() });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/security/system-state/snapshot") {
    requireRole(response, currentUser, ["admin", "manager"]);
    if (response.writableEnded) return;
    const body = await readBody(request);
    const event = logAudit(request, {
      user: currentUser,
      action: "security.system_state_snapshot",
      resource: "security",
      resourceId: "system_state",
      details: {
        checksOk: Number(body.checksOk ?? 0),
        totalChecks: Number(body.totalChecks ?? 0),
        checks: Array.isArray(body.checks) ? body.checks.slice(0, 20) : [],
        version: optional(body.version),
        generatedAt: optional(body.generatedAt) ?? new Date().toISOString()
      }
    });
    sendJson(response, 201, { data: event });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/security/backup") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;
    const backup = createBackup(request, currentUser, "manual");
    applyBackupRetention();
    sendJson(response, 201, { data: backup });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/backups") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;
    sendJson(response, 200, { data: list("backups") });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/backup-policy") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;
    sendJson(response, 200, { data: getBackupPolicy() });
    return;
  }

  if (method === "PATCH" && url.pathname === "/v1/security/backup-policy") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;
    const body = await readBody(request);
    const currentPolicy = getBackupPolicy();
    const intervalHours = Math.max(1, Math.min(168, Number(body.intervalHours ?? currentPolicy.intervalHours)));
    const policy = create("backup_policies", {
      ...currentPolicy,
      enabled: String(body.enabled ?? currentPolicy.enabled) === "true" || body.enabled === true,
      intervalHours,
      retainLast: Math.max(1, Math.min(60, Number(body.retainLast ?? currentPolicy.retainLast))),
      nextRunAt: optional(body.nextRunAt) ?? currentPolicy.nextRunAt ?? new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    });
    logAudit(request, { user: currentUser, action: "security.backup_policy_updated", resource: "backup_policies", resourceId: policy.id });
    sendJson(response, 200, { data: policy });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/lgpd/terms") {
    sendJson(response, 200, { data: list("lgpd_terms") });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/lgpd/consents") {
    const patientId = url.searchParams.get("patientId");
    const consents = list("lgpd_consents").filter((consent) => !patientId || consent.patientId === patientId);
    sendJson(response, 200, { data: consents });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/lgpd/consents") {
    const body = await readBody(request);
    const patient = get("patients", String(body.patientId));
    if (!patient) {
      sendError(response, 404, "Patient not found");
      return;
    }

    const term = get("lgpd_terms", optional(body.termId) ?? "lgpd_term_default");
    const now = new Date().toISOString();
    const consent = create("lgpd_consents", {
      id: id("consent"),
      clinicId: clinicId(request),
      patientId: patient.id,
      patientName: patient.fullName,
      termId: term?.id ?? "lgpd_term_default",
      termVersion: term?.version ?? "1.0",
      status: optional(body.status) ?? "granted",
      channel: optional(body.channel) ?? "presencial",
      purpose: optional(body.purpose) ?? "Tratamento de dados para atendimento assistencial e administrativo.",
      notes: optional(body.notes),
      collectedBy: currentUser.id,
      collectedByName: currentUser.name,
      collectedAt: now
    });

    create("patients", {
      ...patient,
      lgpdConsentStatus: consent.status,
      lgpdConsentAt: now,
      updatedAt: now
    });
    logAudit(request, { user: currentUser, action: "lgpd.consent_registered", resource: "patients", resourceId: patient.id });
    sendJson(response, 201, { data: consent });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/lgpd/accesses") {
    const events = list("audit_events").filter((event) => String(event.action).startsWith("lgpd."));
    sendJson(response, 200, { data: events });
    return;
  }

  const lgpdPatientActionMatch = url.pathname.match(/^\/v1\/lgpd\/patients\/([^/]+)\/(access|export|anonymize)$/);
  if (method === "POST" && lgpdPatientActionMatch) {
    const patient = get("patients", lgpdPatientActionMatch[1]);
    if (!patient) {
      sendError(response, 404, "Patient not found");
      return;
    }

    const body = await readBody(request);
    const action = lgpdPatientActionMatch[2];
    const now = new Date().toISOString();
    if (action === "access") {
      logAudit(request, {
        user: currentUser,
        action: "lgpd.sensitive_access",
        resource: "patients",
        resourceId: patient.id,
        details: { reason: optional(body.reason) ?? "Acesso operacional a dados do paciente" }
      });
      sendJson(response, 201, { data: { ok: true, patientId: patient.id, recordedAt: now } });
      return;
    }

    const requestRecord = create("lgpd_requests", {
      id: id("lgpdreq"),
      clinicId: clinicId(request),
      patientId: patient.id,
      patientName: patient.fullName,
      requestType: action === "export" ? "export" : "anonymization",
      status: action === "export" ? "ready" : "pending_human_approval",
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      requestedAt: now,
      notes: optional(body.notes),
      exportPayload: action === "export" ? publicPatientExport(patient) : undefined
    });
    logAudit(request, { user: currentUser, action: `lgpd.${requestRecord.requestType}_requested`, resource: "patients", resourceId: patient.id });
    sendJson(response, 201, { data: requestRecord });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/security/users") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;
    sendJson(response, 200, { data: list("users").map(publicUser) });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/security/users") {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;

    const body = await readBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !String(body.name ?? "").trim() || !String(body.password ?? "").trim()) {
      sendError(response, "Nome, e-mail e senha sao obrigatorios");
      return;
    }
    if (list("users").some((user) => user.email === email)) {
      sendError(response, "Ja existe usuario com este e-mail");
      return;
    }

    const userGroup = userGroupByName(body.userGroup);
    const requestedModules = normalizeModules(body.modules);
    const requestedPermissions = normalizeList(body.permissions);
    const groupModules = normalizeModules(userGroup?.modules);
    const groupPermissions = normalizeList(userGroup?.permissions);

    const user = create("users", {
      id: id("usr"),
      clinicId: clinicId(request),
      name: String(body.name).trim(),
      email,
      passwordHash: hashPassword(String(body.password)),
      role: normalizeRole(body.role),
      status: optional(body.status) ?? "active",
      modules: requestedModules.length ? requestedModules : groupModules,
      professionalType: optional(body.professionalType),
      professionalId: optional(body.professionalId),
      professionalName: optional(body.professionalName),
      userGroup: optional(body.userGroup),
      permissions: requestedPermissions.length ? requestedPermissions : groupPermissions,
      createdAt: new Date().toISOString()
    });
    logAudit(request, { user: currentUser, action: "security.user_created", resource: "users", resourceId: user.id });
    sendJson(response, 201, { data: publicUser(user) });
    return;
  }

  const userEditMatch = url.pathname.match(/^\/v1\/security\/users\/([^/]+)$/);
  if (method === "PATCH" && userEditMatch) {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;

    const user = get("users", userEditMatch[1]);
    if (!user) {
      sendError(response, 404, "User not found");
      return;
    }

    const body = await readBody(request);
    const email = optional(body.email)?.toLowerCase() ?? user.email;
    if (email !== user.email && list("users").some((item) => item.id !== user.id && item.email === email)) {
      sendError(response, "Ja existe usuario com este e-mail");
      return;
    }
    if (user.id === currentUser.id && String(body.status) === "inactive") {
      sendError(response, "Voce nao pode inativar seu proprio usuario");
      return;
    }

    const userGroup = userGroupByName(body.userGroup);
    const requestedModules = normalizeModules(body.modules);
    const requestedPermissions = normalizeList(body.permissions);
    const groupModules = normalizeModules(userGroup?.modules);
    const groupPermissions = normalizeList(userGroup?.permissions);
    const password = optional(body.password);
    const updated = create("users", {
      ...user,
      name: optional(body.name) ?? user.name,
      email,
      passwordHash: password ? hashPassword(password) : user.passwordHash,
      role: normalizeRole(body.role ?? user.role),
      status: optional(body.status) ?? user.status ?? "active",
      modules: requestedModules.length ? requestedModules : groupModules.length ? groupModules : user.modules ?? [],
      professionalType: optional(body.professionalType) ?? user.professionalType,
      professionalId: optional(body.professionalId) ?? user.professionalId,
      professionalName: optional(body.professionalName) ?? user.professionalName,
      userGroup: optional(body.userGroup) ?? user.userGroup,
      permissions: requestedPermissions.length ? requestedPermissions : groupPermissions.length ? groupPermissions : user.permissions ?? [],
      updatedBy: currentUser.id,
      updatedByName: currentUser.name,
      updatedAt: new Date().toISOString()
    });
    logAudit(request, {
      user: currentUser,
      action: "security.user_updated",
      resource: "users",
      resourceId: updated.id,
      details: { role: updated.role, status: updated.status, userGroup: updated.userGroup }
    });
    sendJson(response, 200, { data: publicUser(updated) });
    return;
  }

  const userStatusMatch = url.pathname.match(/^\/v1\/security\/users\/([^/]+)\/status$/);
  if (method === "PATCH" && userStatusMatch) {
    requireRole(response, currentUser, ["admin"]);
    if (response.writableEnded) return;

    const user = get("users", userStatusMatch[1]);
    if (!user) {
      sendError(response, 404, "User not found");
      return;
    }
    const body = await readBody(request);
    if (user.id === currentUser.id && String(body.status) === "inactive") {
      sendError(response, "Voce nao pode inativar seu proprio usuario");
      return;
    }

    const updated = create("users", {
      ...user,
      status: optional(body.status) ?? "active",
      updatedAt: new Date().toISOString()
    });
    logAudit(request, { user: currentUser, action: "security.user_status_changed", resource: "users", resourceId: updated.id });
    sendJson(response, 200, { data: publicUser(updated) });
    return;
  }

  if (url.pathname === "/v1") {
    sendJson(response, 200, { name: "Clinic Automation API", version: "0.1.0", modules: modules.map((module) => module.name) });
    return;
  }

  if (url.pathname === "/v1/modules") {
    sendJson(response, 200, { data: modules });
    return;
  }

  if (url.pathname === "/v1/agents") {
    sendJson(response, 200, { data: initialAgents });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/relationship/queues") {
    sendJson(response, 200, { data: relationshipQueues });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/pacs/studies") {
    sendJson(response, 200, { data: list("pacs_studies") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/pacs/studies/simulate-store") {
    const body = await readBody(request);
    const study = simulateDicomStore(body);
    create("pacs_studies", study);
    sendJson(response, 201, { data: study });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/reports") {
    sendJson(response, 200, { data: buildClinicalReports() });
    return;
  }

  const reportCreateMatch = url.pathname.match(/^\/v1\/reports\/([^/]+)$/);
  if (method === "POST" && reportCreateMatch) {
    const study = get("pacs_studies", reportCreateMatch[1]);
    if (!study) return sendJson(response, 404, { error: { code: "not_found", message: "Study not found" } });
    if (study.reconciliationStatus !== "matched") return sendError(response, "Only reconciled studies can generate reports");

    const body = await readBody(request);
    const report = create("clinical_reports", {
      id: `rep_${study.id}`,
      studyId: study.id,
      accessionNumber: study.accessionNumber,
      patientId: study.matchedPatientId ?? study.patientId,
      patientName: study.matchedPatientName ?? study.patientName,
      procedureName: study.matchedProcedureName ?? study.studyDescription,
      status: "draft",
      reportText: optional(body.reportText) ?? defaultReportText(study),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    sendJson(response, 201, { data: mergeClinicalReport(study, report) });
    return;
  }

  const reportStatusMatch = url.pathname.match(/^\/v1\/reports\/([^/]+)\/status$/);
  if (method === "PATCH" && reportStatusMatch) {
    const report = get("clinical_reports", reportStatusMatch[1]);
    if (!report) return sendJson(response, 404, { error: { code: "not_found", message: "Report not found" } });

    const body = await readBody(request);
    const allowedStatuses = new Set(["draft", "in_review", "signed"]);
    const nextStatus = String(body.status ?? "");
    if (!allowedStatuses.has(nextStatus)) return sendError(response, "Invalid report status");

    const updated = create("clinical_reports", {
      ...report,
      status: nextStatus,
      reportText: optional(body.reportText) ?? report.reportText,
      reviewedAt: nextStatus === "in_review" ? new Date().toISOString() : report.reviewedAt,
      signedAt: nextStatus === "signed" ? new Date().toISOString() : report.signedAt,
      updatedAt: new Date().toISOString()
    });
    const study = get("pacs_studies", updated.studyId);
    sendJson(response, 200, { data: study ? mergeClinicalReport(study, updated) : updated });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/deliveries") {
    sendJson(response, 200, { data: buildResultDeliveries() });
    return;
  }

  const deliveryActionMatch = url.pathname.match(/^\/v1\/deliveries\/([^/]+)\/(send|portal-link|view|block)$/);
  if (method === "POST" && deliveryActionMatch) {
    const delivery = buildResultDeliveries().find((item) => item.id === deliveryActionMatch[1]);
    if (!delivery) return sendJson(response, 404, { error: { code: "not_found", message: "Delivery not found" } });

    const action = deliveryActionMatch[2];
    const nextStatus = {
      send: "sent",
      "portal-link": "sent",
      view: "viewed",
      block: "blocked"
    }[action];

    const saved = create("result_deliveries", {
      id: delivery.id,
      reportId: delivery.reportId,
      patientId: delivery.patientId,
      patientName: delivery.patientName,
      accessionNumber: delivery.accessionNumber,
      channel: action === "portal-link" ? "portal" : action === "send" ? "whatsapp" : delivery.channel,
      status: nextStatus,
      portalLink: action === "portal-link" ? delivery.portalLink : delivery.portalLink,
      auditTrail: [
        ...(delivery.auditTrail ?? []),
        {
          action,
          status: nextStatus,
          at: new Date().toISOString(),
          actor: "clinic_demo"
        }
      ],
      updatedAt: new Date().toISOString()
    });

    sendJson(response, 200, { data: mergeResultDelivery(delivery.report, saved) });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/supplies") {
    sendJson(response, 200, { data: list("supplies") });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/laboratory/orders") {
    sendJson(response, 200, { data: list("laboratory_orders") });
    return;
  }

  const appointmentLaboratoryOrderMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/laboratory-order$/);
  if (method === "POST" && appointmentLaboratoryOrderMatch) {
    const appointment = get("appointments", appointmentLaboratoryOrderMatch[1]);
    if (!appointment) return sendError(response, 404, "Appointment not found");

    const patient = get("patients", appointment.patientId);
    if (!patient) return sendError(response, 404, "Patient not found");

    const existing = list("laboratory_orders").find((order) => order.appointmentId === appointment.id && !["released"].includes(order.status));
    if (existing) {
      sendJson(response, 200, { data: { order: existing, sample: get("laboratory_samples", `sample_${existing.id}`), reused: true } });
      return;
    }

    const body = await readBody(request);
    const now = new Date().toISOString();
    const order = create("laboratory_orders", {
      id: id("lab"),
      clinicId: clinicId(request),
      appointmentId: appointment.id,
      patientId: patient.id,
      patientName: patient.fullName,
      examName: optional(body.examName) ?? appointment.procedureName ?? "Exame laboratorial",
      material: optional(body.material) ?? inferLaboratoryMaterial(appointment.procedureName),
      priority: optional(body.priority) ?? appointment.priority ?? "routine",
      insuranceName: appointment.insuranceName ?? "Particular",
      status: "ordered",
      source: "pronto_atendimento",
      requestedAt: now,
      createdAt: now
    });
    const sample = create("laboratory_samples", buildLaboratorySample(order, now));
    const updatedAppointment = create("appointments", {
      ...appointment,
      emergencyStage: appointment.attendanceType === "urgent_care" ? "referred_lab" : appointment.emergencyStage,
      laboratoryStatus: "ordered",
      labOrderId: order.id,
      labSampleId: sample.id,
      referredAt: appointment.attendanceType === "urgent_care" ? now : appointment.referredAt,
      status: appointment.attendanceType === "urgent_care" ? "in_attendance" : appointment.status,
      updatedAt: now
    });
    logAudit(request, {
      user: currentUser,
      action: "appointments.laboratory_order_created",
      resource: "appointments",
      resourceId: appointment.id,
      details: { labOrderId: order.id, sampleBarcode: sample.barcode, emergencyStage: updatedAppointment.emergencyStage }
    });
    sendJson(response, 201, { data: { appointment: updatedAppointment, order, sample } });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/laboratory/orders") {
    const body = await readBody(request);
    const patient = get("patients", String(body.patientId));
    if (!patient) {
      sendError(response, 404, "Patient not found");
      return;
    }

    const now = new Date().toISOString();
    const order = create("laboratory_orders", {
      id: id("lab"),
      clinicId: clinicId(request),
      patientId: patient.id,
      patientName: patient.fullName,
      examName: optional(body.examName) ?? "Hemograma completo",
      material: optional(body.material) ?? "Sangue total",
      priority: optional(body.priority) ?? "routine",
      insuranceName: optional(body.insuranceName) ?? "Particular",
      status: "ordered",
      requestedAt: now,
      createdAt: now
    });
    create("laboratory_samples", buildLaboratorySample(order, now));
    sendJson(response, 201, { data: order });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/laboratory/samples") {
    sendJson(response, 200, { data: list("laboratory_samples") });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/laboratory/interfaces") {
    sendJson(response, 200, { data: list("laboratory_interfaces") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/laboratory/interfaces") {
    requirePermission(response, currentUser, "lis_interface");
    if (response.writableEnded) return;

    const body = await readBody(request);
    const now = new Date().toISOString();
    const item = create("laboratory_interfaces", {
      id: id("lis"),
      clinicId: clinicId(request),
      equipmentName: optional(body.equipmentName) ?? "Equipamento LIS",
      equipmentCode: optional(body.equipmentCode) ?? `EQP-${String(Date.now()).slice(-4)}`,
      protocol: optional(body.protocol) ?? "ASTM",
      connection: optional(body.connection) ?? "TCP",
      direction: optional(body.direction) ?? "bidirectional",
      status: optional(body.status) ?? "testing",
      createdAt: now
    });
    sendJson(response, 201, { data: item });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/laboratory/support-exams") {
    sendJson(response, 200, { data: list("support_lab_exams") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/laboratory/support-exams") {
    requirePermission(response, currentUser, "support_lab_receive");
    if (response.writableEnded) return;

    const body = await readBody(request);
    const now = new Date().toISOString();
    const item = create("support_lab_exams", {
      id: id("supportlab"),
      clinicId: clinicId(request),
      supportLabName: optional(body.supportLabName) ?? "Laboratorio de apoio",
      externalProtocol: optional(body.externalProtocol) ?? `EXT-${String(Date.now()).slice(-6)}`,
      patientName: optional(body.patientName) ?? "Paciente externo",
      examName: optional(body.examName) ?? "Exame externo",
      material: optional(body.material) ?? "Soro",
      status: optional(body.status) ?? "received",
      resultText: optional(body.resultText),
      receivedAt: now,
      createdAt: now
    });
    sendJson(response, 201, { data: item });
    return;
  }

  const labStatusMatch = url.pathname.match(/^\/v1\/laboratory\/orders\/([^/]+)\/status$/);
  if (method === "PATCH" && labStatusMatch) {
    const order = get("laboratory_orders", labStatusMatch[1]);
    if (!order) {
      sendError(response, 404, "Laboratory order not found");
      return;
    }

    const body = await readBody(request);
    const allowedStatuses = new Set(["ordered", "collected", "processing", "validated", "released"]);
    const nextStatus = String(body.status ?? "");
    if (!allowedStatuses.has(nextStatus)) return sendError(response, "Invalid laboratory status");

    const now = new Date().toISOString();
  const updated = create("laboratory_orders", {
      ...order,
      status: nextStatus,
      resultText: optional(body.resultText) ?? order.resultText,
      collectedAt: nextStatus === "collected" ? now : order.collectedAt,
      processedAt: nextStatus === "processing" ? now : order.processedAt,
      validatedAt: nextStatus === "validated" ? now : order.validatedAt,
      releasedAt: nextStatus === "released" ? now : order.releasedAt,
      updatedAt: now
    });

    if (order.appointmentId) {
      const appointment = get("appointments", order.appointmentId);
      if (appointment) {
        create("appointments", {
          ...appointment,
          laboratoryStatus: nextStatus,
          updatedAt: now
        });
      }
    }
    logAudit(request, {
      user: currentUser,
      action: "laboratory.order_status_updated",
      resource: "laboratory_orders",
      resourceId: order.id,
      details: { previousStatus: order.status, nextStatus, appointmentId: order.appointmentId }
    });

    const sample = get("laboratory_samples", `sample_${order.id}`) ?? buildLaboratorySample(order, order.createdAt ?? now);
    create("laboratory_samples", {
      ...sample,
      status: laboratorySampleStatus(nextStatus),
      updatedAt: now
    });

    sendJson(response, 200, { data: updated });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/supplies") {
    const body = await readBody(request);
    if (!body.item) return sendError(response, "item is required");

    const supply = create("supplies", {
      id: id("sup"),
      clinicId: clinicId(request),
      item: String(body.item),
      stock: optional(body.stock) ?? "Almoxarifado",
      unit: optional(body.unit) ?? "Unidade Principal",
      quantity: Number(body.quantity || 1),
      status: optional(body.status) ?? "requested",
      dueDate: optional(body.dueDate) ?? new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    });
    sendJson(response, 201, { data: supply });
    return;
  }

  const supplyStatusMatch = url.pathname.match(/^\/v1\/supplies\/([^/]+)\/status$/);
  if (method === "PATCH" && supplyStatusMatch) {
    const supply = get("supplies", supplyStatusMatch[1]);
    if (!supply) return sendJson(response, 404, { error: { code: "not_found", message: "Supply request not found" } });

    const body = await readBody(request);
    const allowedStatuses = new Set(["requested", "quoted", "transferred"]);
    const nextStatus = String(body.status ?? "");
    if (!allowedStatuses.has(nextStatus)) return sendError(response, "Invalid supply status");

    const updated = create("supplies", {
      ...supply,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
    sendJson(response, 200, { data: updated });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/prices") {
    sendJson(response, 200, { data: list("price_rules") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/prices") {
    const body = await readBody(request);
    if (!body.procedureName) return sendError(response, "procedureName is required");

    const procedureAmountCents = Number(body.procedureAmountCents || 0);
    const materialAmountCents = Number(body.materialAmountCents || 0);
    const copayAmountCents = Number(body.copayAmountCents || 0);
    const discountAmountCents = Number(body.discountAmountCents || 0);
    const totalAmountCents = Math.max(0, procedureAmountCents + materialAmountCents + copayAmountCents - discountAmountCents);
    const price = create("price_rules", {
      id: id("price"),
      clinicId: clinicId(request),
      branchName: optional(body.branchName) ?? "Matriz",
      insuranceName: optional(body.insuranceName) ?? "Particular",
      planName: optional(body.planName),
      procedureName: String(body.procedureName),
      procedureAmountCents,
      materialAmountCents,
      discountAmountCents,
      copayAmountCents,
      totalAmountCents,
      effectiveDate: optional(body.effectiveDate) ?? new Date().toISOString().slice(0, 10),
      status: optional(body.status) ?? "active",
      createdAt: new Date().toISOString()
    });
    sendJson(response, 201, { data: price });
    return;
  }

  const priceStatusMatch = url.pathname.match(/^\/v1\/prices\/([^/]+)\/status$/);
  if (method === "PATCH" && priceStatusMatch) {
    const price = get("price_rules", priceStatusMatch[1]);
    if (!price) return sendJson(response, 404, { error: { code: "not_found", message: "Price rule not found" } });

    const body = await readBody(request);
    const allowedStatuses = new Set(["active", "inactive"]);
    const nextStatus = String(body.status ?? "");
    if (!allowedStatuses.has(nextStatus)) return sendError(response, "Invalid price status");

    const updated = create("price_rules", {
      ...price,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
    sendJson(response, 200, { data: updated });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/relationship/calls") {
    sendJson(response, 200, { data: list("relationship_calls") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/relationship/calls/simulate") {
    const body = await readBody(request);
    const call = simulateRelationshipCall(body);
    create("relationship_calls", call);
    sendJson(response, 201, { data: call });
    return;
  }

  if (await routeModules.handleRoute({ request, response, url, method, currentUser })) {
    return;
  }

  if (method === "GET" && url.pathname === "/v1/patients") {
    sendJson(response, 200, { data: list("patients") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/patients") {
    const body = await readBody(request);
    if (!body.fullName) return sendError(response, "fullName is required");
    const patient = create("patients", {
      id: id("pat"),
      clinicId: clinicId(request),
      fullName: String(body.fullName),
      documentNumber: optional(body.documentNumber),
      birthDate: optional(body.birthDate),
      sex: optional(body.sex),
      phone: optional(body.phone),
      email: optional(body.email),
      guardianName: optional(body.guardianName),
      address: optional(body.address),
      lgpdConsentStatus: optional(body.lgpdConsentStatus) ?? "pending",
      createdAt: new Date().toISOString()
    });
    sendJson(response, 201, { data: patient });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/invoices") {
    sendJson(response, 200, { data: list("invoices") });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/batches") {
    sendJson(response, 200, { data: list("billing_batches") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/batches") {
    requirePermission(response, currentUser, "billing_batches");
    if (response.writableEnded) return;

    const body = await readBody(request);
    const now = new Date().toISOString();
    const invoices = list("invoices").filter((invoice) => (
      invoice.payerType === "insurance"
      && !invoice.batchId
      && !["paid", "cancelled"].includes(invoice.status)
    ));
    const totalAmountCents = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmountCents ?? 0), 0);
    const batch = create("billing_batches", {
      id: id("lot"),
      clinicId: clinicId(request),
      title: optional(body.title) ?? `Lote convenio ${new Date().toLocaleDateString("pt-BR")}`,
      insuranceName: optional(body.insuranceName) ?? "Convenios",
      invoiceCount: invoices.length,
      totalAmountCents,
      status: invoices.length ? "submitted" : "empty",
      submittedAt: now,
      createdAt: now
    });

    for (const invoice of invoices) {
      create("invoices", {
        ...invoice,
        batchId: batch.id,
        status: "submitted",
        submittedAt: now,
        updatedAt: now
      });
    }

    sendJson(response, 201, { data: batch });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/denials") {
    sendJson(response, 200, { data: list("billing_denials") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/denials") {
    requirePermission(response, currentUser, "denial_management");
    if (response.writableEnded) return;

    const body = await readBody(request);
    const invoice = get("invoices", String(body.invoiceId));
    if (!invoice) {
      sendError(response, 404, "Invoice not found");
      return;
    }

    const now = new Date().toISOString();
    const deniedAmountCents = Math.min(Number(body.deniedAmountCents || 0), Number(invoice.totalAmountCents || 0));
    const denial = create("billing_denials", {
      id: id("denial"),
      clinicId: clinicId(request),
      invoiceId: invoice.id,
      reason: optional(body.reason) ?? "Analise de glosa",
      deniedAmountCents,
      status: optional(body.status) ?? "open",
      actionPlan: optional(body.actionPlan) ?? "Revisar documentacao e reenviar recurso.",
      createdAt: now
    });

    create("invoices", {
      ...invoice,
      status: deniedAmountCents > 0 ? "denied" : invoice.status,
      deniedAmountCents: Number(invoice.deniedAmountCents || 0) + deniedAmountCents,
      updatedAt: now
    });

    createFinancialEntry(request, {
      direction: "payable",
      description: `Glosa - ${denial.reason}`,
      amountCents: deniedAmountCents,
      status: "open",
      source: "billing_denial",
      sourceId: denial.id,
      invoiceId: invoice.id,
      automationRule: "billing_denial"
    });

    sendJson(response, 201, { data: denial });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/payouts") {
    sendJson(response, 200, { data: list("doctor_payouts") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/payouts") {
    requirePermission(response, currentUser, "billing_batches");
    if (response.writableEnded) return;

    const body = await readBody(request);
    const now = new Date().toISOString();
    const rate = Math.max(0, Math.min(100, Number(body.ratePercent || 30)));
    const paidInvoiceIds = new Set(list("doctor_payouts").flatMap((payout) => payout.invoiceIds ?? []));
    const invoices = list("invoices").filter((invoice) => (
      !paidInvoiceIds.has(invoice.id)
      && ["draft", "submitted", "paid", "denied"].includes(invoice.status)
    ));
    const totalBaseCents = invoices.reduce((sum, invoice) => {
      const net = Number(invoice.totalAmountCents || 0) - Number(invoice.deniedAmountCents || 0);
      return sum + Math.max(0, net);
    }, 0);
    const payout = create("doctor_payouts", {
      id: id("payout"),
      clinicId: clinicId(request),
      doctorName: optional(body.doctorName) ?? "Corpo clinico",
      period: optional(body.period) ?? new Date().toISOString().slice(0, 7),
      ratePercent: rate,
      invoiceCount: invoices.length,
      invoiceIds: invoices.map((invoice) => invoice.id),
      totalBaseCents,
      payoutAmountCents: Math.round(totalBaseCents * (rate / 100)),
      status: "calculated",
      createdAt: now
    });

    createFinancialEntry(request, {
      direction: "payable",
      description: `Repasse medico - ${payout.doctorName} - ${payout.period}`,
      amountCents: payout.payoutAmountCents,
      status: "open",
      source: "doctor_payout",
      sourceId: payout.id,
      automationRule: "doctor_payout"
    });

    sendJson(response, 201, { data: payout });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/invoices") {
    const body = await readBody(request);
    const invoice = create("invoices", {
      id: id("inv"),
      clinicId: clinicId(request),
      patientId: String(body.patientId),
      appointmentId: optional(body.appointmentId),
      payerType: body.payerType === "insurance" ? "insurance" : "private",
      status: "draft",
      totalAmountCents: Number(body.totalAmountCents),
      createdAt: new Date().toISOString()
    });

    createFinancialEntry(request, {
      direction: "receivable",
      description: `Fatura ${invoice.payerType === "insurance" ? "convenio" : "particular"} - ${invoice.id}`,
      amountCents: invoice.totalAmountCents,
      status: "open",
      source: "invoice",
      sourceId: invoice.id,
      invoiceId: invoice.id,
      automationRule: invoice.payerType === "insurance" ? "insurance_invoice" : "private_invoice"
    });

    sendJson(response, 201, { data: invoice });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/finance/entries") {
    sendJson(response, 200, { data: list("financial_entries") });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/finance/entries") {
    const body = await readBody(request);
    const entry = createFinancialEntry(request, {
      direction: body.direction === "payable" ? "payable" : "receivable",
      category: optional(body.category) ?? "manual",
      description: String(body.description),
      amountCents: Number(body.amountCents),
      dueDate: String(body.dueDate),
      status: optional(body.status) ?? "open",
      source: optional(body.origin) ?? optional(body.source) ?? "manual",
      costCenter: optional(body.costCenter),
      cashAccount: optional(body.cashAccount),
      paymentMethod: optional(body.paymentMethod),
      competenceMonth: optional(body.competenceMonth),
      notes: optional(body.notes),
      reconciliationStatus: optional(body.reconciliationStatus) ?? "pending"
    });
    sendJson(response, 201, { data: entry });
    return;
  }

  const financeReconciliationMatch = url.pathname.match(/^\/v1\/finance\/entries\/([^/]+)\/reconciliation$/);
  if (method === "PATCH" && financeReconciliationMatch) {
    requirePermission(response, currentUser, "financial_reconciliation");
    if (response.writableEnded) return;

    const entry = get("financial_entries", financeReconciliationMatch[1]);
    if (!entry) {
      sendError(response, 404, "Financial entry not found");
      return;
    }

    const body = await readBody(request);
    const requestedStatus = optional(body.reconciliationStatus) ?? optional(body.status) ?? "reconciled";
    const reconciliationStatus = ["pending", "reconciled", "divergent"].includes(requestedStatus)
      ? requestedStatus
      : "pending";
    const now = new Date().toISOString();
    const updated = create("financial_entries", {
      ...entry,
      reconciliationStatus,
      reconciliationNotes: optional(body.reconciliationNotes) ?? entry.reconciliationNotes,
      reconciledAt: reconciliationStatus === "reconciled" ? now : entry.reconciledAt,
      reconciliationUpdatedAt: now,
      updatedAt: now
    });

    sendJson(response, 200, { data: updated });
    return;
  }

  const financeStatusMatch = url.pathname.match(/^\/v1\/finance\/entries\/([^/]+)\/status$/);
  if (method === "PATCH" && financeStatusMatch) {
    const entry = get("financial_entries", financeStatusMatch[1]);
    if (!entry) {
      sendError(response, 404, "Financial entry not found");
      return;
    }

    const body = await readBody(request);
    const status = optional(body.status) ?? "paid";
    const now = new Date().toISOString();
    const updated = create("financial_entries", {
      ...entry,
      status,
      paidAt: status === "paid" ? now : entry.paidAt,
      updatedAt: now
    });

    if (entry.invoiceId) {
      const invoice = get("invoices", entry.invoiceId);
      if (invoice && entry.direction === "receivable" && status === "paid") {
        create("invoices", { ...invoice, status: "paid", paidAt: now, updatedAt: now });
      }
    }

    sendJson(response, 200, { data: updated });
    return;
  }

  serveStatic(url, response);
});

globalThis.clinicServerRuntime = server;

server.listen(port, "0.0.0.0", () => {
  console.log(`Clinic Automation running on http://localhost:${port}`);
});

function serveStatic(url, response) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(webRoot, requestedPath));

  if (!filePath.startsWith(webRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
    ...securityHeaders()
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(), ...securityHeaders() });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusOrMessage, maybeMessage) {
  const statusCode = typeof statusOrMessage === "number" ? statusOrMessage : 400;
  const message = typeof statusOrMessage === "number" ? maybeMessage : statusOrMessage;
  const code = statusCode === 401 ? "unauthorized" : statusCode === 403 ? "forbidden" : statusCode === 404 ? "not_found" : "bad_request";
  sendJson(response, statusCode, { error: { code, message } });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Clinic-Id, Authorization, X-URA-Secret",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  };
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function clinicId(request) {
  const value = request.headers["x-clinic-id"];
  return typeof value === "string" && value ? value : "clinic_demo";
}

function optional(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash = "") {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim();
}

function authenticateRequest(request) {
  const token = bearerToken(request);
  if (!token) return undefined;

  const session = list("sessions").find((item) => (
    item.token === token
    && item.status === "active"
    && new Date(item.expiresAt).getTime() > Date.now()
  ));
  if (!session) return undefined;

  const user = get("users", session.userId);
  return user?.status === "active" ? user : undefined;
}

function systemUser(name = "Sistema") {
  return {
    id: "system",
    clinicId: "clinic_demo",
    name,
    role: "system",
    modules: ["all"],
    permissions: []
  };
}

function createSession(user, request) {
  const now = new Date();
  const session = {
    id: id("ses"),
    clinicId: user.clinicId ?? clinicId(request),
    userId: user.id,
    token: randomBytes(32).toString("hex"),
    status: "active",
    userAgent: String(request.headers["user-agent"] ?? "unknown").slice(0, 180),
    ipAddress: String(request.socket.remoteAddress ?? "local"),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString()
  };
  return create("sessions", session);
}

function publicUser(user) {
  if (!user) return undefined;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeRole(role) {
  const allowed = ["admin", "manager", "doctor", "billing", "frontdesk", "viewer"];
  return allowed.includes(String(role)) ? String(role) : "viewer";
}

function normalizeModules(value) {
  return normalizeList(value);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function userGroupByName(value) {
  const name = String(value ?? "").trim();
  if (!name) return undefined;
  return list("registry_user_groups").find((group) => (
    String(group.name ?? "").trim().toLowerCase() === name.toLowerCase()
  ));
}

function systemNavigationOverrides() {
  return list("system_navigation_overrides")
    .sort((a, b) => String(a.route).localeCompare(String(b.route)));
}

function updateSystemNavigationOverride(route, body, request, user) {
  const current = get("system_navigation_overrides", route) ?? {};
  const allowedStatuses = new Set(["active", "inactive"]);
  const status = allowedStatuses.has(String(body.status ?? "")) ? String(body.status) : current.status ?? "active";
  const parsedOrder = Number(body.order);
  const order = Number.isFinite(parsedOrder) ? parsedOrder : Number(current.order ?? 0);
  const permission = optional(body.permission) ?? "";
  const now = new Date().toISOString();
  const override = create("system_navigation_overrides", {
    ...current,
    id: route,
    route,
    status,
    order,
    permission,
    updatedBy: user.id,
    updatedByName: user.name,
    updatedAt: now,
    createdAt: current.createdAt ?? now,
    clinicId: clinicId(request)
  });
  logAudit(request, {
    user,
    action: "settings.navigation_override_updated",
    resource: "system_navigation_overrides",
    resourceId: route,
    details: { status, order, permission }
  });
  return override;
}

function canAccessModule(user, moduleName) {
  if (!user) return false;
  if (user.role === "admin" || (user.modules ?? []).includes("all")) return true;
  return (user.modules ?? []).includes(moduleName);
}

function moduleForPath(pathname) {
  const rules = [
    ["/v1/patients", "patients"],
    ["/v1/appointments", "appointments"],
    ["/v1/totem", "front-desk"],
    ["/v1/worklist", "worklist"],
    ["/v1/pacs", "pacs"],
    ["/v1/laboratory", "laboratory"],
    ["/v1/reports", "laudos"],
    ["/v1/deliveries", "relationship"],
    ["/v1/supplies", "supplies"],
    ["/v1/prices", "prices"],
    ["/v1/billing", "billing"],
    ["/v1/finance", "finance"],
    ["/v1/relationship", "relationship"],
    ["/v1/agents", "agents"],
    ["/v1/settings", "settings"],
    ["/v1/registries", "settings"],
    ["/v1/security", "security"],
    ["/v1/lgpd", "security"]
  ];
  return rules.find(([prefix]) => pathname.startsWith(prefix))?.[1];
}

function requireRole(response, user, allowedRoles) {
  if (!user || !allowedRoles.includes(user.role)) {
    sendError(response, 403, "Usuario sem permissao para esta acao");
  }
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === "admin" || (user.modules ?? []).includes("all")) return true;
  return (user.permissions ?? []).includes(permission);
}

function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

function requirePermission(response, user, permission) {
  if (!hasPermission(user, permission)) {
    sendError(response, 403, `Permissao operacional necessaria: ${permission}`);
  }
}

function requireAnyPermission(response, user, permissions) {
  if (!hasAnyPermission(user, permissions)) {
    sendError(response, 403, `Permissao operacional necessaria: ${permissions.join(" ou ")}`);
  }
}

function logAudit(request, event) {
  const user = event.user ?? { id: "anonymous", name: "Anonymous", role: "public" };
  return create("audit_events", {
    id: id("aud"),
    clinicId: user.clinicId ?? clinicId(request),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId,
    details: event.details ?? {},
    ipAddress: String(request.socket.remoteAddress ?? "local"),
    createdAt: new Date().toISOString()
  });
}

function createBackup(request, user, trigger = "manual") {
  mkdirSync(backupsRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `clinic-${stamp}.sqlite`;
  const backupPath = join(backupsRoot, fileName);
  copyFileSync(databasePath, backupPath);
  const sizeBytes = statSync(backupPath).size;
  const backup = create("backups", {
    id: id("bak"),
    clinicId: clinicId(request),
    fileName,
    path: backupPath,
    sizeBytes,
    status: "completed",
    trigger,
    createdBy: user.id,
    createdAt: new Date().toISOString()
  });
  logAudit(request, { user, action: "security.backup_created", resource: "backups", resourceId: backup.id });
  return backup;
}

function getBackupPolicy() {
  const policy = get("backup_policies", "backup_policy_default");
  if (policy) return policy;

  const now = new Date();
  return create("backup_policies", {
    id: "backup_policy_default",
    clinicId: "clinic_demo",
    enabled: true,
    intervalHours: 24,
    retainLast: 14,
    nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString()
  });
}

function applyBackupRetention() {
  const policy = getBackupPolicy();
  const backups = list("backups")
    .filter((backup) => backup.status === "completed")
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const staleBackups = backups.slice(Number(policy.retainLast ?? 14));

  for (const backup of staleBackups) {
    if (backup.path && existsSync(backup.path)) unlinkSync(backup.path);
    remove("backups", backup.id);
  }
}

function runDueBackup() {
  const policy = getBackupPolicy();
  if (!policy.enabled || new Date(policy.nextRunAt).getTime() > Date.now()) return;

  const systemRequest = { headers: { "x-clinic-id": "clinic_demo" }, socket: { remoteAddress: "system" } };
  const systemUser = { id: "system", name: "Sistema", role: "admin", clinicId: "clinic_demo" };
  createBackup(systemRequest, systemUser, "automatic");
  applyBackupRetention();

  const intervalMs = Math.max(1, Number(policy.intervalHours ?? 24)) * 60 * 60 * 1000;
  create("backup_policies", {
    ...policy,
    lastRunAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createFinancialEntry(request, entry) {
  const defaults = automaticFinancialDefaults(entry);
  return create("financial_entries", {
    id: entry.id ?? id("fin"),
    clinicId: clinicId(request),
    direction: entry.direction === "payable" ? "payable" : "receivable",
    category: entry.category ?? defaults.category ?? "manual",
    description: String(entry.description),
    amountCents: Number(entry.amountCents || 0),
    dueDate: String(entry.dueDate ?? dateAfterDays(defaults.dueDays ?? 0)),
    status: entry.status ?? "open",
    source: entry.source,
    sourceId: entry.sourceId,
    invoiceId: entry.invoiceId,
    costCenter: entry.costCenter ?? defaults.costCenter,
    cashAccount: entry.cashAccount ?? defaults.cashAccount,
    paymentMethod: entry.paymentMethod ?? defaults.paymentMethod,
    competenceMonth: entry.competenceMonth,
    notes: entry.notes,
    automationRule: entry.automationRule,
    reconciliationStatus: entry.reconciliationStatus ?? "pending",
    reconciliationNotes: entry.reconciliationNotes,
    reconciledAt: entry.reconciledAt,
    reconciliationUpdatedAt: entry.reconciliationUpdatedAt,
    createdAt: entry.createdAt ?? new Date().toISOString()
  });
}

function automaticFinancialDefaults(entry) {
  const rule = entry.automationRule ?? entry.source ?? "manual";
  const isReceivable = entry.direction !== "payable";
  const configuredRule = configuredFinancialRule(rule === "manual" ? (isReceivable ? "manual_receivable" : "manual_payable") : rule);
  if (configuredRule) return configuredRule;

  if (rule === "insurance_invoice") {
    return {
      category: registryName("registry_financial_categories", ["Fatura convenio", "Fatura convênio"], (row) => row.direction === "receivable"),
      costCenter: registryName("registry_cost_centers", ["Faturamento"]),
      cashAccount: registryName("registry_accounts", ["Banco convenios", "Banco convênios", "Conta principal"]),
      paymentMethod: registryName("registry_payment_methods", ["Convenio", "Convênio"])
    };
  }

  if (rule === "private_invoice") {
    return {
      category: registryName("registry_financial_categories", ["Recebimento particular"], (row) => row.direction === "receivable"),
      costCenter: registryName("registry_cost_centers", ["Atendimento"]),
      cashAccount: registryName("registry_accounts", ["Conta principal", "Caixa recepcao", "Caixa recepção"]),
      paymentMethod: registryName("registry_payment_methods", ["PIX", "Dinheiro"])
    };
  }

  if (rule === "billing_denial") {
    return {
      category: registryName("registry_financial_categories", ["Glosa"], (row) => row.direction === "payable"),
      costCenter: registryName("registry_cost_centers", ["Faturamento"]),
      cashAccount: registryName("registry_accounts", ["Conta principal"]),
      paymentMethod: registryName("registry_payment_methods", ["Convenio", "Convênio"])
    };
  }

  if (rule === "doctor_payout") {
    return {
      category: registryName("registry_financial_categories", ["Repasse medico", "Repasse médico"], (row) => row.direction === "payable"),
      costCenter: registryName("registry_cost_centers", ["Corpo clinico", "Corpo clínico", "Diagnostico por Imagem"]),
      cashAccount: registryName("registry_accounts", ["Conta principal"]),
      paymentMethod: registryName("registry_payment_methods", ["Transferencia", "Transferência", "PIX"])
    };
  }

  return {
    category: registryName("registry_financial_categories", isReceivable ? ["Recebimento particular"] : ["Materiais e suprimentos"], (row) => row.direction === (isReceivable ? "receivable" : "payable") || row.direction === "both"),
    costCenter: registryName("registry_cost_centers", isReceivable ? ["Atendimento"] : ["Administracao", "Administração"]),
    cashAccount: registryName("registry_accounts", ["Conta principal"]),
    paymentMethod: registryName("registry_payment_methods", isReceivable ? ["PIX"] : ["Transferencia", "Transferência", "PIX"])
  };
}

function registryName(collection, preferredNames = [], predicate = () => true) {
  const rows = list(collection).filter((row) => (row.status ?? "active") !== "inactive");
  const names = preferredNames.map(normalizeText);
  const exact = rows.find((row) => names.includes(normalizeText(row.name)) && predicate(row));
  const fallback = rows.find(predicate) ?? rows[0];
  return exact?.name ?? fallback?.name ?? preferredNames[0];
}

function configuredFinancialRule(trigger) {
  const rule = list("registry_financial_rules").find((row) => (
    (row.status ?? "active") !== "inactive"
    && normalizeText(row.trigger) === normalizeText(trigger)
  ));
  if (!rule) return null;
  return {
    category: rule.category,
    costCenter: rule.costCenter,
    cashAccount: rule.cashAccount,
    paymentMethod: rule.paymentMethod,
    dueDays: Number(rule.dueDays || 0)
  };
}

function dateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function publicPatientExport(patient) {
  return {
    id: patient.id,
    fullName: patient.fullName,
    documentNumber: patient.documentNumber,
    birthDate: patient.birthDate,
    phone: patient.phone,
    email: patient.email,
    lgpdConsentStatus: patient.lgpdConsentStatus,
    lgpdConsentAt: patient.lgpdConsentAt,
    appointments: list("appointments").filter((appointment) => appointment.patientId === patient.id),
    invoices: list("invoices").filter((invoice) => invoice.patientId === patient.id),
    consents: list("lgpd_consents").filter((consent) => consent.patientId === patient.id)
  };
}

function buildLaboratorySample(order, createdAt) {
  return {
    id: `sample_${order.id}`,
    clinicId: order.clinicId,
    orderId: order.id,
    appointmentId: order.appointmentId,
    patientId: order.patientId,
    patientName: order.patientName,
    material: order.material,
    tube: inferLaboratoryTube(order.material),
    barcode: `LAB-${String(order.id).replace(/^lab_/, "").slice(0, 8).toUpperCase()}`,
    status: laboratorySampleStatus(order.status),
    createdAt
  };
}

function laboratorySampleStatus(orderStatus) {
  const statuses = {
    ordered: "pending_collection",
    collected: "collected",
    processing: "in_analysis",
    validated: "validated",
    released: "released"
  };
  return statuses[orderStatus] ?? "pending_collection";
}

function inferLaboratoryTube(material = "") {
  const text = normalizeText(material);
  if (text.includes("soro")) return "Tubo seco";
  if (text.includes("urina")) return "Coletor universal";
  if (text.includes("plasma")) return "Tubo citrato";
  return "Tubo EDTA";
}

function inferLaboratoryMaterial(examName = "") {
  const text = normalizeText(examName);
  if (text.includes("urina")) return "Urina";
  if (text.includes("glicemia") || text.includes("colesterol") || text.includes("creatinina") || text.includes("vitamina") || text.includes("tsh")) return "Soro";
  if (text.includes("coagul") || text.includes("tap") || text.includes("ttpa")) return "Plasma citratado";
  return "Sangue total";
}

function productionReadiness() {
  const checks = [
    { id: "auth", label: "Login e sessoes", status: list("users").length ? "ready" : "missing" },
    { id: "roles", label: "Perfis de acesso", status: list("users").some((user) => user.role === "admin") ? "ready" : "missing" },
    { id: "audit", label: "Auditoria", status: "ready" },
    { id: "backup", label: "Backup local", status: existsSync(backupsRoot) && list("backups").length ? "ready" : "attention" },
    { id: "database", label: "Banco local SQLite", status: "homologation" },
    { id: "lgpd", label: "LGPD e consentimentos", status: list("lgpd_consents").length ? "ready" : "attention" },
    { id: "dicom", label: "PACS/DICOM real", status: "attention" },
    { id: "integrations", label: "WhatsApp, fiscal e telefonia real", status: "attention" }
  ];

  return {
    stage: checks.every((check) => check.status === "ready") ? "production" : "homologation",
    checks,
    generatedAt: new Date().toISOString()
  };
}

function deploymentReadiness() {
  const checks = [
    { id: "env", label: "Ambiente definido", status: appEnv === "production" ? "ready" : "attention", detail: `APP_ENV=${appEnv}` },
    { id: "port", label: "Porta configurada", status: port > 0 ? "ready" : "missing", detail: `PORT=${port}` },
    { id: "public-url", label: "URL publica", status: publicBaseUrl.startsWith("https://") ? "ready" : "attention", detail: publicBaseUrl },
    { id: "database-path", label: "Banco configurado", status: existsSync(dirname(databasePath)) ? "ready" : "missing", detail: databasePath },
    { id: "backup-path", label: "Pasta de backup", status: existsSync(backupsRoot) || list("backups").length > 0 ? "ready" : "attention", detail: backupsRoot },
    { id: "auth", label: "Autenticacao", status: list("users").length ? "ready" : "missing", detail: `${list("users").length} usuario(s)` },
    { id: "audit", label: "Auditoria", status: list("audit_events").length ? "ready" : "attention", detail: `${list("audit_events").length} evento(s)` },
    { id: "lgpd", label: "Consentimentos LGPD", status: list("lgpd_consents").length ? "ready" : "attention", detail: `${list("lgpd_consents").length} consentimento(s)` },
    { id: "external-db", label: "PostgreSQL futuro", status: "planned", detail: "Recomendado antes de multiunidade/multiusuario pesado" },
    { id: "https", label: "HTTPS/reverse proxy", status: publicBaseUrl.startsWith("https://") ? "ready" : "planned", detail: "Usar IIS, Nginx, Caddy ou proxy corporativo" }
  ];

  return {
    environment: appEnv,
    publicBaseUrl,
    port,
    databasePath,
    backupsRoot,
    stage: checks.some((check) => ["missing"].includes(check.status)) ? "blocked" : appEnv === "production" ? "server-ready" : "local-ready",
    checks,
    generatedAt: new Date().toISOString()
  };
}

function buildWorklistOrders() {
  const publications = new Map(list("worklist_publications").map((publication) => [publication.appointmentId, publication]));
  return list("appointments")
    .filter((appointment) => !["cancelled", "no_show"].includes(appointment.status))
    .map((appointment) => buildWorklistOrder(appointment, publications.get(appointment.id)));
}

function buildWorklistOrder(appointment, publication) {
  const patient = get("patients", appointment.patientId);
  const modality = inferModality(appointment.procedureName, appointment.roomName);
  const accessionNumber = appointment.accessionNumber ?? `ACC-${String(appointment.id).replace(/^apt_/, "").slice(0, 8).toUpperCase()}`;

  return {
    id: appointment.id,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    patientName: patient?.fullName ?? appointment.patientName ?? "Paciente nao identificado",
    accessionNumber,
    modality,
    procedureName: appointment.procedureName ?? "Consulta",
    requestedProcedureId: `RP-${accessionNumber}`,
    scheduledStationAETitle: publication?.aeTitle ?? inferAeTitle(appointment.roomName, appointment.procedureName),
    roomName: appointment.roomName ?? "Sala 01",
    branchName: appointment.branchName ?? "Matriz",
    unitName: appointment.unitName ?? "Unidade principal",
    insuranceName: appointment.insuranceName ?? "Particular",
    professionalName: appointment.professionalId,
    startsAt: appointment.startsAt,
    appointmentStatus: appointment.status,
    mwlStatus: publication?.status ?? "pending_publication",
    publishedAt: publication?.publishedAt,
    studyInstanceUid: `2.25.${hashDigits(appointment.id)}`
  };
}

function buildClinicalReports() {
  const reports = new Map(list("clinical_reports").map((report) => [report.studyId, report]));
  return list("pacs_studies")
    .filter((study) => study.reconciliationStatus === "matched")
    .map((study) => mergeClinicalReport(study, reports.get(study.id)));
}

function buildResultDeliveries() {
  const savedDeliveries = new Map(list("result_deliveries").map((delivery) => [delivery.reportId, delivery]));
  return buildClinicalReports()
    .filter((report) => report.status === "signed")
    .map((report) => mergeResultDelivery(report, savedDeliveries.get(report.id)));
}

function mergeResultDelivery(report, delivery) {
  const fallbackPortalLink = `/portal/results/${encodeURIComponent(report.accessionNumber)}`;
  return {
    id: delivery?.id ?? `del_${report.id}`,
    reportId: report.id,
    report,
    patientId: report.patientId,
    patientName: report.patientName,
    accessionNumber: report.accessionNumber,
    procedureName: report.procedureName,
    modality: report.modality,
    signedAt: report.signedAt,
    status: delivery?.status ?? "ready",
    channel: delivery?.channel ?? "pending",
    portalLink: delivery?.portalLink ?? fallbackPortalLink,
    auditTrail: delivery?.auditTrail ?? [],
    updatedAt: delivery?.updatedAt
  };
}

function mergeClinicalReport(study, report) {
  const appointment = study.matchedAppointmentId ? get("appointments", study.matchedAppointmentId) : undefined;
  return {
    id: report?.id ?? `rep_${study.id}`,
    studyId: study.id,
    appointmentId: study.matchedAppointmentId,
    accessionNumber: study.accessionNumber,
    patientId: study.matchedPatientId ?? study.patientId,
    patientName: study.matchedPatientName ?? study.patientName,
    procedureName: study.matchedProcedureName ?? study.studyDescription,
    modality: study.modality,
    roomName: study.matchedRoomName,
    professionalName: appointment?.professionalId ?? "Medico responsavel",
    imageStatus: study.reconciliationStatus,
    status: report?.status ?? "awaiting_report",
    reportText: report?.reportText ?? "",
    studyInstanceUid: study.studyInstanceUid,
    viewerUrl: study.viewerUrl,
    createdAt: report?.createdAt,
    reviewedAt: report?.reviewedAt,
    signedAt: report?.signedAt,
    updatedAt: report?.updatedAt,
    receivedAt: study.receivedAt
  };
}

function defaultReportText(study) {
  return [
    `${study.matchedProcedureName ?? study.studyDescription}.`,
    "",
    "Tecnica: exame realizado conforme protocolo do servico.",
    "",
    "Achados: descrever os achados relevantes.",
    "",
    "Conclusao: correlacionar com dados clinicos."
  ].join("\n");
}

function inferModality(procedureName = "", roomName = "") {
  const text = normalizeText(`${procedureName} ${roomName}`);
  if (text.includes("rm") || text.includes("ressonancia")) return "MR";
  if (text.includes("tc") || text.includes("tomografia")) return "CT";
  if (text.includes("us") || text.includes("ultra")) return "US";
  if (text.includes("mamografia") || text.includes("mamo")) return "MG";
  if (text.includes("rx") || text.includes("raio")) return "DX";
  return "OT";
}

function inferAeTitle(roomName = "", procedureName = "") {
  const modality = inferModality(procedureName, roomName);
  const roomSlug = normalizeText(roomName || modality).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return `${modality}_${roomSlug || "ROOM"}`;
}

function hashDigits(value) {
  let hash = 0;
  for (const character of String(value)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return String(hash).padStart(10, "0");
}

function sanitizeRegistryPayload(definition, body) {
  return Object.fromEntries(
    definition.fields
      .map((field) => {
        const rawValue = body[field.name];
        const value = field.type === "number" ? Number(rawValue) : optional(rawValue);
        if (field.type === "number" && Number.isNaN(value)) return [field.name, undefined];
        if ((field.name === "status" || field.name === "active") && !value) return [field.name, "active"];
        return [field.name, value];
      })
      .filter(([, value]) => value !== undefined)
  );
}

function seedRegistryData() {
  const seeds = [
    ["registry_branches", { id: "reg_branch_main", type: "branches", name: "Clinica Radiologica de Goiania", branchType: "Matriz", neighborhood: "Centro", status: "active" }],
    ["registry_units", { id: "reg_unit_main", type: "units", name: "Unidade Principal", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_rooms", { id: "reg_room_mr01", type: "rooms", name: "Sala RM 01", equipment: "Ressonancia 1.5T", branch: "Clinica Radiologica de Goiania", modality: "MR", status: "active" }],
    ["registry_rooms", { id: "reg_room_ct01", type: "rooms", name: "Sala TC 01", equipment: "Tomografia Multislice", branch: "Clinica Radiologica de Goiania", modality: "CT", status: "active" }],
    ["registry_rooms", { id: "reg_room_lab01", type: "rooms", name: "Coleta Laboratorio", equipment: "Sala de coleta", branch: "Clinica Radiologica de Goiania", modality: "LAB", status: "active" }],
    ["registry_insurances", { id: "reg_ins_private", type: "insurances", name: "Particular", guideType: "Particular", guideRequired: "Nao", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_insurances", { id: "reg_ins_demo", type: "insurances", name: "Convenio Demo", guideType: "SADT", guideRequired: "Sim", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_plans", { id: "reg_plan_standard", type: "plans", name: "Plano Padrao", insurance: "Convenio Demo", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_procedure_categories", { id: "reg_proc_cat_image", type: "procedure-categories", name: "Diagnostico por Imagem", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_procedures", { id: "reg_proc_mr_brain", type: "procedures", name: "RM Cranio", modality: "MR", duration: "30 min", keywords: "cranio, encefalo, ressonancia", preparation: "Retirar objetos metalicos e confirmar ausencia de marcapasso/implantes.", status: "active" }],
    ["registry_procedures", { id: "reg_proc_ct_chest", type: "procedures", name: "TC Torax", modality: "CT", duration: "20 min", keywords: "torax, tomografia", preparation: "Chegar 20 minutos antes. Conferir necessidade de contraste e jejum conforme pedido.", status: "active" }],
    ["registry_procedures", { id: "reg_proc_hemogram", type: "procedures", name: "Hemograma completo", modality: "LAB", duration: "10 min", keywords: "hemograma, sangue, laboratorio", preparation: "Coleta de sangue conforme orientacao da recepcao.", status: "active" }],
    ["registry_doctors", { id: "reg_doc_demo", type: "doctors", name: "Dra. Ana Martins", nickname: "Dra. Ana", sex: "F", council: "CRM", councilNumber: "12345-GO", councilState: "GO", specialty: "Radiologia", birthDate: "1985-01-01", phone: "6233330000", mobile: "62999990000", email: "medico.demo@clinic.local", cpf: "000.000.000-00", rg: "0000000", issuingAgency: "SSP", zipCode: "74000-000", neighborhood: "Centro", address: "Endereco demo", branches: "Clinica Radiologica de Goiania", unit: "Unidade Principal", requester: "Sim", status: "active" }],
    ["registry_doctors", { id: "reg_doc_demo_full", type: "doctors", name: "Medico Demo Completo", nickname: "Demo", sex: "Outro", council: "CRM", councilNumber: "99999-GO", councilState: "GO", specialty: "Diagnostico por Imagem", birthDate: "1980-01-01", phone: "6233330000", mobile: "62999990000", email: "medico.completo@clinic.local", cpf: "000.000.000-00", rg: "0000000", issuingAgency: "SSP", zipCode: "74000-000", neighborhood: "Centro", address: "Endereco demo", branches: "Clinica Radiologica de Goiania", unit: "Unidade Principal", requester: "Sim", status: "active" }],
    ["registry_employees", { id: "reg_employee_demo", type: "employees", name: "Colaborador Demo", nickname: "Demo", sex: "Outro", birthDate: "1990-01-01", admissionDate: new Date().toISOString().slice(0, 10), cpf: "000.000.000-00", rg: "0000000", issuingAgency: "SSP", phone: "6233330000", mobile: "62999990000", email: "colaborador.demo@clinic.local", zipCode: "74000-000", neighborhood: "Centro", address: "Endereco demo", addressNumber: "100", addressComplement: "Sala", branches: "Clinica Radiologica de Goiania", unit: "Unidade Principal", role: "Atendimento", status: "active" }],
    ["registry_user_groups", { id: "reg_user_group_admin", type: "user-groups", name: "Administracao", branch: "Clinica Radiologica de Goiania", description: "Acesso completo a operacao e seguranca", modules: "all", permissions: "edit_privileges,cancel_attendance,cancel_executed_attendance,transfer_attendance,stock_access,purchase_access,manage_doctor_groups,manage_totem_groups", status: "active" }],
    ["registry_user_groups", { id: "reg_user_group_frontdesk", type: "user-groups", name: "Atendimento", branch: "Clinica Radiologica de Goiania", description: "Recepcao, agenda, pacientes e fluxo de atendimento", modules: "patients,appointments,front-desk,worklist", permissions: "restricted_hours_view,restricted_hours_schedule,cancel_attendance,transfer_attendance", status: "active" }],
    ["registry_user_groups", { id: "reg_user_group_billing", type: "user-groups", name: "Faturamento", branch: "Clinica Radiologica de Goiania", description: "Faturamento, guias, glosas e financeiro operacional", modules: "billing,finance,prices,reports", permissions: "billing_batches,denial_management,financial_reconciliation", status: "active" }],
    ["registry_user_groups", { id: "reg_user_group_lab", type: "user-groups", name: "Laboratorio", branch: "Clinica Radiologica de Goiania", description: "Pedidos, coletas, resultados e interfaces LIS", modules: "laboratory,worklist,reports", permissions: "lis_interface,support_lab_receive,release_results", status: "active" }],
    ["registry_integrations", { id: "reg_ext_orthanc", type: "external-systems", description: "Orthanc PACS local", branch: "Clinica Radiologica de Goiania", situation: "Homologacao", status: "active" }],
    ["registry_print_models", { id: "reg_print_report", type: "print-models", model: "Laudo Padrao", description: "Modelo principal para laudos", printType: "Laudo", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_situations", { id: "reg_sit_scheduled", type: "situations", name: "Agendado", branch: "Clinica Radiologica de Goiania", color: "Azul", status: "active" }],
    ["registry_services", { id: "reg_service_imaging", type: "services", name: "Exames de imagem", branch: "Clinica Radiologica de Goiania", queue: "Imagem", status: "active" }],
    ["registry_financial_categories", { id: "reg_fin_cat_invoice", type: "financial-categories", name: "Fatura convênio", direction: "receivable", chartAccount: "Receita operacional", status: "active" }],
    ["registry_financial_categories", { id: "reg_fin_cat_private", type: "financial-categories", name: "Recebimento particular", direction: "receivable", chartAccount: "Receita operacional", status: "active" }],
    ["registry_financial_categories", { id: "reg_fin_cat_payout", type: "financial-categories", name: "Repasse médico", direction: "payable", chartAccount: "Custo assistencial", status: "active" }],
    ["registry_financial_categories", { id: "reg_fin_cat_supplies", type: "financial-categories", name: "Materiais e suprimentos", direction: "payable", chartAccount: "Despesa operacional", status: "active" }],
    ["registry_financial_categories", { id: "reg_fin_cat_denial", type: "financial-categories", name: "Glosa", direction: "payable", chartAccount: "Ajuste de receita", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_insurance_invoice", type: "financial-rules", ruleName: "Fatura convênio", trigger: "insurance_invoice", category: "Fatura convênio", costCenter: "Faturamento", cashAccount: "Banco convenios", paymentMethod: "Convenio", dueDays: "30", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_private_invoice", type: "financial-rules", ruleName: "Fatura particular", trigger: "private_invoice", category: "Recebimento particular", costCenter: "Atendimento", cashAccount: "Conta principal", paymentMethod: "PIX", dueDays: "0", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_denial", type: "financial-rules", ruleName: "Glosa", trigger: "billing_denial", category: "Glosa", costCenter: "Faturamento", cashAccount: "Conta principal", paymentMethod: "Convenio", dueDays: "0", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_doctor_payout", type: "financial-rules", ruleName: "Repasse médico", trigger: "doctor_payout", category: "Repasse médico", costCenter: "Corpo clinico", cashAccount: "Conta principal", paymentMethod: "Transferencia", dueDays: "0", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_manual_receivable", type: "financial-rules", ruleName: "Manual a receber", trigger: "manual_receivable", category: "Recebimento particular", costCenter: "Atendimento", cashAccount: "Conta principal", paymentMethod: "PIX", dueDays: "0", status: "active" }],
    ["registry_financial_rules", { id: "reg_fin_rule_manual_payable", type: "financial-rules", ruleName: "Manual a pagar", trigger: "manual_payable", category: "Materiais e suprimentos", costCenter: "Administração", cashAccount: "Conta principal", paymentMethod: "Transferencia", dueDays: "0", status: "active" }],
    ["registry_accounts", { id: "reg_account_main", type: "accounts", name: "Conta principal", bank: "Banco Demo", status: "active" }],
    ["registry_accounts", { id: "reg_account_insurance", type: "accounts", name: "Banco convenios", bank: "Banco Demo", status: "active" }],
    ["registry_accounts", { id: "reg_account_cash", type: "accounts", name: "Caixa recepção", bank: "Caixa interno", status: "active" }],
    ["registry_accounts", { id: "reg_account_cards", type: "accounts", name: "Cartões", bank: "Adquirente", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_pix", type: "payment-methods", name: "PIX", settlementDays: "0", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_credit", type: "payment-methods", name: "Cartão de crédito", settlementDays: "30", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_debit", type: "payment-methods", name: "Cartão de débito", settlementDays: "1", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_boleto", type: "payment-methods", name: "Boleto", settlementDays: "2", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_insurance", type: "payment-methods", name: "Convenio", settlementDays: "30", status: "active" }],
    ["registry_payment_methods", { id: "reg_pay_transfer", type: "payment-methods", name: "Transferencia", settlementDays: "0", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_imaging", type: "cost-centers", name: "Diagnostico por Imagem", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_laboratory", type: "cost-centers", name: "Laboratório", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_frontdesk", type: "cost-centers", name: "Atendimento", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_billing", type: "cost-centers", name: "Faturamento", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_medical_staff", type: "cost-centers", name: "Corpo clinico", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_cost_centers", { id: "reg_cost_admin", type: "cost-centers", name: "Administração", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_origins", { id: "reg_origin_walkin", type: "origins", name: "Demanda espontanea", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_modalities", { id: "reg_mod_mr", type: "modalities", name: "Ressonancia Magnetica", dicomCode: "MR", status: "active" }],
    ["registry_price_tables", { id: "reg_price_private", type: "price-tables", name: "Tabela Particular", branch: "Clinica Radiologica de Goiania", insurance: "Particular", status: "active" }],
    ["registry_stocks", { id: "reg_stock_main", type: "stocks", name: "Almoxarifado Central", branch: "Clinica Radiologica de Goiania", status: "active" }],
    ["registry_security_policies", { id: "reg_sec_password", type: "security-policies", name: "Senha forte", value: "Obrigatoria", status: "active" }]
  ];

  for (const [collection, row] of seeds) {
    const existing = get(collection, row.id);
    if (!existing) {
      create(collection, row);
    } else if (collection === "registry_procedures" && row.preparation && !existing.preparation) {
      create(collection, { ...existing, preparation: row.preparation, updatedAt: new Date().toISOString() });
    }
  }
}

function seedOperationalData() {
  const totemQueues = [
    { id: "totem_queue_reception", clinicId: "clinic_demo", name: "Recepcao", prefix: "R", defaultPriority: "normal", priorityOrder: 1, status: "active", createdAt: new Date().toISOString() },
    { id: "totem_queue_exams", clinicId: "clinic_demo", name: "Exames", prefix: "E", defaultPriority: "normal", priorityOrder: 2, status: "active", createdAt: new Date().toISOString() },
    { id: "totem_queue_priority", clinicId: "clinic_demo", name: "Prioritario", prefix: "P", defaultPriority: "preferential", priorityOrder: 3, status: "active", createdAt: new Date().toISOString() }
  ];
  for (const queue of totemQueues) {
    if (!get("totem_queues", queue.id)) create("totem_queues", queue);
  }

  const totemCounters = [
    { id: "totem_counter_01", clinicId: "clinic_demo", name: "Guiche 01", location: "Recepcao", status: "active", createdAt: new Date().toISOString() },
    { id: "totem_counter_02", clinicId: "clinic_demo", name: "Guiche 02", location: "Recepcao", status: "active", createdAt: new Date().toISOString() },
    { id: "totem_counter_screening", clinicId: "clinic_demo", name: "Triagem", location: "Corredor exames", status: "active", createdAt: new Date().toISOString() }
  ];
  for (const counter of totemCounters) {
    if (!get("totem_counters", counter.id)) create("totem_counters", counter);
  }

  if (!get("totem_display_config", "totem_display_config")) {
    create("totem_display_config", {
      id: "totem_display_config",
      clinicId: "clinic_demo",
      contentTitle: "Conteudo institucional",
      contentUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      contentType: "online",
      layout: "media_left",
      createdAt: new Date().toISOString()
    });
  }

  if (!get("relationship_ura_config", "relationship_ura_config")) {
    create("relationship_ura_config", uraModule.defaultConfig());
  }

  if (!get("relationship_whatsapp_config", "relationship_whatsapp_config")) {
    create("relationship_whatsapp_config", defaultWhatsappConfig());
  }

  const whatsappFlows = defaultWhatsappFlows();
  for (const flow of whatsappFlows) {
    if (!get("relationship_whatsapp_flows", flow.id)) create("relationship_whatsapp_flows", flow);
  }
  const whatsappTemplates = defaultWhatsappTemplates();
  for (const template of whatsappTemplates) {
    if (!get("relationship_whatsapp_templates", template.id)) create("relationship_whatsapp_templates", template);
  }
  const whatsappAutonomyRules = defaultWhatsappAutonomyRules();
  for (const rule of whatsappAutonomyRules) {
    if (!get("relationship_whatsapp_autonomy_rules", rule.id)) create("relationship_whatsapp_autonomy_rules", rule);
  }
  const whatsappAutonomyProfiles = defaultWhatsappAutonomyProfiles();
  for (const profile of whatsappAutonomyProfiles) {
    if (!get("relationship_whatsapp_autonomy_profiles", profile.id)) create("relationship_whatsapp_autonomy_profiles", profile);
  }
  const whatsappJourneys = defaultWhatsappJourneys();
  for (const journey of whatsappJourneys) {
    const existingJourney = get("relationship_whatsapp_journeys", journey.id);
    if (!existingJourney) {
      create("relationship_whatsapp_journeys", journey);
    } else {
      create("relationship_whatsapp_journeys", { ...existingJourney, ...journey, createdAt: existingJourney.createdAt ?? journey.createdAt, updatedAt: new Date().toISOString() });
    }
  }
  const whatsappPrepRules = defaultWhatsappPrepRules();
  for (const prepRule of whatsappPrepRules) {
    if (!get("relationship_whatsapp_prep_rules", prepRule.id)) create("relationship_whatsapp_prep_rules", prepRule);
  }

  if (!get("relationship_ura_flows", "relationship_ura_flow_main")) {
    create("relationship_ura_flows", {
      id: "relationship_ura_flow_main",
      clinicId: "clinic_demo",
      name: "Fluxo principal de atendimento",
      greetingText: "Bem-vindo. Digite 1 para agendamento, 2 para resultados, 3 para financeiro ou 4 para falar com atendente.",
      timeoutSeconds: 8,
      maxRetries: 2,
      options: relationshipQueues.map((queue) => ({
        dtmf: queue.dtmf,
        label: queue.name,
        targetQueueId: queue.id,
        transferTarget: queue.transferTarget,
        message: `Direcionar para ${queue.name}`
      })),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const lisInterfaces = [
    { id: "lis_hem_demo", clinicId: "clinic_demo", equipmentName: "Analisador hematologia", equipmentCode: "HEM-01", protocol: "ASTM", connection: "TCP 10.0.0.20:5000", direction: "bidirectional", status: "active", createdAt: new Date().toISOString() },
    { id: "lis_bio_demo", clinicId: "clinic_demo", equipmentName: "Bioquímica automática", equipmentCode: "BIO-01", protocol: "HL7", connection: "Middleware LIS", direction: "results", status: "testing", createdAt: new Date().toISOString() }
  ];
  for (const item of lisInterfaces) {
    if (!get("laboratory_interfaces", item.id)) create("laboratory_interfaces", item);
  }

  const supportLabExams = [
    { id: "supportlab_demo_vitd", clinicId: "clinic_demo", supportLabName: "Apoio Diagnósticos", externalProtocol: "EXT-DEMO-001", patientName: "Paciente Demonstração", examName: "Vitamina D", material: "Soro", status: "received", resultText: "Resultado recebido do laboratório de apoio para conferência.", receivedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
  ];
  for (const item of supportLabExams) {
    if (!get("support_lab_exams", item.id)) create("support_lab_exams", item);
  }

  const supplies = [
    { id: "sup_contrast_demo", clinicId: "clinic_demo", item: "Contraste", stock: "Farmacia", unit: "Ressonancia", quantity: 4, status: "requested", dueDate: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() },
    { id: "sup_film_demo", clinicId: "clinic_demo", item: "Filme radiologico", stock: "Almoxarifado", unit: "Raio-X", quantity: 20, status: "quoted", dueDate: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() },
    { id: "sup_syringe_demo", clinicId: "clinic_demo", item: "Seringa descartavel", stock: "Central", unit: "USG", quantity: 100, status: "transferred", dueDate: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }
  ];

  for (const supply of supplies) {
    if (!get("supplies", supply.id)) create("supplies", supply);
  }

  const prices = [
    { id: "price_tc_torax_demo", clinicId: "clinic_demo", branchName: "Clinica Radiologica de Goiania", insuranceName: "Convenio Demo", planName: "Plano Padrao", procedureName: "TC Torax", procedureAmountCents: 35000, materialAmountCents: 0, discountAmountCents: 0, copayAmountCents: 0, totalAmountCents: 35000, effectiveDate: new Date().toISOString().slice(0, 10), status: "active", createdAt: new Date().toISOString() },
    { id: "price_rm_cranio_demo", clinicId: "clinic_demo", branchName: "Clinica Radiologica de Goiania", insuranceName: "Particular", procedureName: "RM Cranio", procedureAmountCents: 65000, materialAmountCents: 0, discountAmountCents: 0, copayAmountCents: 0, totalAmountCents: 65000, effectiveDate: new Date().toISOString().slice(0, 10), status: "active", createdAt: new Date().toISOString() }
  ];

  for (const price of prices) {
    if (!get("price_rules", price.id)) create("price_rules", price);
  }
}

function seedSecurityData() {
  if (!get("users", "usr_admin_demo")) {
    create("users", {
      id: "usr_admin_demo",
      clinicId: "clinic_demo",
      name: "Administrador",
      email: "admin@clinic.local",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      status: "active",
      modules: ["all"],
      createdAt: new Date().toISOString()
    });
  }

  if (!get("lgpd_terms", "lgpd_term_default")) {
    create("lgpd_terms", {
      id: "lgpd_term_default",
      clinicId: "clinic_demo",
      title: "Termo de consentimento LGPD",
      version: "1.0",
      status: "active",
      purpose: "Atendimento assistencial, administrativo, faturamento, comunicacao e guarda legal de dados de saude.",
      retentionPolicy: "Reter conforme obrigacoes legais e politicas internas da clinica.",
      createdAt: new Date().toISOString()
    });
  }

  getBackupPolicy();
}

function simulateRelationshipCall(body) {
  const dtmf = String(body.dtmf ?? "1");
  const queue = relationshipQueues.find((item) => item.dtmf === dtmf) ?? relationshipQueues[0];
  const originPhone = optional(body.originPhone) ?? "+55 79 99999-0000";
  const patientName = optional(body.patientName) ?? "Paciente nao identificado";
  const reason = optional(body.reason) ?? queue.name;
  const sensitiveWords = ["reclamacao", "processo", "erro", "diagnostico", "laudo errado", "urgente"];
  const normalizedReason = normalizeText(reason);
  const requiresHumanReview = queue.id === "human" || sensitiveWords.some((word) => normalizedReason.includes(word));

  return {
    id: id("call"),
    clinicId: "clinic_demo",
    channel: "voice",
    provider: "asterisk-ari",
    ariApplication: "clinic-relationship",
    originPhone,
    patientName,
    dtmf,
    queueId: queue.id,
    queueName: queue.name,
    transferTarget: queue.transferTarget,
    reason,
    intent: inferRelationshipIntent(queue.id, reason),
    status: requiresHumanReview ? "needs_human_review" : "agent_suggested",
    agentSummary: `Ligacao de ${patientName} sobre ${reason}. Direcionar para ${queue.name}.`,
    agentSuggestion: requiresHumanReview
      ? "Transferir para atendimento humano e registrar prioridade."
      : "Responder de forma objetiva, confirmar dados principais e criar tarefa se necessario.",
    requiresHumanReview,
    startedAt: new Date().toISOString()
  };
}

function defaultWhatsappConfig() {
  return {
    id: "relationship_whatsapp_config",
    clinicId: "clinic_demo",
    provider: "evolution-api",
    cloudPhoneNumberId: "",
    cloudAccessToken: "",
    verifyToken: "clinic-whatsapp-verify",
    cloudGraphVersion: "v23.0",
    evolutionBaseUrl: "http://127.0.0.1:8080",
    evolutionInstance: "clinic-main",
    evolutionApiKey: "clinic-evolution-local-key",
    webhookSecret: "clinic-whatsapp-local-secret",
    agentMode: "automatic",
    autoReplyEnabled: true,
    autoSendEnabled: true,
    autoScheduleEnabled: true,
    autoCancelEnabled: true,
    autoOrderReadingEnabled: true,
    ocrEngine: "tesseract-cli",
    ocrLanguage: "por+eng",
    requireHumanReviewForLowConfidence: true,
    minimumConfidence: 0.72,
    retryLimit: 3,
    status: "homologation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function defaultWhatsappFlows() {
  const now = new Date().toISOString();
  return [
    { id: "waf_greeting", clinicId: "clinic_demo", name: "Saudacao inicial", intent: "greeting", action: "clarify", keywords: "oi, ola, bom dia, boa tarde, boa noite", responseTemplate: "Olá, {{nome}}. Posso ajudar com agendamento, cancelamento, preparo de exames ou envio de pedido por foto.", requiresApproval: false, priority: 10, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_schedule", clinicId: "clinic_demo", name: "Agendamento", intent: "schedule", action: "schedule", keywords: "agendar, marcar, horario, consulta, exame", responseTemplate: "Agendamento criado para {{nome}}: {{procedimento}} em {{data}}. Se precisar remarcar, envie \"remarcar\".", requiresApproval: false, priority: 30, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_cancel", clinicId: "clinic_demo", name: "Cancelamento", intent: "cancel", action: "cancel", keywords: "cancelar, desmarcar, cancelar exame", responseTemplate: "Localizei sua solicitação de cancelamento. Vou registrar e avisar a equipe se precisar de conferência.", requiresApproval: false, priority: 40, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_order_photo", clinicId: "clinic_demo", name: "Pedido por foto", intent: "order_photo", action: "order", keywords: "pedido, guia, receita, solicitação, solicitacao, foto", responseTemplate: "Recebi o pedido. Vou conferir os dados e seguir com o agendamento quando estiver legível.", requiresApproval: true, priority: 50, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_prepare", clinicId: "clinic_demo", name: "Preparo de exames", intent: "exam_prep", action: "info", keywords: "preparo, jejum, contraste, orientacao, orientação", responseTemplate: "Para orientar corretamente, me diga qual exame será realizado. Se houver contraste ou sedação, a equipe confirma as instruções antes do atendimento.", requiresApproval: false, priority: 20, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_human", clinicId: "clinic_demo", name: "Falar com atendente", intent: "human", action: "human", keywords: "atendente, humano, falar com alguem, falar com alguém, recepcao, recepção", responseTemplate: "Vou encaminhar sua conversa para um atendente. Por favor, aguarde um momento.", requiresApproval: true, priority: 80, status: "active", createdAt: now, updatedAt: now },
    { id: "waf_address", clinicId: "clinic_demo", name: "Endereco e horarios", intent: "location", action: "info", keywords: "endereco, endereço, localização, localizacao, horario de funcionamento, horário de funcionamento", responseTemplate: "Atendemos na unidade principal. Envie sua dúvida de endereço ou horário que a equipe confirma os detalhes para você.", requiresApproval: false, priority: 15, status: "active", createdAt: now, updatedAt: now }
  ];
}

function defaultWhatsappTemplates() {
  const now = new Date().toISOString();
  return [
    { id: "watpl_schedule_confirm", clinicId: "clinic_demo", name: "Confirmacao de agendamento", category: "agendamento", trigger: "appointment_scheduled", body: "Agendamento confirmado para {{nome}}: {{procedimento}} em {{data}}, na {{sala}}. Chegue com antecedencia e traga documento com foto.", variables: "nome, procedimento, data, sala", requiresApproval: false, status: "active", priority: 90, createdAt: now, updatedAt: now },
    { id: "watpl_exam_prep", clinicId: "clinic_demo", name: "Preparo de exame", category: "preparo", trigger: "prep_instruction", body: "{{nome}}, seguem as orientacoes para {{procedimento}}:\\n{{preparo}}\\nDocumentos: {{documentos}}", variables: "nome, procedimento, preparo, documentos", requiresApproval: false, status: "active", priority: 80, createdAt: now, updatedAt: now },
    { id: "watpl_lgpd", clinicId: "clinic_demo", name: "Consentimento LGPD WhatsApp", category: "lgpd", trigger: "consent_request", body: "Para continuar pelo WhatsApp, precisamos da sua ciencia para usar este canal no atendimento, agendamento e orientacoes. Responda SIM para continuar ou NAO para falar com a equipe.", variables: "nome", requiresApproval: false, status: "active", priority: 100, createdAt: now, updatedAt: now },
    { id: "watpl_authorization", clinicId: "clinic_demo", name: "Solicitar guia/autorizacao", category: "convenio", trigger: "insurance_pending", body: "{{convenio}} exige guia ou senha de autorizacao para {{procedimento}}. Envie a guia, senha ou uma foto legivel para continuarmos.", variables: "convenio, procedimento", requiresApproval: false, status: "active", priority: 75, createdAt: now, updatedAt: now },
    { id: "watpl_cancel", clinicId: "clinic_demo", name: "Cancelamento confirmado", category: "cancelamento", trigger: "appointment_cancelled", body: "Seu atendimento de {{procedimento}} foi cancelado. Se desejar remarcar, envie o melhor dia ou turno.", variables: "procedimento", requiresApproval: false, status: "active", priority: 70, createdAt: now, updatedAt: now },
    { id: "watpl_human", clinicId: "clinic_demo", name: "Encaminhar atendimento humano", category: "humano", trigger: "human_review", body: "Vou encaminhar sua conversa para um atendente. Por favor, aguarde um momento.", variables: "nome", requiresApproval: true, status: "active", priority: 95, createdAt: now, updatedAt: now },
    { id: "watpl_reminder", clinicId: "clinic_demo", name: "Lembrete de vespera", category: "lembrete", trigger: "appointment_reminder", body: "Lembrete: {{nome}} tem {{procedimento}} agendado em {{data}}. Caso precise remarcar, responda esta mensagem.", variables: "nome, procedimento, data", requiresApproval: false, status: "active", priority: 60, createdAt: now, updatedAt: now }
  ];
}

function defaultWhatsappAutonomyRules() {
  const now = new Date().toISOString();
  return [
    { id: "waar_lgpd_rejected", clinicId: "clinic_demo", name: "LGPD recusado sempre vai para humano", condition: "lgpd_rejected", action: "human_review", appliesTo: "message,schedule,cancel,order_photo", severity: "high", threshold: "", keywords: "", priority: 100, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_identity_unconfirmed", clinicId: "clinic_demo", name: "Identidade nao confirmada bloqueia acao critica", condition: "identity_unconfirmed", action: "human_review", appliesTo: "schedule,cancel,order_photo", severity: "high", threshold: "", keywords: "", priority: 95, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_low_ocr", clinicId: "clinic_demo", name: "OCR com baixa confianca exige revisao", condition: "low_ocr_confidence", action: "human_review", appliesTo: "order_photo", severity: "medium", threshold: "0.72", keywords: "", priority: 90, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_sensitive_words", clinicId: "clinic_demo", name: "Termos sensiveis pausam o agente", condition: "sensitive_words", action: "human_review", appliesTo: "message,schedule,cancel,order_photo", severity: "high", threshold: "", keywords: "reclamacao, processo, diagnostico, erro, laudo errado, urgencia, advogado", priority: 88, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_insurance_authorization", clinicId: "clinic_demo", name: "Convenio sem guia vai para conferencia", condition: "authorization_required", action: "human_review", appliesTo: "schedule,order_photo", severity: "medium", threshold: "", keywords: "", priority: 85, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_same_day_cancel", clinicId: "clinic_demo", name: "Cancelamento no mesmo dia exige recepcao", condition: "same_day_cancel", action: "human_review", appliesTo: "cancel", severity: "medium", threshold: "", keywords: "", priority: 80, status: "active", createdAt: now, updatedAt: now },
    { id: "waar_private_schedule", clinicId: "clinic_demo", name: "Agendamento particular pode seguir automatico", condition: "private_schedule", action: "allow", appliesTo: "schedule,order_photo", severity: "low", threshold: "", keywords: "particular, privado", priority: 40, status: "active", createdAt: now, updatedAt: now }
  ];
}

function defaultWhatsappAutonomyProfiles() {
  const now = new Date().toISOString();
  return [
    { id: "waap_complaint_human", clinicId: "clinic_demo", name: "Reclamacao, laudo e risco reputacional", scope: "critical_relationship", mode: "human", action: "human_review", appliesTo: "message,schedule,cancel,order_photo", insuranceType: "all", keywords: "reclamacao, laudo errado, processo, advogado, diagnostico, erro", description: "Qualquer mensagem sensivel fica com atendimento humano.", priority: 90, status: "active", createdAt: now, updatedAt: now },
    { id: "waap_private_schedule", clinicId: "clinic_demo", name: "Agendamento particular automatico", scope: "private_schedule", mode: "automatic", action: "allow", appliesTo: "schedule,order_photo", insuranceType: "private", keywords: "particular, privado", description: "Atendimentos particulares podem seguir com automacao quando identidade e LGPD estiverem ok.", priority: 70, status: "active", createdAt: now, updatedAt: now },
    { id: "waap_insurance_schedule", clinicId: "clinic_demo", name: "Agendamento por convenio supervisionado", scope: "insurance_schedule", mode: "supervised", action: "require_approval", appliesTo: "schedule,order_photo", insuranceType: "insurance", keywords: "", description: "Convenios passam por aprovacao operacional para reduzir erro de guia, plano e autorizacao.", priority: 65, status: "active", createdAt: now, updatedAt: now },
    { id: "waap_cancel_supervised", clinicId: "clinic_demo", name: "Cancelamento sempre supervisionado", scope: "cancel", mode: "supervised", action: "require_approval", appliesTo: "cancel", insuranceType: "all", keywords: "", description: "Cancelamentos exigem conferencia antes de concluir.", priority: 60, status: "active", createdAt: now, updatedAt: now },
    { id: "waap_order_photo_supervised", clinicId: "clinic_demo", name: "Pedido por foto supervisionado", scope: "order_photo", mode: "supervised", action: "require_approval", appliesTo: "order_photo", insuranceType: "all", keywords: "", description: "Pedidos recebidos por foto ficam em aprovacao quando nao forem claramente particulares e simples.", priority: 50, status: "active", createdAt: now, updatedAt: now }
  ];
}

function defaultWhatsappJourneys() {
  const now = new Date().toISOString();
  return [
    {
      id: "waj_schedule",
      clinicId: "clinic_demo",
      name: "Cascata de agendamento",
      intent: "schedule",
      triggerActions: ["schedule"],
      description: "Identifica paciente, pedido, convenio, preferencia de horario e confirma antes de criar o atendimento.",
      steps: [
        { id: "patient_identity", title: "Identificar paciente", action: "collect_patient", prompt: "{{nome}}, para iniciar o agendamento, me envie nome completo e data de nascimento.", requiredData: ["patientName", "birthDate"], requiresApproval: false },
        { id: "exam_request", title: "Pedido e exame", action: "collect_order", prompt: "Agora me envie o exame desejado ou uma foto legivel do pedido medico.", requiredData: ["procedureName"], requiresApproval: false },
        { id: "insurance_check", title: "Convenio e autorizacao", action: "collect_insurance", prompt: "Qual e o convenio ou sera particular? Se houver guia/autorizacao, pode enviar a foto.", requiredData: ["insuranceName"], requiresApproval: false },
        { id: "slot_preference", title: "Preferencia de horario", action: "collect_slot", prompt: "Qual melhor dia ou turno para realizar {{procedimento}}?", requiredData: ["preferredDate"], requiresApproval: false },
        { id: "confirm_schedule", title: "Confirmar agenda", action: "schedule", prompt: "Encontrei {{procedimento}} em {{data}}, na {{sala}} da {{unidade}}. Posso confirmar para {{nome}}?", requiredData: [], requiresApproval: false }
      ],
      priority: 80,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waj_cancel",
      clinicId: "clinic_demo",
      name: "Cascata de cancelamento",
      intent: "cancel",
      triggerActions: ["cancel"],
      description: "Confere identidade e solicita confirmacao antes de cancelar um atendimento.",
      steps: [
        { id: "cancel_identity", title: "Identificar paciente", action: "collect_patient", prompt: "Para cancelar com seguranca, envie nome completo e data de nascimento do paciente.", requiredData: ["patientName", "birthDate"], requiresApproval: false },
        { id: "cancel_confirm", title: "Confirmar cancelamento", action: "cancel", prompt: "Confirma que deseja cancelar o atendimento ativo deste paciente?", requiredData: [], requiresApproval: false }
      ],
      priority: 70,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waj_order_photo",
      clinicId: "clinic_demo",
      name: "Cascata de pedido por foto",
      intent: "order_photo",
      triggerActions: ["order"],
      description: "Recebe pedido medico, tenta OCR, mede confianca e encaminha para agendamento ou revisao humana.",
      steps: [
        { id: "receive_order", title: "Receber pedido", action: "collect_order", prompt: "Pode enviar a foto do pedido medico. Vou ler os dados e conferir se esta legivel.", requiredData: ["procedureName"], requiresApproval: false },
        { id: "review_order", title: "Conferir OCR", action: "human_review", prompt: "Recebi o pedido. Vou encaminhar para conferencia antes de seguir com o agendamento.", requiredData: [], requiresApproval: true },
        { id: "schedule_from_order", title: "Agendar pelo pedido", action: "schedule", prompt: "Com o pedido conferido, posso seguir com o agendamento?", requiredData: [], requiresApproval: false }
      ],
      priority: 90,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waj_human",
      clinicId: "clinic_demo",
      name: "Cascata de atendimento humano",
      intent: "human",
      triggerActions: ["human"],
      description: "Pausa o agente e encaminha a conversa para supervisao da recepcao.",
      steps: [
        { id: "handoff", title: "Encaminhar atendente", action: "human_review", prompt: "Vou encaminhar sua conversa para um atendente. Por favor, aguarde um momento.", requiredData: [], requiresApproval: true }
      ],
      priority: 100,
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function defaultWhatsappPrepRules() {
  const now = new Date().toISOString();
  return [
    {
      id: "waprep_ct_contrast",
      clinicId: "clinic_demo",
      name: "Tomografia com contraste",
      modality: "CT",
      procedureKeywords: "tomografia, tc, contraste",
      instructions: "Jejum de 4 horas se houver contraste. Trazer exames anteriores e informar alergias, uso de metformina, gestacao ou doenca renal.",
      documents: "Documento com foto, pedido medico, carteirinha do convenio e guia/senha quando aplicavel.",
      arrivalMinutes: 30,
      requiresCompanion: false,
      priority: 90,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waprep_mr",
      clinicId: "clinic_demo",
      name: "Ressonancia magnetica",
      modality: "MR",
      procedureKeywords: "ressonancia, rm, cranio, coluna",
      instructions: "Retirar objetos metalicos antes do exame. Avisar se possui marca-passo, implante, clipe metalico, gestacao ou claustrofobia.",
      documents: "Documento com foto, pedido medico, exames anteriores e autorizacao do convenio quando solicitada.",
      arrivalMinutes: 30,
      requiresCompanion: false,
      priority: 80,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waprep_us_abdomen",
      clinicId: "clinic_demo",
      name: "Ultrassom abdominal",
      modality: "US",
      procedureKeywords: "ultrassom, us, abdomen, abdominal",
      instructions: "Jejum de 6 horas para ultrassom abdominal. Para alguns exames pelvicos, manter bexiga cheia conforme orientacao da equipe.",
      documents: "Documento com foto e pedido medico.",
      arrivalMinutes: 20,
      requiresCompanion: false,
      priority: 70,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "waprep_default",
      clinicId: "clinic_demo",
      name: "Preparo padrao",
      modality: "OT",
      procedureKeywords: "exame, consulta",
      instructions: "Chegue com antecedencia e traga exames anteriores relacionados. Se tiver duvidas sobre preparo, a equipe confirma antes do atendimento.",
      documents: "Documento com foto, pedido medico, carteirinha do convenio e guia/senha quando aplicavel.",
      arrivalMinutes: 20,
      requiresCompanion: false,
      priority: 10,
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ];
}

function getWhatsappConfig() {
  return { ...defaultWhatsappConfig(), ...(get("relationship_whatsapp_config", "relationship_whatsapp_config") ?? {}) };
}

function publicWhatsappConfig(config) {
  return {
    ...config,
    cloudAccessToken: "",
    evolutionApiKey: "",
    hasCloudAccessToken: Boolean(config.cloudAccessToken),
    hasEvolutionApiKey: Boolean(config.evolutionApiKey)
  };
}

function buildWhatsappReadiness() {
  const config = getWhatsappConfig();
  const conversations = list("relationship_whatsapp_conversations");
  const messages = list("relationship_whatsapp_messages");
  const checks = [
    { id: "provider", label: "Provedor", ok: Boolean(config.provider), detail: config.provider },
    { id: "cloud", label: "Cloud API", ok: Boolean(config.cloudPhoneNumberId && config.cloudAccessToken) || config.provider !== "cloud-api", detail: config.cloudPhoneNumberId ? "configurado" : "opcional" },
    { id: "evolution", label: "Evolution API", ok: Boolean(config.evolutionBaseUrl && config.evolutionInstance && config.evolutionApiKey) || config.provider !== "evolution-api", detail: config.evolutionBaseUrl },
    { id: "webhook", label: "Webhook seguro", ok: Boolean(config.webhookSecret && config.verifyToken), detail: `${publicBaseUrl}/webhooks/relationship/whatsapp/evolution` },
    { id: "agent", label: "Agente autonomo", ok: Boolean(config.autoReplyEnabled), detail: `${config.autoReplyEnabled ? "ativo" : "desativado"} / ${whatsappAgentModeLabel(config.agentMode)}` },
    { id: "send", label: "Envio ativo", ok: Boolean(config.autoSendEnabled), detail: config.autoSendEnabled ? "envia respostas" : "somente fila local" },
    { id: "schedule", label: "Agenda/cancelamento", ok: Boolean(config.autoScheduleEnabled && config.autoCancelEnabled), detail: "habilitado" },
    { id: "ocr", label: "Pedido por foto", ok: Boolean(config.autoOrderReadingEnabled && whatsappOcrAvailable(config)), detail: whatsappOcrAvailable(config) ? `${config.ocrEngine} ${config.ocrLanguage}` : "instalar Tesseract ou enviar texto extraido" },
    { id: "status", label: "Status", ok: config.status !== "inactive", detail: uraModule.statusText(config.status) }
  ];
  const okCount = checks.filter((check) => check.ok).length;
  return {
    status: okCount === checks.length && config.status === "production" ? "production_ready" : okCount === checks.length ? "ready_for_homologation" : "needs_configuration",
    okCount,
    totalChecks: checks.length,
    checks,
    conversations: conversations.length,
    messages: messages.length,
    updatedAt: new Date().toISOString()
  };
}

function buildWhatsappSafetyDashboard(request, user) {
  const tasks = list("relationship_whatsapp_tasks");
  const messages = list("relationship_whatsapp_messages");
  const audits = list("relationship_whatsapp_audit");
  const correctionIssues = syncWhatsappDeliveryProfileIssues(request, user, messages);
  const reviews = buildWhatsappAutonomyReviews();
  const outbound = messages.filter((message) => message.direction === "outbound");
  const completedAutomation = tasks.filter((task) =>
    task.status === "completed" && !["manual_reply", "waiting_human", "human_review", "autonomy_review"].includes(task.action)
  );
  const reviewTasks = tasks.filter((task) =>
    task.status === "needs_review" || ["human_review", "autonomy_review", "insurance_review", "identity_review", "identity_update_review", "consent_rejected"].includes(task.action)
  );
  const approvedReviews = tasks.filter((task) => task.action === "autonomy_review" && task.approvedAt);
  const approvalDurations = approvedReviews
    .map((task) => new Date(task.approvedAt).getTime() - new Date(task.createdAt).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageApprovalMinutes = approvalDurations.length
    ? Math.round((approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length) / 60000)
    : 0;
  const sent = outbound.filter((message) => message.status === "sent").length;
  const failed = outbound.filter((message) => ["failed", "blocked_profile"].includes(message.status)).length;
  const resolvedFailures = outbound.filter((message) => message.status === "resolved_failure").length;
  const deliveryRisks = outbound
    .filter((message) => ["failed", "blocked_profile"].includes(message.status))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
    .slice(0, 12)
    .map((message) => ({
      ...message,
      deliveryDiagnosis: classifyWhatsappDeliveryFailure(message),
      correctionIssue: correctionIssues.find((issue) => issue.messageId === message.id)
    }));
  const totalOutboundDone = sent + failed;
  const sendSuccessRate = totalOutboundDone ? Math.round((sent / totalOutboundDone) * 100) : 100;
  const totalDecisions = completedAutomation.length + reviewTasks.length;
  const automationRate = totalDecisions ? Math.round((completedAutomation.length / totalDecisions) * 100) : 0;
  const reasons = summarizeWhatsappInterventionReasons(reviewTasks);
  const pendingCorrectionIssues = correctionIssues.filter((issue) => issue.status === "pending").length;
  const recentEvents = audits
    .filter((event) => [
      "whatsapp.autonomy_rule_applied",
      "whatsapp.autonomy_rule_approved",
      "whatsapp.autonomy_rule_rejected",
      "whatsapp.outbound_reviewed",
      "whatsapp.outbound_blocked_profile_issue",
      "whatsapp.outbound_reprocessed_after_phone_correction",
      "whatsapp.profile_update_applied",
      "whatsapp.conversation_assumed",
      "whatsapp.message_waiting_human"
    ].includes(event.action))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 12);

  return {
    summary: {
      automationRate,
      automatedActions: completedAutomation.length,
      humanInterventions: reviewTasks.length,
      pendingApprovals: reviews.summary?.pending ?? 0,
      approvedRules: audits.filter((event) => event.action === "whatsapp.autonomy_rule_approved").length,
      rejectedRules: audits.filter((event) => event.action === "whatsapp.autonomy_rule_rejected").length,
      failedDeliveries: failed,
      resolvedFailures,
      correctionIssues: pendingCorrectionIssues,
      sendSuccessRate,
      averageApprovalMinutes
    },
    executive: buildWhatsappExecutiveStatus({
      readiness: buildWhatsappReadiness(),
      pendingApprovals: reviews.summary?.pending ?? 0,
      failedDeliveries: failed,
      correctionIssues: pendingCorrectionIssues
    }),
    reasons,
    deliveryRisks,
    recentEvents,
    status: reviews.summary?.pending > 0 ? "attention" : failed > 0 ? "delivery_risk" : "stable",
    updatedAt: new Date().toISOString()
  };
}

function buildWhatsappExecutiveStatus({ readiness, pendingApprovals = 0, failedDeliveries = 0, correctionIssues = 0 }) {
  const blockers = [];
  if (readiness.status === "needs_configuration") blockers.push("Configurar provedor, webhook, agente ou OCR antes de producao.");
  if (correctionIssues > 0) blockers.push(`${correctionIssues} telefone(s) precisam de correcao cadastral.`);
  if (pendingApprovals > 0) blockers.push(`${pendingApprovals} aprovacao(oes) operacional(is) pendente(s).`);
  if (failedDeliveries > 0) blockers.push(`${failedDeliveries} falha(s) de envio ainda ativa(s).`);
  if (blockers.length) {
    return {
      status: readiness.status === "needs_configuration" || correctionIssues > 0 ? "blocked" : "attention",
      label: readiness.status === "needs_configuration" || correctionIssues > 0 ? "Pendencias impeditivas" : "Atencao operacional",
      blockers,
      recommendation: correctionIssues > 0
        ? "Corrigir os telefones pendentes antes de liberar automacao plena."
        : "Concluir aprovacoes e revisar falhas antes de operar sem supervisao."
    };
  }
  return {
    status: readiness.status === "production_ready" ? "ready" : "homologation",
    label: readiness.status === "production_ready" ? "Apto para producao" : "Apto para homologacao",
    blockers: [],
    recommendation: readiness.status === "production_ready"
      ? "Fluxo liberado para operacao monitorada."
      : "Executar homologacao com amostras reais antes de marcar producao."
  };
}

function summarizeWhatsappInterventionReasons(tasks = []) {
  const bucket = new Map();
  for (const task of tasks) {
    const key = task.orderData?.autonomyProfileName
      ?? task.orderData?.autonomyRuleName
      ?? whatsappSafetyReasonLabel(task.action);
    const current = bucket.get(key) ?? {
      reason: key,
      count: 0,
      latestAt: task.updatedAt ?? task.createdAt,
      action: task.action
    };
    current.count += 1;
    if (new Date(task.updatedAt ?? task.createdAt ?? 0).getTime() > new Date(current.latestAt ?? 0).getTime()) {
      current.latestAt = task.updatedAt ?? task.createdAt;
      current.action = task.action;
    }
    bucket.set(key, current);
  }
  return [...bucket.values()]
    .sort((a, b) => b.count - a.count || new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime())
    .slice(0, 8);
}

function syncWhatsappDeliveryProfileIssues(request, user, messages = list("relationship_whatsapp_messages")) {
  const issues = [];
  for (const message of messages.filter((item) => item.direction === "outbound" && item.status === "failed")) {
    const diagnosis = classifyWhatsappDeliveryFailure(message);
    if (!["invalid_phone", "missing_country_code"].includes(diagnosis.category)) continue;
    issues.push(ensureWhatsappDeliveryProfileIssue({ request, user, message, diagnosis }));
  }
  return issues.filter(Boolean);
}

function ensureWhatsappDeliveryProfileIssue({ request, user, message, diagnosis }) {
  const conversation = get("relationship_whatsapp_conversations", message.conversationId) ?? {};
  const patient = conversation.patientId ? get("patients", conversation.patientId) : undefined;
  const existing = list("relationship_whatsapp_profile_updates").find((item) =>
    item.source === "whatsapp_delivery_failure"
    && item.messageId === message.id
    && item.status === "pending"
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const update = create("relationship_whatsapp_profile_updates", {
    id: id("waup"),
    clinicId: clinicId(request),
    conversationId: message.conversationId,
    phone: conversation.phone ?? message.toPhone,
    patientId: patient?.id ?? conversation.patientId,
    patientName: patient?.fullName ?? conversation.patientName ?? conversation.contactName ?? message.toPhone,
    field: "phone",
    currentValue: message.toPhone,
    proposedValue: "",
    normalizedProposedValue: "",
    source: "whatsapp_delivery_failure",
    reason: `Falha de envio por ${diagnosis.label}. ${diagnosis.hint}`,
    status: "pending",
    messageId: message.id,
    deliveryFailureCategory: diagnosis.category,
    deliveryFailureHint: diagnosis.hint,
    createdBy: user?.id ?? "system",
    createdByName: user?.name ?? "Sistema",
    createdAt: now
  });
  if (request && user) auditWhatsapp(request, user, "whatsapp.profile_update_suggested", update, { field: "phone", source: update.source, messageId: message.id, category: diagnosis.category });
  return update;
}

function whatsappSafetyReasonLabel(action) {
  const labels = {
    autonomy_review: "Regra ou perfil de autonomia",
    human_review: "Atendimento humano solicitado",
    insurance_review: "Revisao de convenio",
    insurance_pending: "Guia/autorizacao pendente",
    identity_review: "Identidade duplicada",
    identity_update_review: "Divergencia cadastral",
    consent_rejected: "LGPD recusado",
    not_found: "Registro nao encontrado"
  };
  return labels[action] ?? action ?? "Intervencao humana";
}

function whatsappAgentModeLabel(mode) {
  return { automatic: "automatico", supervised: "supervisionado", manual: "manual" }[mode] ?? mode ?? "automatico";
}

function whatsappFlows() {
  return list("relationship_whatsapp_flows")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappFlow(body, user, request) {
  const now = new Date().toISOString();
  const flow = create("relationship_whatsapp_flows", {
    id: id("waf"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Novo fluxo",
    intent: optional(body.intent) ?? "triage",
    action: optional(body.action) ?? "clarify",
    keywords: optional(body.keywords) ?? "",
    responseTemplate: optional(body.responseTemplate) ?? "Recebi sua mensagem. Vou ajudar com o atendimento.",
    requiresApproval: booleanValue(body.requiresApproval, false),
    priority: Number(body.priority || 10),
    status: optional(body.status) ?? "active",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.flow_created", flow, { intent: flow.intent, action: flow.action });
  return flow;
}

function whatsappTemplates() {
  return list("relationship_whatsapp_templates")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappTemplate(body, user, request) {
  const now = new Date().toISOString();
  const template = create("relationship_whatsapp_templates", {
    id: id("watpl"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Novo template",
    category: optional(body.category) ?? "geral",
    trigger: optional(body.trigger) ?? "manual",
    body: optional(body.body) ?? "Mensagem padrao da clinica.",
    variables: optional(body.variables) ?? "",
    requiresApproval: booleanValue(body.requiresApproval, false),
    status: optional(body.status) ?? "active",
    priority: Number(body.priority || 10),
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.template_created", template, { category: template.category, trigger: template.trigger });
  return template;
}

function whatsappAutonomyRules() {
  return list("relationship_whatsapp_autonomy_rules")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappAutonomyRule(body, user, request) {
  const now = new Date().toISOString();
  const rule = create("relationship_whatsapp_autonomy_rules", {
    id: id("waar"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Nova regra de autonomia",
    condition: optional(body.condition) ?? "sensitive_words",
    action: optional(body.action) ?? "human_review",
    appliesTo: optional(body.appliesTo) ?? "message,schedule,cancel,order_photo",
    severity: optional(body.severity) ?? "medium",
    threshold: optional(body.threshold) ?? "",
    keywords: optional(body.keywords) ?? "",
    priority: Number(body.priority || 10),
    status: optional(body.status) ?? "active",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.autonomy_rule_created", rule, { condition: rule.condition, action: rule.action });
  return rule;
}

function whatsappAutonomyProfiles() {
  return list("relationship_whatsapp_autonomy_profiles")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappAutonomyProfile(body, user, request) {
  const now = new Date().toISOString();
  const profile = create("relationship_whatsapp_autonomy_profiles", {
    id: id("waap"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Novo perfil de autonomia",
    scope: optional(body.scope) ?? "general",
    mode: optional(body.mode) ?? "supervised",
    action: optional(body.action) ?? "require_approval",
    appliesTo: optional(body.appliesTo) ?? "schedule,order_photo,cancel,message",
    insuranceType: optional(body.insuranceType) ?? "all",
    keywords: optional(body.keywords) ?? "",
    description: optional(body.description) ?? "",
    priority: Number(body.priority || 10),
    status: optional(body.status) ?? "active",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.autonomy_profile_created", profile, { scope: profile.scope, mode: profile.mode, action: profile.action });
  return profile;
}

function whatsappJourneys() {
  return list("relationship_whatsapp_journeys")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappJourney(body, user, request) {
  const now = new Date().toISOString();
  const steps = parseWhatsappJourneySteps(optional(body.stepsText) ?? "");
  const journey = create("relationship_whatsapp_journeys", {
    id: id("waj"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Nova cascata",
    intent: optional(body.intent) ?? "triage",
    triggerActions: String(optional(body.triggerActions) ?? "clarify").split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
    description: optional(body.description) ?? "",
    steps,
    priority: Number(body.priority || 10),
    status: optional(body.status) ?? "active",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.journey_created", journey, { intent: journey.intent, steps: journey.steps.length });
  return journey;
}

function parseWhatsappJourneySteps(value) {
  const rows = String(value ?? "").split(/\n/).map((row) => row.trim()).filter(Boolean);
  const steps = rows.map((row, index) => {
    const [title, action = "clarify", prompt = "Recebi. Vou seguir com o atendimento."] = row.split("|").map((item) => item.trim());
    return {
      id: `custom_step_${index + 1}`,
      title: title || `Etapa ${index + 1}`,
      action,
      prompt,
      requiredData: [],
      requiresApproval: action === "human_review"
    };
  });
  return steps.length ? steps : [
    { id: "collect_context", title: "Coletar dados", action: "clarify", prompt: "Recebi sua mensagem. Pode me enviar mais detalhes para seguir com o atendimento?", requiredData: [], requiresApproval: false }
  ];
}

function whatsappPrepRules() {
  return list("relationship_whatsapp_prep_rules")
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || String(a.name).localeCompare(String(b.name)));
}

function createWhatsappPrepRule(body, user, request) {
  const now = new Date().toISOString();
  const prepRule = create("relationship_whatsapp_prep_rules", {
    id: id("waprep"),
    clinicId: clinicId(request),
    name: optional(body.name) ?? "Novo preparo",
    modality: optional(body.modality) ?? "OT",
    procedureKeywords: optional(body.procedureKeywords) ?? "",
    instructions: optional(body.instructions) ?? "A equipe confirma o preparo antes do atendimento.",
    documents: optional(body.documents) ?? "Documento com foto e pedido medico.",
    arrivalMinutes: Math.max(0, Number(body.arrivalMinutes ?? 20)),
    requiresCompanion: booleanValue(body.requiresCompanion, false),
    priority: Number(body.priority || 10),
    status: optional(body.status) ?? "active",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.prep_rule_created", prepRule, { modality: prepRule.modality });
  return prepRule;
}

function matchWhatsappFlow(text) {
  const normalized = normalizeText(text);
  if (!normalized) return undefined;
  return whatsappFlows().find((flow) => {
    if (flow.status !== "active") return false;
    const keywords = String(flow.keywords ?? "")
      .split(/[,;\n]/)
      .map((keyword) => normalizeText(keyword).trim())
      .filter(Boolean);
    return keywords.some((keyword) => normalized.includes(keyword));
  });
}

function renderWhatsappFlowResponse(flow, context = {}) {
  return renderWhatsappTextTemplate(flow?.responseTemplate || "", context);
}

function renderWhatsappTextTemplate(template, context = {}) {
  const values = {
    nome: context.patientName ?? context.contactName ?? "paciente",
    procedimento: context.procedureName ?? context.procedimento ?? "exame",
    data: context.startsAt ? formatIsoForPatient(context.startsAt) : context.data ?? "data a confirmar",
    sala: context.roomName ?? context.sala ?? "sala a confirmar",
    unidade: context.unitName ?? context.branchName ?? context.unidade ?? "unidade principal",
    convenio: context.insuranceName ?? context.convenio ?? "convenio/particular a confirmar",
    guia: context.guideNumber ?? context.authorizationCode ?? context.guia ?? "guia a confirmar",
    telefone: context.phone ?? context.telefone ?? "",
    preparo: context.prepInstructions ?? context.preparo ?? "",
    documentos: context.documents ?? context.documentos ?? ""
  };
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? context[key] ?? "");
}

function findWhatsappTemplate(trigger, category) {
  return whatsappTemplates().find((template) =>
    template.status === "active"
    && normalizeText(template.trigger) === normalizeText(trigger)
    && (!category || normalizeText(template.category) === normalizeText(category))
  );
}

function renderWhatsappTemplate(trigger, context = {}, fallback = "", category) {
  const template = findWhatsappTemplate(trigger, category);
  if (!template) return fallback;
  const rendered = renderWhatsappTextTemplate(template.body, context).trim();
  return rendered || fallback;
}

async function ingestWhatsappWebhook(body, request, user, provider) {
  const messages = normalizeWhatsappWebhookMessages(body, provider);
  const results = await Promise.all(messages.map((message) => ingestWhatsappMessage(message, request, user)));
  return { provider, count: results.length, results };
}

function normalizeWhatsappWebhookMessages(body, provider) {
  if (provider === "cloud-api") {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    return entries.flatMap((entry) => (entry.changes ?? []).flatMap((change) => {
      const value = change.value ?? {};
      const contacts = new Map((value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]));
      return (value.messages ?? []).map((message) => {
        const image = message.image ?? {};
        const document = message.document ?? {};
        return {
          provider,
          externalId: message.id,
          fromPhone: message.from,
          contactName: contacts.get(message.from) ?? "Paciente WhatsApp",
          messageType: message.type,
          text: message.text?.body ?? "",
          caption: image.caption ?? document.caption,
          mediaId: image.id ?? document.id,
          mediaMimeType: image.mime_type ?? document.mime_type,
          extractedText: image.caption ?? document.caption
        };
      });
    }));
  }

  const data = body.data ?? body;
  const eventName = normalizeText(body.event ?? body.eventName ?? data.event ?? data.type ?? "");
  if (eventName && !eventName.includes("messages_upsert") && !eventName.includes("messages upsert") && !eventName.includes("messages.upsert")) {
    return [];
  }
  const message = data.message ?? data;
  const key = message.key ?? data.key ?? {};
  if (key.fromMe === true || key.fromMe === "true") return [];
  const remoteJid = String(key.remoteJid ?? data.remoteJid ?? data.from ?? "");
  if (!remoteJid || remoteJid.endsWith("@g.us")) return [];
  const content = message.message ?? data.message ?? {};
  const image = content.imageMessage ?? {};
  const document = content.documentMessage ?? {};
  const text = content.conversation ?? content.extendedTextMessage?.text ?? data.text ?? data.messageText ?? "";
  if (!text && !image.url && !document.url && !data.mediaUrl) return [];
  return [{
    provider,
    externalId: key.id ?? data.id ?? `evt-${Date.now()}`,
    fromPhone: remoteJid.replace(/@.+$/, ""),
    contactName: data.pushName ?? data.contactName ?? "Paciente WhatsApp",
    messageType: image.url || data.messageType === "image" ? "image" : document.url ? "document" : "text",
    text,
    caption: image.caption ?? document.caption ?? data.caption,
    mediaUrl: image.url ?? document.url ?? data.mediaUrl,
    mediaMimeType: image.mimetype ?? document.mimetype ?? data.mimetype,
    extractedText: data.extractedText ?? image.caption ?? document.caption
  }];
}

async function ingestWhatsappMessage(message, request, user) {
  const now = new Date().toISOString();
  const config = getWhatsappConfig();
  const ocrMessage = await enrichWhatsappMessageWithOcr(message, request, user, config);
  const patientIdentity = identifyWhatsappPatient(ocrMessage);
  const enrichedMessage = {
    ...ocrMessage,
    patientId: patientIdentity.patient?.id,
    patientName: patientIdentity.patient?.fullName,
    patientDocumentNumber: patientIdentity.patient?.documentNumber,
    patientBirthDate: patientIdentity.patient?.birthDate,
    patientMatchedBy: patientIdentity.matchedBy,
    patientIdentityStatus: patientIdentity.identityStatus,
    patientIdentityCandidates: patientIdentity.candidates,
    cpfInMessage: patientIdentity.cpfInMessage,
    contactName: patientIdentity.patient?.fullName ?? ocrMessage.contactName
  };
  const conversationId = whatsappConversationId(message.fromPhone);
  const conversation = upsertWhatsappConversation(conversationId, enrichedMessage, now);
  const profileUpdates = createWhatsappProfileUpdateSuggestions(enrichedMessage, conversation, request, user);
  const inbound = create("relationship_whatsapp_messages", {
    id: id("wam"),
    clinicId: clinicId(request),
    conversationId,
    direction: "inbound",
    provider: message.provider,
    externalId: message.externalId,
    fromPhone: message.fromPhone,
    contactName: message.contactName,
    patientId: enrichedMessage.patientId,
    patientName: enrichedMessage.patientName,
    patientDocumentNumber: enrichedMessage.patientDocumentNumber,
    patientMatchedBy: enrichedMessage.patientMatchedBy,
    patientIdentityStatus: enrichedMessage.patientIdentityStatus,
    messageType: enrichedMessage.messageType,
    text: enrichedMessage.text,
    caption: enrichedMessage.caption,
    mediaUrl: enrichedMessage.mediaUrl,
    mediaId: enrichedMessage.mediaId,
    mediaMimeType: enrichedMessage.mediaMimeType,
    extractedText: enrichedMessage.extractedText,
    ocrId: enrichedMessage.ocrId,
    ocrStatus: enrichedMessage.ocrStatus,
    ocrConfidence: enrichedMessage.ocrConfidence,
    profileUpdateIds: profileUpdates.map((update) => update.id),
    createdAt: now
  });
  if (conversation.automationPaused) {
    const agent = createWhatsappTask({
      request,
      user,
      conversation,
      message: enrichedMessage,
      intent: "manual",
      action: "waiting_human",
      confidence: 1,
      status: "needs_review",
      reply: "Conversa assumida pela equipe. O agente registrou a mensagem e aguarda resposta humana."
    });
    const assigned = create("relationship_whatsapp_conversations", { ...conversation, status: "human_assigned", automationPaused: true, updatedAt: new Date().toISOString() });
    auditWhatsapp(request, user, "whatsapp.message_waiting_human", inbound, { conversationId, assignedTo: assigned.assignedToName });
    return { conversation: assigned, inbound, agent };
  }
  const agent = runWhatsappAgent(enrichedMessage, conversation, config, request, user);
  const outbound = config.autoReplyEnabled ? await createWhatsappOutbound(conversationId, message.fromPhone, agent.reply, agent, request, user, config) : undefined;
  const updatedConversation = get("relationship_whatsapp_conversations", conversationId) ?? conversation;
  auditWhatsapp(request, user, "whatsapp.message_processed", inbound, { intent: agent.intent, action: agent.action, confidence: agent.confidence });
  return { conversation: updatedConversation, inbound, outbound, agent };
}

function upsertWhatsappConversation(conversationId, message, now) {
  const current = get("relationship_whatsapp_conversations", conversationId);
  return create("relationship_whatsapp_conversations", {
    ...(current ?? {}),
    id: conversationId,
    clinicId: "clinic_demo",
    phone: message.fromPhone,
    contactName: message.patientName ?? message.contactName ?? current?.contactName ?? "Paciente WhatsApp",
    patientId: message.patientId ?? current?.patientId,
    patientName: message.patientName ?? current?.patientName,
    patientDocumentNumber: message.patientDocumentNumber ?? current?.patientDocumentNumber,
    patientBirthDate: message.patientBirthDate ?? current?.patientBirthDate,
    patientMatchedBy: message.patientMatchedBy ?? current?.patientMatchedBy,
    patientIdentityStatus: current?.patientIdentityStatus === "confirmed" ? "confirmed" : message.patientIdentityStatus ?? current?.patientIdentityStatus,
    patientIdentityCandidates: message.patientIdentityCandidates ?? current?.patientIdentityCandidates,
    patientRecognizedAt: message.patientId ? now : current?.patientRecognizedAt,
    whatsappConsentStatus: current?.whatsappConsentStatus,
    whatsappConsentId: current?.whatsappConsentId,
    whatsappConsentAt: current?.whatsappConsentAt,
    pendingConsentText: current?.pendingConsentText,
    status: current?.automationPaused ? "human_assigned" : "open",
    automationPaused: Boolean(current?.automationPaused),
    assignedTo: current?.assignedTo,
    assignedToName: current?.assignedToName,
    assignedAt: current?.assignedAt,
    lastIntent: current?.lastIntent,
    collectedData: {
      ...(current?.collectedData ?? {}),
      ...(message.patientId ? { patientId: message.patientId } : {}),
      ...(message.patientName ? { patientName: message.patientName } : {}),
      ...(message.patientDocumentNumber ? { documentNumber: message.patientDocumentNumber } : {}),
      ...(message.patientBirthDate ? { birthDate: message.patientBirthDate } : {})
    },
    lastMessageAt: now,
    updatedAt: now,
    createdAt: current?.createdAt ?? now
  });
}

async function enrichWhatsappMessageWithOcr(message, request, user, config) {
  const isMedia = ["image", "document"].includes(String(message.messageType));
  if (!isMedia || !config.autoOrderReadingEnabled) return message;
  if (message.extractedText && String(message.extractedText).trim().length > 0) {
    const ocr = createWhatsappOcrRecord({
      request,
      user,
      message,
      status: "provided",
      text: message.extractedText,
      confidence: estimateOcrTextConfidence(message.extractedText),
      source: "provider_or_caption"
    });
    return { ...message, ocrId: ocr.id, ocrStatus: ocr.status, ocrConfidence: ocr.confidence };
  }

  const media = await downloadWhatsappMedia(message, config);
  if (!media.ok) {
    const ocr = createWhatsappOcrRecord({
      request,
      user,
      message,
      status: "pending_media",
      text: "",
      confidence: 0,
      source: "media_download",
      error: media.error
    });
    return { ...message, ocrId: ocr.id, ocrStatus: ocr.status, ocrConfidence: ocr.confidence };
  }

  const ocrResult = await runWhatsappOcr(media, config);
  const ocr = createWhatsappOcrRecord({
    request,
    user,
    message,
    status: ocrResult.ok ? "completed" : "failed",
    text: ocrResult.text,
    confidence: ocrResult.confidence,
    source: config.ocrEngine,
    mediaPath: media.path,
    error: ocrResult.error
  });
  return {
    ...message,
    extractedText: ocrResult.text || message.extractedText,
    ocrId: ocr.id,
    ocrStatus: ocr.status,
    ocrConfidence: ocr.confidence
  };
}

async function downloadWhatsappMedia(message, config) {
  try {
    mkdirSync(mediaRoot, { recursive: true });
    let mediaUrl = message.mediaUrl;
    let headers = {};
    if (!mediaUrl && message.mediaId && message.provider === "cloud-api" && config.cloudAccessToken) {
      const meta = await fetch(`https://graph.facebook.com/${config.cloudGraphVersion}/${encodeURIComponent(message.mediaId)}`, {
        headers: { Authorization: `Bearer ${config.cloudAccessToken}` }
      });
      if (!meta.ok) return { ok: false, error: `Cloud media metadata HTTP ${meta.status}` };
      const payload = await meta.json();
      mediaUrl = payload.url;
      headers = { Authorization: `Bearer ${config.cloudAccessToken}` };
    }
    if (!mediaUrl) return { ok: false, error: "Midia sem URL ou mediaId baixavel." };

    const response = await fetch(mediaUrl, { headers });
    if (!response.ok) return { ok: false, error: `Falha ao baixar midia HTTP ${response.status}` };
    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") ?? message.mediaMimeType ?? "application/octet-stream";
    const extension = whatsappMediaExtension(mimeType, mediaUrl);
    const fileName = `${id("wa_media")}${extension}`;
    const filePath = join(mediaRoot, fileName);
    writeFileSync(filePath, bytes);
    return { ok: true, path: filePath, mimeType, bytes: bytes.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao baixar midia." };
  }
}

async function runWhatsappOcr(media, config) {
  if (!whatsappOcrAvailable(config)) {
    return { ok: false, text: "", confidence: 0, error: "Tesseract CLI nao encontrado no computador." };
  }
  try {
    const { stdout } = await execFileAsync("tesseract", [media.path, "stdout", "-l", config.ocrLanguage ?? "por+eng", "--psm", "6"], { timeout: 30000 });
    const text = String(stdout ?? "").trim();
    return { ok: text.length > 0, text, confidence: estimateOcrTextConfidence(text), error: text.length > 0 ? undefined : "OCR nao retornou texto." };
  } catch (error) {
    return { ok: false, text: "", confidence: 0, error: error instanceof Error ? error.message : "Falha no OCR." };
  }
}

function createWhatsappOcrRecord({ request, user, message, status, text, confidence, source, mediaPath, error }) {
  return create("relationship_whatsapp_ocr", {
    id: id("ocr"),
    clinicId: clinicId(request),
    provider: message.provider,
    fromPhone: message.fromPhone,
    contactName: message.contactName,
    messageType: message.messageType,
    mediaId: message.mediaId,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaPath,
    status,
    source,
    text,
    confidence,
    error,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString()
  });
}

function identifyWhatsappPatient(message = {}) {
  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const cpfInMessage = extractCpf(text);
  const patients = list("patients");
  const byCpf = cpfInMessage
    ? patients.filter((patient) => normalizeDocument(patient.documentNumber) === cpfInMessage || normalizeDocument(patient.cpf) === cpfInMessage)
    : [];
  if (byCpf.length === 1) return { patient: byCpf[0], matchedBy: "cpf", identityStatus: "confirmed", cpfInMessage };
  if (byCpf.length > 1) return { patient: undefined, candidates: byCpf.map(publicPatientIdentity), matchedBy: "cpf_duplicate", identityStatus: "duplicate", cpfInMessage };

  const byPhone = patients.filter((patient) => phoneMatches(patient.phone, message.fromPhone) || phoneMatches(patient.mobile, message.fromPhone));
  if (byPhone.length === 1) return { patient: byPhone[0], matchedBy: "phone", identityStatus: "needs_confirmation", cpfInMessage };
  if (byPhone.length > 1) return { patient: undefined, candidates: byPhone.map(publicPatientIdentity), matchedBy: "phone_duplicate", identityStatus: "duplicate", cpfInMessage };

  return { patient: undefined, matchedBy: cpfInMessage ? "cpf_not_found" : "none", identityStatus: "unknown", cpfInMessage };
}

function publicPatientIdentity(patient) {
  return {
    id: patient.id,
    fullName: patient.fullName,
    documentNumber: patient.documentNumber,
    birthDate: patient.birthDate,
    phone: patient.phone,
    email: patient.email
  };
}

function createWhatsappProfileUpdateSuggestions(message, conversation, request, user) {
  if (!message.patientId) return [];
  const patient = get("patients", message.patientId);
  if (!patient) return [];
  const suggestions = [];
  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const cpf = extractCpf(text);
  const birthDate = extractDateToken(text);
  const explicitPhone = extractPhoneToken(text);
  const whatsappPhone = normalizePhone(message.fromPhone);

  if (cpf && normalizeDocument(patient.documentNumber) && normalizeDocument(patient.documentNumber) !== cpf) {
    suggestions.push(createWhatsappProfileUpdateSuggestion({ request, user, conversation, patient, field: "documentNumber", currentValue: patient.documentNumber, proposedValue: cpf, source: "cpf_message", reason: "CPF informado diverge do cadastro." }));
  }
  if (birthDate && patient.birthDate && normalizeDateToken(patient.birthDate) !== normalizeDateToken(birthDate)) {
    suggestions.push(createWhatsappProfileUpdateSuggestion({ request, user, conversation, patient, field: "birthDate", currentValue: patient.birthDate, proposedValue: normalizeDateToken(birthDate), source: "identity_confirmation", reason: "Data de nascimento informada diverge do cadastro." }));
  }
  if (explicitPhone && !phoneMatches(patient.phone, explicitPhone) && !phoneMatches(patient.mobile, explicitPhone)) {
    suggestions.push(createWhatsappProfileUpdateSuggestion({ request, user, conversation, patient, field: "phone", currentValue: patient.phone, proposedValue: explicitPhone, source: "phone_message", reason: "Telefone informado pelo paciente nao consta no cadastro." }));
  }
  if (message.patientMatchedBy === "cpf" && whatsappPhone && !phoneMatches(patient.phone, whatsappPhone) && !phoneMatches(patient.mobile, whatsappPhone)) {
    suggestions.push(createWhatsappProfileUpdateSuggestion({ request, user, conversation, patient, field: "phone", currentValue: patient.phone, proposedValue: whatsappPhone, source: "whatsapp_origin", reason: "Paciente reconhecido por CPF usando telefone diferente do cadastro." }));
  }

  return suggestions;
}

function createWhatsappProfileUpdateSuggestion({ request, user, conversation, patient, field, currentValue, proposedValue, source, reason }) {
  const normalizedProposed = field === "birthDate" ? normalizeDateToken(proposedValue) : field === "phone" ? normalizePhone(proposedValue) : field === "documentNumber" ? normalizeDocument(proposedValue) : String(proposedValue ?? "");
  if (!normalizedProposed) return undefined;
  const existing = list("relationship_whatsapp_profile_updates").find((item) =>
    item.status === "pending"
    && item.patientId === patient.id
    && item.field === field
    && String(item.normalizedProposedValue) === normalizedProposed
  );
  if (existing) return existing;
  const update = create("relationship_whatsapp_profile_updates", {
    id: id("waup"),
    clinicId: clinicId(request),
    conversationId: conversation.id,
    phone: conversation.phone,
    patientId: patient.id,
    patientName: patient.fullName,
    field,
    currentValue,
    proposedValue,
    normalizedProposedValue: normalizedProposed,
    source,
    reason,
    status: "pending",
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.profile_update_suggested", update, { field, source, patientId: patient.id });
  return update;
}

function whatsappProfileUpdates() {
  return list("relationship_whatsapp_profile_updates")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
    .slice(0, 120);
}

async function resolveWhatsappProfileUpdate(updateId, status, user, request, body = {}) {
  const update = get("relationship_whatsapp_profile_updates", updateId);
  if (!update) return undefined;
  const nextStatus = ["reviewed", "rejected", "pending"].includes(status) ? status : "reviewed";
  const correctedValue = optional(body.correctedValue) ?? optional(body.proposedValue);
  if (nextStatus === "reviewed" && update.field === "phone") {
    const valueToApply = correctedValue ?? optional(update.proposedValue);
    if (!valueToApply) {
      return {
        ...update,
        errorCode: "missing_corrected_phone",
        errorMessage: "Informe o telefone correto para concluir esta pendencia."
      };
    }
    const validation = validateWhatsappDestinationPhone(valueToApply);
    if (!validation.ok) {
      const rejected = create("relationship_whatsapp_profile_updates", {
        ...update,
        reviewError: validation.error,
        updatedAt: new Date().toISOString()
      });
      auditWhatsapp(request, user, "whatsapp.profile_update_invalid_value", rejected, {
        field: rejected.field,
        reason: validation.error,
        hint: validation.hint
      });
      return {
        ...rejected,
        errorCode: validation.category,
        errorMessage: `${validation.error} ${validation.hint}`
      };
    }
    return applyWhatsappPhoneProfileUpdate(update, validation.phone, user, request, body);
  }
  const resolved = create("relationship_whatsapp_profile_updates", {
    ...update,
    status: nextStatus,
    reviewedBy: user.id,
    reviewedByName: user.name,
    reviewedAt: nextStatus === "pending" ? undefined : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.profile_update_resolved", resolved, { status: nextStatus, field: resolved.field });
  return resolved;
}

async function applyWhatsappPhoneProfileUpdate(update, correctedPhone, user, request, body = {}) {
  const now = new Date().toISOString();
  const patient = update.patientId ? get("patients", update.patientId) : undefined;
  const conversation = update.conversationId ? get("relationship_whatsapp_conversations", update.conversationId) : undefined;
  if (patient) {
    create("patients", {
      ...patient,
      phone: correctedPhone,
      phoneCorrectedFrom: patient.phone,
      phoneCorrectedBy: user.id,
      phoneCorrectedByName: user.name,
      phoneCorrectedAt: now,
      updatedAt: now
    });
  }
  if (conversation) {
    create("relationship_whatsapp_conversations", {
      ...conversation,
      phone: correctedPhone,
      correctedPhone,
      phoneCorrectedFrom: conversation.phone,
      phoneCorrectedBy: user.id,
      phoneCorrectedByName: user.name,
      phoneCorrectedAt: now,
      updatedAt: now
    });
  }

  const resolvedIssues = resolveRelatedWhatsappDeliveryProfileIssues(update, correctedPhone, user, request, now);
  const resolved = create("relationship_whatsapp_profile_updates", {
    ...update,
    status: "reviewed",
    proposedValue: correctedPhone,
    normalizedProposedValue: correctedPhone,
    appliedAt: now,
    appliedBy: user.id,
    appliedByName: user.name,
    reviewedBy: user.id,
    reviewedByName: user.name,
    reviewedAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.profile_update_applied", resolved, {
    field: "phone",
    patientId: resolved.patientId,
    conversationId: resolved.conversationId,
    previousValue: update.currentValue,
    correctedPhone,
    relatedIssues: resolvedIssues.length
  });
  const reprocessResult = booleanValue(body.reprocess, false)
    ? await reprocessWhatsappOutboxAfterPhoneCorrection(resolved, correctedPhone, request, user)
    : undefined;
  return {
    ...resolved,
    relatedIssuesResolved: resolvedIssues.length,
    reprocessResult
  };
}

function resolveRelatedWhatsappDeliveryProfileIssues(update, correctedPhone, user, request, now = new Date().toISOString()) {
  const currentPhone = normalizePhone(update.currentValue);
  const related = list("relationship_whatsapp_profile_updates").filter((item) =>
    item.id !== update.id
    && item.status === "pending"
    && item.source === "whatsapp_delivery_failure"
    && (
      (update.conversationId && item.conversationId === update.conversationId)
      || (currentPhone && normalizePhone(item.currentValue) === currentPhone)
    )
  );
  return related.map((item) => {
    const resolved = create("relationship_whatsapp_profile_updates", {
      ...item,
      status: "reviewed",
      proposedValue: correctedPhone,
      normalizedProposedValue: correctedPhone,
      appliedAt: now,
      appliedBy: user.id,
      appliedByName: user.name,
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewedAt: now,
      updatedAt: now
    });
    auditWhatsapp(request, user, "whatsapp.profile_update_applied", resolved, {
      field: "phone",
      patientId: resolved.patientId,
      conversationId: resolved.conversationId,
      previousValue: item.currentValue,
      correctedPhone,
      relatedTo: update.id
    });
    return resolved;
  });
}

async function reprocessWhatsappOutboxAfterPhoneCorrection(update, correctedPhone, request, user) {
  const eligibleStatuses = new Set(["failed", "blocked_profile", "resolved_failure"]);
  const messages = whatsappOutbox()
    .filter((message) =>
      eligibleStatuses.has(message.status)
      && (
        (update.conversationId && message.conversationId === update.conversationId)
        || message.id === update.messageId
        || normalizePhone(message.toPhone) === normalizePhone(update.currentValue)
      )
    )
    .slice(0, 12);
  const results = [];
  for (const message of messages) {
    const queued = updateWhatsappMessageStatus(message, {
      toPhone: correctedPhone,
      correctedFromPhone: message.toPhone,
      correctedBy: user.id,
      correctedByName: user.name,
      correctedAt: new Date().toISOString(),
      status: "queued",
      attempts: 0,
      failureCategory: undefined,
      failureHint: undefined,
      error: undefined
    }, request, user);
    auditWhatsapp(request, user, "whatsapp.outbound_reprocessed_after_phone_correction", queued, {
      previousPhone: message.toPhone,
      correctedPhone,
      profileUpdateId: update.id
    });
    results.push(await sendWhatsappMessage(queued, request, user, { force: true, retry: true, ignoreProfileBlock: true }));
  }
  return { count: results.length, results };
}

function whatsappConsents() {
  return list("relationship_whatsapp_consents")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
    .slice(0, 160);
}

function latestWhatsappConsent(conversation = {}) {
  const patientId = conversation.patientId;
  const phone = normalizePhone(conversation.phone);
  return list("relationship_whatsapp_consents")
    .filter((consent) => {
      const samePatient = patientId && consent.patientId === patientId;
      const samePhone = phone && normalizePhone(consent.phone) === phone;
      return consent.channel === "whatsapp" && (samePatient || samePhone);
    })
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
}

function createWhatsappConsent({ request, user, conversation, message, status = "accepted", source = "agent" }) {
  const now = new Date().toISOString();
  const normalizedStatus = ["accepted", "rejected", "requested"].includes(status) ? status : "accepted";
  const consent = create("relationship_whatsapp_consents", {
    id: id("wac"),
    clinicId: clinicId(request),
    conversationId: conversation.id,
    channel: "whatsapp",
    phone: conversation.phone,
    contactName: conversation.contactName,
    patientId: conversation.patientId,
    patientName: conversation.patientName ?? conversation.contactName,
    policyVersion: "lgpd-whatsapp-v1",
    status: normalizedStatus,
    acceptedAt: normalizedStatus === "accepted" ? now : undefined,
    rejectedAt: normalizedStatus === "rejected" ? now : undefined,
    requestedAt: normalizedStatus === "requested" ? now : undefined,
    source,
    evidenceText: [message?.text, message?.caption, message?.extractedText].filter(Boolean).join("\n"),
    createdBy: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now
  });
  auditWhatsapp(request, user, "whatsapp.consent_recorded", consent, { status: consent.status, patientId: consent.patientId, policyVersion: consent.policyVersion });
  return consent;
}

function detectWhatsappConsentReply(text = "") {
  const normalized = normalizeText(text);
  if (isNegativeWhatsappConfirmation(normalized) || /\b(recuso|nao aceito|nao autorizo|prefiro atendente)\b/.test(normalized)) return "rejected";
  if (isPositiveWhatsappConfirmation(normalized) || /\b(aceito|autorizo|concordo|ciente)\b/.test(normalized)) return "accepted";
  return undefined;
}

function shouldAskWhatsappConsent(conversation = {}) {
  if (!conversation.patientId || conversation.patientIdentityStatus !== "confirmed") return false;
  const latest = latestWhatsappConsent(conversation);
  if (latest?.status === "accepted") return false;
  return conversation.whatsappConsentStatus !== "accepted";
}

function handleWhatsappConsentGate(message, conversation, request, user) {
  if (!conversation.patientId || conversation.patientIdentityStatus !== "confirmed") return undefined;
  const latestConsent = latestWhatsappConsent(conversation);
  if (latestConsent?.status === "accepted" && conversation.whatsappConsentStatus !== "accepted") {
    const confirmed = create("relationship_whatsapp_conversations", {
      ...conversation,
      whatsappConsentStatus: "accepted",
      whatsappConsentId: latestConsent.id,
      whatsappConsentAt: latestConsent.acceptedAt ?? latestConsent.createdAt,
      pendingConsentText: undefined,
      updatedAt: new Date().toISOString()
    });
    return { conversation: confirmed };
  }

  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  if (conversation.whatsappConsentStatus === "requested") {
    const reply = detectWhatsappConsentReply(text);
    if (reply === "accepted") {
      const consent = createWhatsappConsent({ request, user, conversation, message, status: "accepted", source: "agent" });
      if (conversation.pendingConsentText && !String(message.text ?? "").includes(conversation.pendingConsentText)) {
        message.text = `${conversation.pendingConsentText}\n${message.text ?? ""}`.trim();
      }
      const accepted = create("relationship_whatsapp_conversations", {
        ...conversation,
        whatsappConsentStatus: "accepted",
        whatsappConsentId: consent.id,
        whatsappConsentAt: consent.acceptedAt,
        pendingConsentText: undefined,
        updatedAt: new Date().toISOString()
      });
      return { conversation: accepted };
    }
    if (reply === "rejected") {
      const consent = createWhatsappConsent({ request, user, conversation, message, status: "rejected", source: "agent" });
      const rejected = create("relationship_whatsapp_conversations", {
        ...conversation,
        status: "consent_rejected",
        automationPaused: true,
        whatsappConsentStatus: "rejected",
        whatsappConsentId: consent.id,
        whatsappConsentAt: consent.rejectedAt,
        pendingConsentText: undefined,
        updatedAt: new Date().toISOString()
      });
      return {
        task: createWhatsappTask({
          request,
          user,
          conversation: rejected,
          message,
          intent: "lgpd",
          action: "consent_rejected",
          confidence: 0.98,
          status: "needs_review",
          reply: "Entendi. Vou encaminhar para a equipe continuar seu atendimento por outro caminho, sem seguir com o agente automatico pelo WhatsApp."
        })
      };
    }
    return {
      task: createWhatsappTask({
        request,
        user,
        conversation,
        message,
        intent: "lgpd",
        action: "consent_request",
        confidence: 0.88,
        status: "waiting_patient",
        reply: renderWhatsappTemplate("consent_request", {
          patientName: conversation.patientName,
          contactName: conversation.contactName,
          phone: conversation.phone
        }, "Para continuar pelo WhatsApp, responda SIM se estiver ciente e autoriza este canal para atendimento, agendamento e orientacoes, ou NAO para falar com a equipe.")
      })
    };
  }

  if (!shouldAskWhatsappConsent(conversation)) return undefined;
  const requested = create("relationship_whatsapp_conversations", {
    ...conversation,
    whatsappConsentStatus: "requested",
    pendingConsentText: text,
    updatedAt: new Date().toISOString()
  });
  const consent = createWhatsappConsent({ request, user, conversation: requested, message, status: "requested", source: "agent" });
  const requestedWithConsent = create("relationship_whatsapp_conversations", {
    ...requested,
    whatsappConsentId: consent.id,
    whatsappConsentAt: consent.requestedAt,
    updatedAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.consent_requested", requestedWithConsent, { patientId: requestedWithConsent.patientId, policyVersion: consent.policyVersion });
  return {
    task: createWhatsappTask({
      request,
      user,
      conversation: requestedWithConsent,
      message,
      intent: "lgpd",
      action: "consent_request",
      confidence: 0.94,
      status: "waiting_patient",
      reply: renderWhatsappTemplate("consent_request", {
        patientName: conversation.patientName,
        contactName: conversation.contactName,
        phone: conversation.phone
      }, `Ola, ${firstName(conversation.patientName ?? conversation.contactName)}. Para continuar pelo WhatsApp, precisamos da sua ciencia para usar este canal no atendimento, agendamento e orientacoes. Responda SIM para continuar ou NAO para falar com a equipe.`)
    })
  };
}

function extractCpf(text = "") {
  const formatted = String(text).match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  const digits = normalizeDocument(formatted?.[0] ?? "");
  return digits.length === 11 ? digits : undefined;
}

function extractPhoneToken(text = "") {
  const match = String(text).match(/(?:telefone|celular|whatsapp|fone)[:\s+()-]*(\+?\d[\d\s().-]{7,18}\d)/i);
  const digits = normalizePhone(match?.[1] ?? "");
  return digits.length >= 10 ? digits : undefined;
}

function phoneMatches(left, right) {
  const a = normalizePhoneTail(left);
  const b = normalizePhoneTail(right);
  return Boolean(a && b && (a === b || a.slice(-10) === b.slice(-10)));
}

function findWhatsappJourney(flow, fallbackAction) {
  const action = flow?.action ?? fallbackAction;
  const intent = flow?.intent;
  return whatsappJourneys().find((journey) => {
    if (journey.status !== "active") return false;
    const triggers = Array.isArray(journey.triggerActions) ? journey.triggerActions : [];
    return (intent && journey.intent === intent) || (action && triggers.includes(action));
  });
}

function continueWhatsappJourney(message, conversation, config, request, user, orderData) {
  if (conversation.journeyStatus !== "active" || !conversation.journeyId) return undefined;
  const journey = get("relationship_whatsapp_journeys", conversation.journeyId);
  if (!journey || journey.status !== "active") return undefined;
  const steps = Array.isArray(journey.steps) ? journey.steps : [];
  if (!steps.length) return undefined;
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === conversation.journeyStepId));
  const currentStep = steps[currentIndex] ?? steps[0];
  const normalized = normalizeText([message.text, message.caption, message.extractedText].filter(Boolean).join("\n"));
  const collectedData = mergeWhatsappJourneyData(conversation.collectedData, orderData, message);

  if (currentStep.action === "collect_insurance") {
    const validation = validateWhatsappInsurance(collectedData);
    const dataWithValidation = { ...collectedData, ...validation.normalizedData, insuranceValidation: validation };
    if (validation.requiresHumanReview) {
      const updatedConversation = updateWhatsappJourneyConversation(conversation, journey, currentStep, "paused", dataWithValidation);
      return createWhatsappTask({
        request,
        user,
        conversation: updatedConversation,
        message,
        intent: journey.intent,
        action: "insurance_review",
        confidence: 0.74,
        status: "needs_review",
        orderData: dataWithValidation,
        reply: validation.message
      });
    }
    if (!validation.ok) {
      const updatedConversation = updateWhatsappJourneyConversation(conversation, journey, currentStep, "active", dataWithValidation);
      return createWhatsappTask({
        request,
        user,
        conversation: updatedConversation,
        message,
        intent: journey.intent,
        action: "insurance_pending",
        confidence: 0.82,
        status: "waiting_patient",
        orderData: dataWithValidation,
        reply: renderWhatsappTemplate("insurance_pending", {
          ...dataWithValidation,
          contactName: message.contactName,
          phone: message.fromPhone
        }, validation.message)
      });
    }
    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
    return runWhatsappJourneyStep(message, conversation, config, request, user, journey, steps[nextIndex], dataWithValidation, orderData);
  }

  if (["schedule", "cancel"].includes(currentStep.action)) {
    if (isNegativeWhatsappConfirmation(normalized)) {
      const updatedConversation = updateWhatsappJourneyConversation(conversation, journey, currentStep, "paused", collectedData);
      return createWhatsappTask({
        request,
        user,
        conversation: updatedConversation,
        message,
        intent: journey.intent,
        action: "human_review",
        confidence: 0.82,
        status: "needs_review",
        orderData: collectedData,
        reply: renderWhatsappTemplate("human_review", {
          ...collectedData,
          contactName: message.contactName,
          phone: message.fromPhone
        }, "Sem problemas. Vou deixar a equipe revisar sua solicitacao antes de prosseguir.")
      });
    }
    if (!isPositiveWhatsappConfirmation(normalized)) {
      const updatedConversation = updateWhatsappJourneyConversation(conversation, journey, currentStep, "active", collectedData);
      return createWhatsappTask({
        request,
        user,
        conversation: updatedConversation,
        message,
        intent: journey.intent,
        action: "journey_step",
        confidence: 0.76,
        status: "waiting_patient",
        orderData: collectedData,
        reply: renderWhatsappJourneyPrompt(currentStep, { ...collectedData, contactName: message.contactName, phone: message.fromPhone })
      });
    }
    const completedConversation = updateWhatsappJourneyConversation(conversation, journey, currentStep, "completed", collectedData);
    if (currentStep.action === "cancel") return cancelWhatsappAppointment(message, completedConversation, request, user);
    return scheduleWhatsappAppointment(message, completedConversation, collectedData, config, request, user, journey.intent);
  }

  const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
  const nextStep = steps[nextIndex];
  return runWhatsappJourneyStep(message, conversation, config, request, user, journey, nextStep, collectedData, orderData);
}

function startWhatsappJourney(message, conversation, config, request, user, orderData, journey, flow) {
  const steps = Array.isArray(journey.steps) ? journey.steps : [];
  const firstStep = firstWhatsappJourneyStep(steps, conversation, orderData, message);
  if (!firstStep) return undefined;
  const collectedData = mergeWhatsappJourneyData(conversation.collectedData, orderData, message);
  return runWhatsappJourneyStep(message, conversation, config, request, user, journey, firstStep, collectedData, orderData, flow);
}

function firstWhatsappJourneyStep(steps, conversation, orderData, message) {
  const hasPatient = Boolean(conversation.patientId || message.patientId || orderData.patientName);
  if (hasPatient && steps[0]?.action === "collect_patient") return steps[1] ?? steps[0];
  return steps[0];
}

function runWhatsappJourneyStep(message, conversation, config, request, user, journey, step, collectedData, orderData, flow) {
  const schedulePlan = step.action === "schedule" ? buildWhatsappAppointmentPlan(collectedData) : undefined;
  const plannedData = step.action === "schedule"
    ? { ...collectedData, schedulePlan, selectedSlot: schedulePlan?.slot }
    : collectedData;
  const status = step.requiresApproval || step.action === "human_review" ? "paused" : "active";
  const updatedConversation = updateWhatsappJourneyConversation(conversation, journey, step, status, plannedData);
  if (step.requiresApproval || step.action === "human_review") {
    return createWhatsappTask({
      request,
      user,
      conversation: updatedConversation,
      message,
      intent: journey.intent,
      action: "human_review",
      confidence: 0.9,
      status: "needs_review",
      orderData: plannedData,
      reply: renderWhatsappTemplate("human_review", {
        ...plannedData,
        ...(plannedData.selectedSlot ?? {}),
        contactName: message.contactName,
        phone: message.fromPhone
      }, renderWhatsappJourneyPrompt(step, { ...plannedData, ...(plannedData.selectedSlot ?? {}), contactName: message.contactName, phone: message.fromPhone }))
    });
  }
  return createWhatsappTask({
    request,
    user,
    conversation: updatedConversation,
    message,
    intent: journey.intent,
    action: "journey_step",
    confidence: 0.8,
    status: "waiting_patient",
    orderData: plannedData,
    reply: renderWhatsappJourneyPrompt(step, { ...plannedData, ...(plannedData.selectedSlot ?? {}), contactName: message.contactName, phone: message.fromPhone, procedureName: plannedData.procedureName })
  });
}

function updateWhatsappJourneyConversation(conversation, journey, step, status, collectedData) {
  return {
    ...conversation,
    journeyId: journey.id,
    journeyName: journey.name,
    journeyIntent: journey.intent,
    journeyStepId: step.id,
    journeyStepTitle: step.title,
    journeyStepAction: step.action,
    journeyStatus: status,
    collectedData,
    journeyStartedAt: conversation.journeyStartedAt ?? new Date().toISOString(),
    journeyUpdatedAt: new Date().toISOString()
  };
}

function mergeWhatsappJourneyData(current = {}, orderData = {}, message = {}) {
  const text = [orderData.rawText, message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const normalizedText = normalizeText(text);
  const birthDate = text.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/)?.[1];
  const insurance = text.match(/(?:convenio|convênio|plano)[:\s]+([A-Za-z0-9À-ÿ\s-]{3,60})/i)?.[1]?.trim();
  const guideNumber = text.match(/(?:guia|senha|autorizacao|autorizaÃ§Ã£o)[:\s#-]*([A-Za-z0-9-]{3,40})/i)?.[1]?.trim();
  const preference = extractWhatsappSchedulePreference(text);
  const insuranceNameFromText = insurance ?? (normalizedText.includes("particular") ? "Particular" : undefined);
  return {
    ...(current ?? {}),
    ...(message.patientId ? { patientId: message.patientId } : {}),
    ...(message.patientName ? { patientName: message.patientName } : {}),
    ...(message.patientDocumentNumber ? { documentNumber: message.patientDocumentNumber } : {}),
    ...(message.patientBirthDate ? { birthDate: message.patientBirthDate } : {}),
    ...(message.patientMatchedBy ? { patientMatchedBy: message.patientMatchedBy } : {}),
    ...(message.cpfInMessage ? { cpf: message.cpfInMessage } : {}),
    ...(orderData.patientName ? { patientName: orderData.patientName } : {}),
    ...(orderData.procedureName ? { procedureName: orderData.procedureName } : {}),
    ...(orderData.preferredDate || preference.preferredDate ? { preferredDate: orderData.preferredDate ?? preference.preferredDate } : {}),
    ...(orderData.preferredPeriod || preference.preferredPeriod ? { preferredPeriod: orderData.preferredPeriod ?? preference.preferredPeriod } : {}),
    ...(orderData.requestingDoctor ? { requestingDoctor: orderData.requestingDoctor } : {}),
    ...(orderData.requiresAuthorization !== undefined ? { requiresAuthorization: orderData.requiresAuthorization } : {}),
    confidence: Math.max(Number(current?.confidence ?? 0.65), Number(orderData.confidence ?? 0.65)),
    ...(birthDate ? { birthDate } : {}),
    ...(insuranceNameFromText ? { insuranceName: insuranceNameFromText } : {}),
    ...(guideNumber ? { guideNumber, authorizationCode: guideNumber } : {}),
    rawText: text || current.rawText || ""
  };
}

function validateWhatsappInsurance(orderData = {}) {
  const rawInsuranceName = String(orderData.insuranceName ?? "").trim();
  const normalized = normalizeText(rawInsuranceName);
  const guideNumber = orderData.guideNumber ?? orderData.authorizationCode;
  if (!rawInsuranceName) {
    return {
      ok: false,
      status: "missing_insurance",
      requiresAuthorization: false,
      requiresHumanReview: false,
      message: "Informe o convenio ou diga se sera particular para eu seguir com o agendamento.",
      normalizedData: {}
    };
  }

  if (["particular", "privado", "dinheiro", "cartao", "cartao de credito", "cartao de debito"].some((term) => normalized.includes(term))) {
    return {
      ok: true,
      status: "private",
      requiresAuthorization: false,
      requiresHumanReview: false,
      message: "Atendimento particular identificado. Vou seguir com a escolha de horario.",
      normalizedData: { insuranceName: "Particular", authorizationStatus: "not_required", requiresAuthorization: false }
    };
  }

  const insurance = findRegistryInsurance(rawInsuranceName);
  if (!insurance) {
    return {
      ok: false,
      status: "unknown_insurance",
      requiresAuthorization: true,
      requiresHumanReview: true,
      message: `Nao encontrei o convenio "${rawInsuranceName}" no cadastro. Vou encaminhar para a equipe conferir antes de prosseguir.`,
      normalizedData: { insuranceName: rawInsuranceName, authorizationStatus: "pending", requiresAuthorization: true }
    };
  }

  const guideRequired = normalizeText(insurance.guideRequired).startsWith("sim") || Boolean(orderData.requiresAuthorization);
  const plan = findRegistryPlan(insurance.name, orderData.planName);
  if (guideRequired && !guideNumber) {
    return {
      ok: false,
      status: "guide_required",
      requiresAuthorization: true,
      requiresHumanReview: false,
      message: `${insurance.name} exige guia ${insurance.guideType ?? ""}. Envie a guia, senha de autorizacao ou uma foto legivel para eu continuar.`,
      normalizedData: {
        insuranceName: insurance.name,
        planName: plan?.name ?? orderData.planName,
        guideType: insurance.guideType,
        authorizationStatus: "pending",
        approvalProfile: "insurance_schedule",
        requiresAuthorization: true
      }
    };
  }

  return {
    ok: true,
    status: guideRequired ? "authorized_or_informed" : "not_required",
    requiresAuthorization: guideRequired,
    requiresHumanReview: false,
    message: guideRequired ? `${insurance.name} validado com guia/senha ${guideNumber}.` : `${insurance.name} nao exige guia para este fluxo.`,
    normalizedData: {
      insuranceName: insurance.name,
      planName: plan?.name ?? orderData.planName,
      guideType: insurance.guideType,
      guideNumber,
      authorizationCode: guideNumber,
      authorizationStatus: guideRequired ? "authorized" : "not_required",
      approvalProfile: rawInsuranceName ? "insurance_schedule" : undefined,
      requiresAuthorization: guideRequired
    }
  };
}

function findRegistryInsurance(value) {
  const normalized = normalizeText(value);
  return list("registry_insurances")
    .filter((insurance) => insurance.status !== "inactive")
    .find((insurance) => {
      const name = normalizeText(insurance.name);
      return name === normalized || name.includes(normalized) || normalized.includes(name);
    });
}

function findRegistryPlan(insuranceName, planName) {
  const normalizedInsurance = normalizeText(insuranceName);
  const normalizedPlan = normalizeText(planName);
  return list("registry_plans")
    .filter((plan) => plan.status !== "inactive" && normalizeText(plan.insurance) === normalizedInsurance)
    .find((plan) => !normalizedPlan || normalizeText(plan.name) === normalizedPlan || normalizeText(plan.name).includes(normalizedPlan));
}

function matchWhatsappPrepRule({ procedureName = "", modality = "" } = {}) {
  const normalizedProcedure = normalizeText(procedureName);
  const normalizedModality = normalizeText(modality);
  const rules = whatsappPrepRules().filter((rule) => rule.status !== "inactive");
  const keywordMatch = rules.find((rule) => {
    const keywords = String(rule.procedureKeywords ?? "")
      .split(/[,;\n]/)
      .map((keyword) => normalizeText(keyword).trim())
      .filter(Boolean);
    return keywords.some((keyword) => normalizedProcedure.includes(keyword) || keyword.includes(normalizedProcedure));
  });
  const modalityMatch = rules.find((rule) => normalizeText(rule.modality) === normalizedModality);
  return keywordMatch ?? modalityMatch ?? rules.find((rule) => rule.id === "waprep_default") ?? rules[0];
}

function buildWhatsappPrepInstruction(appointment, prepRule) {
  if (!prepRule) return "";
  const companion = prepRule.requiresCompanion ? " Levar acompanhante." : "";
  return [
    `Preparo: ${prepRule.instructions}`,
    `Documentos: ${prepRule.documents}`,
    `Chegar com ${Number(prepRule.arrivalMinutes ?? 20)} minutos de antecedencia.${companion}`
  ].join("\n");
}

function renderWhatsappJourneyPrompt(step, context = {}) {
  return renderWhatsappFlowResponse({ responseTemplate: step.prompt }, context);
}

function isPositiveWhatsappConfirmation(normalized) {
  return /\b(sim|confirmo|pode|ok|certo|confirmar)\b/.test(normalized);
}

function isNegativeWhatsappConfirmation(normalized) {
  return /\b(nao|não|cancelar|prefiro nao|depois)\b/.test(normalized);
}

function handleWhatsappIdentityGate(message, conversation, request, user) {
  if (conversation.patientIdentityStatus === "duplicate" || ["phone_duplicate", "cpf_duplicate"].includes(conversation.patientMatchedBy)) {
    const updatedConversation = create("relationship_whatsapp_conversations", {
      ...conversation,
      status: "identity_review",
      automationPaused: true,
      updatedAt: new Date().toISOString()
    });
    return {
      task: createWhatsappTask({
        request,
        user,
        conversation: updatedConversation,
        message,
        intent: "identity",
        action: "identity_review",
        confidence: 0.95,
        status: "needs_review",
        reply: "Encontrei mais de um cadastro vinculado a este contato. Vou encaminhar para a equipe confirmar com seguranca antes de continuar."
      })
    };
  }

  if (conversation.patientIdentityStatus === "needs_confirmation") {
    const identityConflict = detectWhatsappIdentityConflict(message, conversation);
    if (identityConflict) {
      const updatedConversation = create("relationship_whatsapp_conversations", {
        ...conversation,
        status: "identity_review",
        automationPaused: true,
        updatedAt: new Date().toISOString()
      });
      return {
        task: createWhatsappTask({
          request,
          user,
          conversation: updatedConversation,
          message,
          intent: "identity",
          action: "identity_update_review",
          confidence: 0.92,
          status: "needs_review",
          reply: "Os dados informados nao conferem com o cadastro. Vou encaminhar para a equipe revisar com seguranca antes de continuar."
        })
      };
    }
    if (isWhatsappIdentityConfirmed(message, conversation)) {
      if (conversation.pendingIdentityText && !String(message.text ?? "").includes(conversation.pendingIdentityText)) {
        message.text = `${conversation.pendingIdentityText}\n${message.text ?? ""}`.trim();
      }
      const confirmed = create("relationship_whatsapp_conversations", {
        ...conversation,
        patientIdentityStatus: "confirmed",
        pendingIdentityText: undefined,
        identityConfirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      auditWhatsapp(request, user, "whatsapp.identity_confirmed", confirmed, { matchedBy: confirmed.patientMatchedBy, patientId: confirmed.patientId });
      return { conversation: confirmed };
    }
    return {
      task: createWhatsappTask({
        request,
        user,
        conversation: create("relationship_whatsapp_conversations", {
          ...conversation,
          pendingIdentityText: conversation.pendingIdentityText ?? [message.text, message.caption, message.extractedText].filter(Boolean).join("\n"),
          updatedAt: new Date().toISOString()
        }),
        message,
        intent: "identity",
        action: "identity_confirmation",
        confidence: 0.86,
        status: "waiting_patient",
        reply: `Ola, ${firstName(conversation.patientName ?? conversation.contactName)}. Para sua seguranca, confirme sua data de nascimento ou CPF antes de eu continuar o atendimento.`
      })
    };
  }

  return undefined;
}

function detectWhatsappIdentityConflict(message, conversation) {
  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const cpf = extractCpf(text);
  if (cpf && normalizeDocument(conversation.patientDocumentNumber) && normalizeDocument(conversation.patientDocumentNumber) !== cpf) return true;
  const date = extractDateToken(text);
  if (date && conversation.patientBirthDate && normalizeDateToken(conversation.patientBirthDate) !== normalizeDateToken(date)) return true;
  return false;
}

function isWhatsappIdentityConfirmed(message, conversation) {
  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const cpf = extractCpf(text);
  if (cpf && normalizeDocument(conversation.patientDocumentNumber) === cpf) return true;
  const date = extractDateToken(text);
  return Boolean(date && conversation.patientBirthDate && normalizeDateToken(conversation.patientBirthDate) === normalizeDateToken(date));
}

function extractDateToken(text = "") {
  return String(text).match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/)?.[1];
}

function normalizeDateToken(value = "") {
  const text = String(value);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return text.slice(0, 10);
}

function firstName(value = "") {
  return String(value || "paciente").trim().split(/\s+/)[0] || "paciente";
}

function runWhatsappAgent(message, conversation, config, request, user) {
  const identityGate = handleWhatsappIdentityGate(message, conversation, request, user);
  if (identityGate?.task) return identityGate.task;
  if (identityGate?.conversation) conversation = identityGate.conversation;
  const consentGate = handleWhatsappConsentGate(message, conversation, request, user);
  if (consentGate?.task) return consentGate.task;
  if (consentGate?.conversation) conversation = consentGate.conversation;

  const text = [message.text, message.caption, message.extractedText].filter(Boolean).join("\n");
  const normalized = normalizeText(text);
  const isMedia = ["image", "document"].includes(String(message.messageType));
  const orderData = extractWhatsappOrder(text, message);
  const matchedFlow = matchWhatsappFlow(text);
  const sensitiveReview = applyWhatsappAutonomyRule({
    request,
    user,
    conversation,
    message,
    intent: matchedFlow?.intent ?? "triage",
    action: "message",
    orderData,
    confidence: 0.86
  });
  if (sensitiveReview) return sensitiveReview;
  const activeJourney = continueWhatsappJourney(message, conversation, config, request, user, orderData);
  if (activeJourney) return activeJourney;
  const scheduleIntent = matchedFlow?.action === "schedule" || normalized.includes("agendar") || normalized.includes("marcar") || normalized.includes("horario");
  const cancelIntent = matchedFlow?.action === "cancel" || normalized.includes("cancelar") || normalized.includes("desmarcar");
  const orderIntent = matchedFlow?.action === "order" || isMedia || normalized.includes("pedido") || normalized.includes("guia");

  const journey = findWhatsappJourney(matchedFlow, scheduleIntent ? "schedule" : cancelIntent ? "cancel" : orderIntent ? "order" : undefined);
  if (journey) return startWhatsappJourney(message, conversation, config, request, user, orderData, journey, matchedFlow);

  if (matchedFlow?.requiresApproval || matchedFlow?.action === "human") {
    return createWhatsappTask({
      request,
      user,
      conversation,
      message,
      intent: matchedFlow.intent,
      action: "human_review",
      confidence: 0.92,
      status: "needs_review",
      orderData,
      reply: renderWhatsappFlowResponse(matchedFlow, { contactName: message.contactName, phone: message.fromPhone, procedureName: orderData.procedureName })
    });
  }

  if (matchedFlow?.action === "info" || matchedFlow?.action === "clarify") {
    return createWhatsappTask({
      request,
      user,
      conversation,
      message,
      intent: matchedFlow.intent,
      action: matchedFlow.action === "info" ? "info_reply" : "ask_clarification",
      confidence: 0.82,
      status: matchedFlow.action === "info" ? "completed" : "waiting_patient",
      orderData,
      reply: renderWhatsappFlowResponse(matchedFlow, { contactName: message.contactName, phone: message.fromPhone, procedureName: orderData.procedureName })
    });
  }

  if (cancelIntent && config.autoCancelEnabled) return cancelWhatsappAppointment(message, conversation, request, user, matchedFlow);
  if (orderIntent && config.autoOrderReadingEnabled) {
    return processWhatsappOrder(message, conversation, orderData, config, request, user, matchedFlow);
  }
  if (scheduleIntent && config.autoScheduleEnabled) {
    return scheduleWhatsappAppointment(message, conversation, orderData, config, request, user, "schedule", matchedFlow);
  }

  return createWhatsappTask({
    request,
    user,
    conversation,
    message,
    intent: "triage",
    action: "ask_clarification",
    confidence: 0.58,
    status: "waiting_patient",
    reply: "Posso ajudar com agendamento, cancelamento ou leitura de pedido. Envie o pedido por foto ou diga qual exame deseja marcar."
  });
}

function processWhatsappOrder(message, conversation, orderData, config, request, user, flow) {
  const confidence = orderData.confidence;
  const review = applyWhatsappAutonomyRule({
    request,
    user,
    conversation,
    message,
    intent: "order_photo",
    action: "order_photo",
    orderData,
    confidence,
    fallbackReply: flow ? renderWhatsappFlowResponse(flow, { contactName: message.contactName, procedureName: orderData.procedureName, phone: message.fromPhone }) : renderWhatsappTemplate("human_review", {
        contactName: message.contactName,
        procedureName: orderData.procedureName,
        phone: message.fromPhone
      }, "Recebi o pedido e vou conferir os dados antes de prosseguir. Se puder, envie tambem nome completo e data de nascimento.")
  });
  if (review) return review;
  return scheduleWhatsappAppointment(message, conversation, orderData, config, request, user, "order_photo", flow);
}

function scheduleWhatsappAppointment(message, conversation, orderData, config, request, user, intent = "schedule", flow, options = {}) {
  const validation = orderData.insuranceName ? validateWhatsappInsurance(orderData) : undefined;
  const normalizedOrderData = validation ? { ...orderData, ...validation.normalizedData, insuranceValidation: validation } : orderData;
  const plan = normalizedOrderData.schedulePlan ?? buildWhatsappAppointmentPlan(normalizedOrderData);
  const slot = normalizedOrderData.selectedSlot ?? plan.slot;
  if (!options.bypassAutonomy) {
    const review = applyWhatsappAutonomyRule({
      request,
      user,
      conversation,
      message,
      intent,
      action: "schedule",
      orderData: { ...normalizedOrderData, selectedSlot: slot },
      confidence: normalizedOrderData.confidence,
      fallbackReply: renderWhatsappTemplate("human_review", {
        ...normalizedOrderData,
        ...(slot ?? {}),
        contactName: message.contactName,
        phone: message.fromPhone
      }, "Vou encaminhar este agendamento para conferencia da equipe antes de confirmar.")
    });
    if (review) return review;
  }
  const patient = findOrCreateWhatsappPatient(message, normalizedOrderData, request);
  const startsAt = slot.startsAt;
  const prepRule = matchWhatsappPrepRule({ procedureName: slot.procedureName, modality: slot.modality });
  const prepInstructions = buildWhatsappPrepInstruction({ procedureName: slot.procedureName, startsAt }, prepRule);
  const appointment = create("appointments", {
    id: id("apt"),
    clinicId: clinicId(request),
    patientId: patient.id,
    patientName: patient.fullName,
    professionalId: plan.professionalId,
    professionalName: plan.professionalName,
    branchName: slot.branchName,
    unitName: slot.unitName,
    procedureName: slot.procedureName,
    modality: slot.modality,
    insuranceName: normalizedOrderData.insuranceName ?? "Particular",
    planName: normalizedOrderData.planName,
    guideNumber: normalizedOrderData.guideNumber,
    startsAt,
    endsAt: slot.endsAt,
    roomName: slot.roomName,
    status: "scheduled",
    source: "whatsapp_agent",
    channel: "whatsapp",
    authorizationStatus: normalizedOrderData.authorizationStatus ?? (normalizedOrderData.requiresAuthorization ? "pending" : "not_required"),
    authorizationCode: normalizedOrderData.authorizationCode,
    prepRuleId: prepRule?.id,
    prepRuleName: prepRule?.name,
    prepInstructions,
    notes: [
      normalizedOrderData.rawText,
      prepInstructions,
      `Agendado por WhatsApp com disponibilidade local: ${slot.roomName} / ${slot.modality}.`
    ].filter(Boolean).join("\n"),
    createdAt: new Date().toISOString()
  });
  const appointmentContext = {
    patientName: patient.fullName,
    contactName: message.contactName,
    procedureName: appointment.procedureName,
    startsAt,
    roomName: appointment.roomName,
    unitName: appointment.unitName,
    branchName: appointment.branchName,
    insuranceName: appointment.insuranceName,
    phone: message.fromPhone,
    prepInstructions,
    documents: prepRule?.documents
  };
  const scheduleTemplateReply = renderWhatsappTemplate(
    "appointment_scheduled",
    appointmentContext,
    `Agendamento criado para ${patient.fullName}: ${appointment.procedureName} em ${formatIsoForPatient(startsAt)}, na ${appointment.roomName}.`
  );
  return createWhatsappTask({
    request,
    user,
    conversation,
    message,
    intent,
    action: "appointment_scheduled",
    confidence: normalizedOrderData.confidence,
    status: "completed",
    orderData: { ...normalizedOrderData, prepRuleId: prepRule?.id, prepRuleName: prepRule?.name, prepInstructions },
    appointmentId: appointment.id,
    reply: flow ? renderWhatsappFlowResponse(flow, appointmentContext) : [
      scheduleTemplateReply,
      prepInstructions,
      "Se precisar remarcar, envie \"remarcar\"."
    ].filter(Boolean).join("\n")
  });
}

function cancelWhatsappAppointment(message, conversation, request, user, flow, options = {}) {
  const phone = normalizePhone(message.fromPhone);
  const patient = list("patients").find((item) => normalizePhone(item.phone) === phone);
  const appointment = patient ? list("appointments").find((item) => item.patientId === patient.id && !["cancelled", "completed"].includes(item.status)) : undefined;
  if (!appointment) {
    return createWhatsappTask({
      request,
      user,
      conversation,
      message,
      intent: "cancel",
      action: "not_found",
      confidence: 0.7,
      status: "needs_review",
      reply: flow ? renderWhatsappFlowResponse(flow, { contactName: message.contactName, phone: message.fromPhone }) : "Nao encontrei um agendamento ativo neste telefone. Vou encaminhar para a recepcao conferir."
    });
  }
  if (!options.bypassAutonomy) {
    const review = applyWhatsappAutonomyRule({
      request,
      user,
      conversation,
      message,
      intent: "cancel",
      action: "cancel",
      appointment,
      confidence: 0.86,
      fallbackReply: renderWhatsappTemplate("human_review", {
        contactName: message.contactName,
        procedureName: appointment.procedureName ?? "exame",
        phone: message.fromPhone
      }, "Vou encaminhar este cancelamento para conferencia da recepcao antes de concluir.")
    });
    if (review) return review;
  }
  create("appointments", { ...appointment, status: "cancelled", cancelledBy: "whatsapp_agent", updatedAt: new Date().toISOString() });
  return createWhatsappTask({
    request,
    user,
    conversation,
    message,
    intent: "cancel",
      action: "appointment_cancelled",
      confidence: 0.86,
      status: "completed",
      appointmentId: appointment.id,
    reply: flow ? renderWhatsappFlowResponse(flow, { contactName: message.contactName, procedureName: appointment.procedureName ?? "exame", phone: message.fromPhone }) : renderWhatsappTemplate("appointment_cancelled", {
      contactName: message.contactName,
      procedureName: appointment.procedureName ?? "exame",
      phone: message.fromPhone
    }, `Agendamento de ${appointment.procedureName ?? "exame"} cancelado. Se desejar remarcar, envie o melhor dia ou turno.`)
  });
}

function applyWhatsappAutonomyRule({ request, user, conversation, message, intent, action, orderData = {}, appointment, confidence = 0.8, fallbackReply }) {
  const decision = evaluateWhatsappAutonomy({ conversation, message, action, orderData, appointment });
  if (decision.allowed) return undefined;
  const policy = decision.policy ?? decision.rule;
  const updatedConversation = create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "autonomy_review",
    automationPaused: true,
    updatedAt: new Date().toISOString()
  });
  const reply = fallbackReply ?? renderWhatsappTemplate("human_review", {
    ...orderData,
    contactName: message.contactName,
    phone: message.fromPhone,
    procedureName: orderData.procedureName ?? appointment?.procedureName
  }, `Vou encaminhar sua solicitacao para a equipe revisar antes de continuar. Motivo: ${policy.name}.`);
  const task = createWhatsappTask({
    request,
    user,
    conversation: updatedConversation,
    message,
    intent,
    action: "autonomy_review",
    confidence,
    status: "needs_review",
    orderData: {
      ...orderData,
      autonomyRuleId: policy.id,
      autonomyRuleName: policy.name,
      autonomyRuleCondition: policy.condition,
      autonomyProfileId: decision.policy?.id,
      autonomyProfileName: decision.policy?.name,
      autonomyProfileScope: decision.policy?.scope,
      autonomyAction: decision.action,
      requestedAction: action
    },
    appointmentId: appointment?.id,
    reply
  });
  auditWhatsapp(request, user, "whatsapp.autonomy_rule_applied", task, {
    ruleId: policy.id,
    ruleName: policy.name,
    condition: policy.condition,
    profileId: decision.policy?.id,
    profileScope: decision.policy?.scope,
    action: decision.action,
    severity: policy.severity,
    conversationId: conversation.id
  });
  return task;
}

function evaluateWhatsappAutonomy({ conversation = {}, message = {}, action = "message", orderData = {}, appointment } = {}) {
  const text = [message.text, message.caption, message.extractedText, orderData.rawText].filter(Boolean).join("\n");
  const rules = whatsappAutonomyRules().filter((rule) => rule.status !== "inactive" && whatsappAutonomyApplies(rule, action));
  for (const rule of rules) {
    if (!matchesWhatsappAutonomyRule(rule, { conversation, message, action, orderData, appointment, text })) continue;
    return { allowed: rule.action === "allow", action: rule.action, rule };
  }
  const profile = matchWhatsappAutonomyProfile({ conversation, message, action, orderData, appointment, text });
  if (profile) {
    return {
      allowed: profile.action === "allow" || profile.mode === "automatic",
      action: profile.action ?? (profile.mode === "human" ? "human_review" : "require_approval"),
      policy: {
        ...profile,
        condition: `profile_${profile.scope}`,
        severity: profile.mode === "human" ? "high" : "medium"
      }
    };
  }
  return { allowed: true };
}

function whatsappAutonomyApplies(rule, action) {
  const appliesTo = String(rule.appliesTo ?? "message,schedule,cancel,order_photo")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return appliesTo.length === 0 || appliesTo.includes("all") || appliesTo.includes(action);
}

function matchesWhatsappAutonomyRule(rule, context) {
  const condition = rule.condition ?? "";
  const normalizedText = normalizeText(context.text);
  if (condition === "lgpd_rejected") {
    return context.conversation.whatsappConsentStatus === "rejected";
  }
  if (condition === "identity_unconfirmed") {
    return !context.conversation.patientId || context.conversation.patientIdentityStatus !== "confirmed";
  }
  if (condition === "low_ocr_confidence") {
    const threshold = Number(rule.threshold || 0.72);
    const confidence = Number(context.orderData.confidence ?? context.message.ocrConfidence ?? 1);
    const isOrder = context.action === "order_photo" || ["image", "document"].includes(String(context.message.messageType));
    return isOrder && confidence < threshold;
  }
  if (condition === "authorization_required") {
    const insuranceName = normalizeText(context.orderData.insuranceName ?? "");
    const privateInsurance = ["particular", "privado", "dinheiro", "cartao"].some((term) => insuranceName.includes(term));
    return !privateInsurance && Boolean(context.orderData.requiresAuthorization) && !["authorized", "not_required"].includes(String(context.orderData.authorizationStatus ?? ""));
  }
  if (condition === "same_day_cancel") {
    if (context.action !== "cancel" || !context.appointment?.startsAt) return false;
    return String(context.appointment.startsAt).slice(0, 10) === new Date().toISOString().slice(0, 10);
  }
  if (condition === "private_schedule") {
    const insuranceName = normalizeText(context.orderData.insuranceName ?? "");
    return ["particular", "privado", "dinheiro", "cartao"].some((term) => insuranceName.includes(term));
  }
  if (condition === "sensitive_words") {
    const keywords = String(rule.keywords ?? "")
      .split(/[,;\n]/)
      .map((item) => normalizeText(item.trim()))
      .filter(Boolean);
    return keywords.some((keyword) => normalizedText.includes(keyword));
  }
  return false;
}

function matchWhatsappAutonomyProfile(context) {
  return whatsappAutonomyProfiles()
    .filter((profile) => profile.status !== "inactive" && whatsappAutonomyApplies(profile, context.action))
    .find((profile) => matchesWhatsappAutonomyProfile(profile, context));
}

function matchesWhatsappAutonomyProfile(profile, context) {
  if (!matchesWhatsappAutonomyInsuranceType(profile.insuranceType, context.orderData)) return false;
  const keywords = String(profile.keywords ?? "")
    .split(/[,;\n]/)
    .map((item) => normalizeText(item.trim()))
    .filter(Boolean);
  const normalizedText = normalizeText(context.text);
  if (keywords.length && !keywords.some((keyword) => normalizedText.includes(keyword))) return false;
  const scope = profile.scope ?? "";
  if (scope === "private_schedule") return ["schedule", "order_photo"].includes(context.action);
  if (scope === "insurance_schedule") return ["schedule", "order_photo"].includes(context.action);
  if (scope === "cancel") return context.action === "cancel";
  if (scope === "order_photo") return context.action === "order_photo";
  if (scope === "critical_relationship") return keywords.length > 0;
  return true;
}

function matchesWhatsappAutonomyInsuranceType(insuranceType = "all", orderData = {}) {
  if (insuranceType === "all") return true;
  const insuranceName = normalizeText(orderData.insuranceName ?? "");
  const isPrivate = ["particular", "privado", "dinheiro", "cartao"].some((term) => insuranceName.includes(term));
  if (insuranceType === "private") return isPrivate;
  if (insuranceType === "insurance") return Boolean(insuranceName) && !isPrivate;
  if (insuranceType === "unknown") return !insuranceName;
  return true;
}

function extractWhatsappOrder(text, message) {
  const rawText = text || message.caption || "";
  const normalized = normalizeText(rawText);
  const procedures = registryDefinitionsByType.has("procedures") ? list("registry_procedures") : [];
  const matchedProcedure = procedures.find((item) => normalized.includes(normalizeText(item.name)))?.name
    ?? [["ressonancia", "Ressonancia magnetica"], ["tomografia", "Tomografia"], ["ultrassom", "Ultrassom"], ["raio x", "Raio-X"], ["mamografia", "Mamografia"], ["hemograma", "Hemograma completo"]].find(([key]) => normalized.includes(key))?.[1];
  const patientMatch = rawText.match(/(?:paciente|nome)[:\s]+([A-Za-zÀ-ÿ\s]{5,80})/i);
  const doctorMatch = rawText.match(/(?:medico|solicitante|dr\.?)[:\s]+([A-Za-zÀ-ÿ\s]{3,80})/i);
  const dateMatch = rawText.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
  const preference = extractWhatsappSchedulePreference(rawText);
  const confidence = Math.min(0.95, 0.35 + (matchedProcedure ? 0.28 : 0) + (patientMatch ? 0.18 : 0) + (doctorMatch ? 0.1 : 0) + (rawText.length > 20 ? 0.08 : 0));
  return {
    rawText,
    procedureName: matchedProcedure,
    patientName: patientMatch?.[1]?.trim(),
    requestingDoctor: doctorMatch?.[1]?.trim(),
    preferredDate: dateMatch?.[1] ?? preference.preferredDate,
    preferredPeriod: preference.preferredPeriod,
    requiresAuthorization: normalized.includes("convenio") || normalized.includes("guia"),
    confidence
  };
}

function createWhatsappTask({ request, user, conversation, message, intent, action, confidence, status, reply, orderData, appointmentId }) {
  const task = create("relationship_whatsapp_tasks", {
    id: id("wat"),
    clinicId: clinicId(request),
    conversationId: conversation.id,
    phone: conversation.phone,
    contactName: conversation.contactName,
    intent,
    action,
    confidence,
    status,
    reply,
    orderData,
    appointmentId,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString()
  });
  create("relationship_whatsapp_conversations", {
    ...conversation,
    lastIntent: intent,
    lastAction: action,
    status: conversation.automationPaused ? "human_assigned" : status === "completed" ? "resolved" : "open",
    updatedAt: new Date().toISOString()
  });
  return task;
}

async function createWhatsappOutbound(conversationId, phone, text, agent, request, user, config = getWhatsappConfig()) {
  const shouldBlock = shouldBlockWhatsappAutoSend(agent);
  const agentMode = config.agentMode ?? "automatic";
  const profileBlock = hasBlockingWhatsappDeliveryIssue(conversationId, phone);
  const status = profileBlock ? "blocked_profile" : shouldBlock ? "blocked_review" : agentMode === "manual" ? "draft" : agentMode === "supervised" ? "pending_approval" : "queued";
  const message = create("relationship_whatsapp_messages", {
    id: id("wam"),
    clinicId: clinicId(request),
    conversationId,
    direction: "outbound",
    provider: config.provider,
    toPhone: phone,
    messageType: "text",
    text,
    agentIntent: agent.intent,
    agentAction: agent.action,
    status,
    attempts: 0,
    maxAttempts: Number(config.retryLimit ?? 3),
    approvalRequired: ["blocked_profile", "blocked_review", "pending_approval", "draft"].includes(status),
    profileBlockIssueId: profileBlock?.id,
    failureCategory: profileBlock ? "profile_issue" : undefined,
    failureHint: profileBlock ? "Corrigir telefone/WhatsApp na pendencia cadastral antes de liberar envio." : undefined,
    error: profileBlock ? "Envio bloqueado por pendencia cadastral de telefone." : undefined,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.outbound_queued", message, { action: agent.action, status: message.status, agentMode });
  if (profileBlock) {
    auditWhatsapp(request, user, "whatsapp.outbound_blocked_profile_issue", message, { profileUpdateId: profileBlock.id, toPhone: phone });
    return message;
  }
  if (shouldBlock || agentMode !== "automatic" || !config.autoSendEnabled) return message;
  return sendWhatsappMessage(message, request, user);
}

function shouldBlockWhatsappAutoSend(agent) {
  return agent.status === "needs_review" || ["human_review", "not_found"].includes(agent.action);
}

function hasBlockingWhatsappDeliveryIssue(conversationId, phone) {
  const normalized = normalizePhone(phone);
  return list("relationship_whatsapp_profile_updates").find((item) =>
    item.status === "pending"
    && item.source === "whatsapp_delivery_failure"
    && (
      (conversationId && item.conversationId === conversationId)
      || (normalized && normalizePhone(item.currentValue) === normalized)
      || (normalized && normalizePhone(item.phone) === normalized)
    )
  );
}

function resolveWhatsappOutboundFailure(message, note, request, user) {
  const resolved = updateWhatsappMessageStatus(message, {
    status: "resolved_failure",
    failureResolvedBy: user.id,
    failureResolvedByName: user.name,
    failureResolvedAt: new Date().toISOString(),
    failureResolutionNote: note,
    error: message.error
  }, request, user, false);
  auditWhatsapp(request, user, "whatsapp.outbound_failure_resolved", resolved, {
    messageId: resolved.id,
    conversationId: resolved.conversationId,
    previousError: message.error,
    note
  });
  return resolved;
}

function whatsappOutbox() {
  return list("relationship_whatsapp_messages")
    .filter((message) => message.direction === "outbound")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
    .slice(0, 120);
}

function buildWhatsappSupervision() {
  const conversations = list("relationship_whatsapp_conversations");
  const messages = list("relationship_whatsapp_messages");
  const tasks = list("relationship_whatsapp_tasks");
  const outbox = messages.filter((message) => message.direction === "outbound");
  const rows = conversations.map((conversation) => {
    const conversationMessages = messages.filter((message) => message.conversationId === conversation.id)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    const latestTask = tasks.filter((task) => task.conversationId === conversation.id)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
    const pendingOutbound = outbox
      .filter((message) => message.conversationId === conversation.id && ["blocked_profile", "blocked_review", "pending_approval", "draft", "failed"].includes(message.status))
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
    const risk = pendingOutbound?.status === "blocked_review" || latestTask?.status === "needs_review"
      ? "review"
      : ["failed", "blocked_profile"].includes(pendingOutbound?.status)
        ? "delivery"
        : conversation.automationPaused
          ? "manual"
          : "normal";
    return {
      ...conversation,
      latestMessage: conversationMessages[0],
      latestTask,
      pendingOutbound,
      risk
    };
  }).sort((a, b) => new Date(b.lastMessageAt ?? b.updatedAt ?? 0).getTime() - new Date(a.lastMessageAt ?? a.updatedAt ?? 0).getTime());
  return {
    rows: rows.slice(0, 80),
    summary: {
      total: rows.length,
      review: rows.filter((row) => row.risk === "review").length,
      manual: rows.filter((row) => row.automationPaused).length,
      failed: outbox.filter((message) => message.status === "failed").length,
      pendingApproval: outbox.filter((message) => ["blocked_profile", "blocked_review", "pending_approval", "draft"].includes(message.status)).length
    },
    updatedAt: new Date().toISOString()
  };
}

function buildWhatsappAutonomyReviews() {
  const conversations = Object.fromEntries(list("relationship_whatsapp_conversations").map((conversation) => [conversation.id, conversation]));
  const messages = list("relationship_whatsapp_messages");
  const latestMessages = latestWhatsappItemsByConversation(messages.filter((message) => message.direction === "inbound"));
  const pendingOutbound = latestWhatsappItemsByConversation(messages.filter((message) => message.direction === "outbound" && ["blocked_profile", "blocked_review", "pending_approval", "draft", "failed", "queued"].includes(message.status)));
  const rows = list("relationship_whatsapp_tasks")
    .filter((task) => task.action === "autonomy_review")
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map((task) => {
      const conversation = conversations[task.conversationId] ?? {};
      return {
        ...task,
        conversation,
        latestMessage: latestMessages[task.conversationId],
        pendingOutbound: pendingOutbound[task.conversationId],
        ruleId: task.orderData?.autonomyRuleId,
        ruleName: task.orderData?.autonomyRuleName,
        ruleCondition: task.orderData?.autonomyRuleCondition,
        requestedAction: task.orderData?.requestedAction ?? inferWhatsappAutonomyRequestedAction(task),
        severity: task.orderData?.autonomyRuleCondition === "sensitive_words" || task.orderData?.autonomyRuleCondition === "identity_unconfirmed" ? "high" : "medium"
      };
    });
  const pending = rows.filter((row) => row.status === "needs_review");
  return {
    rows: rows.slice(0, 80),
    summary: {
      total: rows.length,
      pending: pending.length,
      approved: rows.filter((row) => row.status === "approved" || row.status === "completed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      high: pending.filter((row) => row.severity === "high").length
    },
    updatedAt: new Date().toISOString()
  };
}

function inferWhatsappAutonomyRequestedAction(task = {}) {
  if (task.intent === "cancel") return "cancel";
  if (task.intent === "order_photo") return "order_photo";
  if (task.intent === "schedule") return "schedule";
  return "message";
}

function buildWhatsappExceptionQueue() {
  const conversations = list("relationship_whatsapp_conversations");
  const messages = list("relationship_whatsapp_messages");
  const tasks = list("relationship_whatsapp_tasks");
  const ocrItems = list("relationship_whatsapp_ocr");
  const consents = list("relationship_whatsapp_consents");
  const profileUpdates = list("relationship_whatsapp_profile_updates");
  const byConversation = Object.fromEntries(conversations.map((conversation) => [conversation.id, conversation]));
  const latestMessages = latestWhatsappItemsByConversation(messages);
  const items = [];
  const seen = new Set();
  const add = (item) => {
    const key = `${item.type}:${item.resourceId ?? item.conversationId ?? item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: item.id ?? key,
      title: item.title,
      type: item.type,
      severity: item.severity ?? "medium",
      reason: item.reason,
      actionHint: item.actionHint,
      conversationId: item.conversationId,
      contactName: item.contactName,
      phone: item.phone,
      patientName: item.patientName,
      resourceId: item.resourceId,
      resourceStatus: item.resourceStatus,
      createdAt: item.createdAt,
      latestMessage: item.latestMessage
    });
  };

  for (const conversation of conversations) {
    const latestMessage = latestMessages[conversation.id];
    if (conversation.patientIdentityStatus === "duplicate" || conversation.status === "identity_review") {
      add({
        type: "identity",
        severity: "high",
        title: "Identidade precisa de conferencia",
        reason: conversation.patientIdentityStatus === "duplicate" ? "Mais de um cadastro encontrado para o contato." : "Dados de identidade nao conferem.",
        actionHint: "Assumir a conversa e confirmar cadastro antes de liberar o agente.",
        conversationId: conversation.id,
        contactName: conversation.contactName,
        phone: conversation.phone,
        patientName: conversation.patientName,
        resourceId: conversation.id,
        resourceStatus: conversation.status,
        createdAt: conversation.updatedAt ?? conversation.lastMessageAt,
        latestMessage
      });
    }
    if (conversation.whatsappConsentStatus === "rejected") {
      add({
        type: "lgpd",
        severity: "high",
        title: "LGPD recusado no WhatsApp",
        reason: "Paciente recusou continuar pelo agente automatico neste canal.",
        actionHint: "Continuar por atendimento humano ou outro canal permitido.",
        conversationId: conversation.id,
        contactName: conversation.contactName,
        phone: conversation.phone,
        patientName: conversation.patientName,
        resourceId: conversation.whatsappConsentId ?? conversation.id,
        resourceStatus: conversation.whatsappConsentStatus,
        createdAt: conversation.whatsappConsentAt ?? conversation.updatedAt,
        latestMessage
      });
    }
    if (conversation.whatsappConsentStatus === "requested") {
      add({
        type: "lgpd",
        severity: "medium",
        title: "Aguardando consentimento LGPD",
        reason: "Agente pediu ciencia para uso do WhatsApp e ainda aguarda resposta.",
        actionHint: "Acompanhar ou assumir caso o paciente esteja travado.",
        conversationId: conversation.id,
        contactName: conversation.contactName,
        phone: conversation.phone,
        patientName: conversation.patientName,
        resourceId: conversation.whatsappConsentId ?? conversation.id,
        resourceStatus: conversation.whatsappConsentStatus,
        createdAt: conversation.whatsappConsentAt ?? conversation.updatedAt,
        latestMessage
      });
    }
  }

  for (const task of tasks) {
    const conversation = byConversation[task.conversationId] ?? {};
    const isReview = task.status === "needs_review" || ["human_review", "autonomy_review", "identity_review", "identity_update_review", "insurance_review", "consent_rejected", "not_found"].includes(task.action);
    const isInsurance = ["insurance_pending", "insurance_review"].includes(task.action);
    if (isReview || isInsurance) {
      add({
        type: isInsurance ? "insurance" : "review",
        severity: task.action === "consent_rejected" || task.action === "identity_review" ? "high" : "medium",
        title: isInsurance ? "Convenio/autorizacao pendente" : "Revisao humana do agente",
        reason: task.reply ?? whatsappActionLabelForException(task.action),
        actionHint: isInsurance ? "Conferir cadastro, guia ou senha antes de prosseguir." : "Assumir ou resolver a conversa na supervisao.",
        conversationId: task.conversationId,
        contactName: task.contactName ?? conversation.contactName,
        phone: task.phone ?? conversation.phone,
        patientName: conversation.patientName,
        resourceId: task.id,
        resourceStatus: task.status,
        createdAt: task.createdAt,
        latestMessage: latestMessages[task.conversationId]
      });
    }
  }

  for (const message of messages.filter((item) => item.direction === "outbound" && ["failed", "blocked_profile", "blocked_review", "pending_approval", "draft"].includes(item.status))) {
    const conversation = byConversation[message.conversationId] ?? {};
    const diagnosis = classifyWhatsappDeliveryFailure(message);
    add({
      type: "delivery",
      severity: ["failed", "blocked_profile"].includes(message.status) ? "high" : "medium",
      title: message.status === "blocked_profile" ? "Envio bloqueado por cadastro" : message.status === "failed" ? `Falha no envio: ${diagnosis.label}` : "Resposta aguardando aprovacao",
      reason: ["failed", "blocked_profile"].includes(message.status) ? message.error ?? diagnosis.label : message.text ?? "Mensagem de saida pendente.",
      actionHint: message.status === "blocked_profile" ? "Corrigir o telefone na pendencia cadastral antes de reenviar." : message.status === "failed" ? diagnosis.hint : "Aprovar, editar ou assumir a conversa.",
      conversationId: message.conversationId,
      contactName: conversation.contactName,
      phone: message.toPhone ?? conversation.phone,
      patientName: conversation.patientName,
      resourceId: message.id,
      resourceStatus: message.status,
      createdAt: message.updatedAt ?? message.createdAt,
      latestMessage: latestMessages[message.conversationId]
    });
  }

  for (const ocr of ocrItems.filter((item) => ["failed", "pending_media"].includes(item.status) || Number(item.confidence ?? 1) < 0.65)) {
    const conversation = byConversation[ocr.conversationId] ?? {};
    add({
      type: "ocr",
      severity: ocr.status === "failed" ? "high" : "medium",
      title: "OCR do pedido precisa de revisao",
      reason: ocr.error ?? ocr.text ?? "Confianca baixa ou midia indisponivel.",
      actionHint: "Conferir a imagem/pedido antes de seguir com agendamento.",
      conversationId: ocr.conversationId,
      contactName: ocr.contactName ?? conversation.contactName,
      phone: ocr.fromPhone ?? conversation.phone,
      patientName: conversation.patientName,
      resourceId: ocr.id,
      resourceStatus: ocr.status,
      createdAt: ocr.createdAt,
      latestMessage: latestMessages[ocr.conversationId]
    });
  }

  for (const update of profileUpdates.filter((item) => item.status === "pending")) {
    add({
      type: "profile",
      severity: "medium",
      title: "Pendencia cadastral",
      reason: update.reason ?? "Dado informado pelo paciente precisa de revisao.",
      actionHint: "Revisar o cadastro antes de atualizar dados sensiveis.",
      conversationId: update.conversationId,
      contactName: update.patientName,
      phone: update.phone,
      patientName: update.patientName,
      resourceId: update.id,
      resourceStatus: update.status,
      createdAt: update.createdAt,
      latestMessage: latestMessages[update.conversationId]
    });
  }

  for (const consent of consents.filter((item) => ["rejected", "requested"].includes(item.status))) {
    const conversation = byConversation[consent.conversationId] ?? {};
    add({
      type: "lgpd",
      severity: consent.status === "rejected" ? "high" : "medium",
      title: consent.status === "rejected" ? "Consentimento LGPD recusado" : "Consentimento LGPD solicitado",
      reason: consent.status === "rejected" ? "Paciente nao autorizou seguir pelo WhatsApp." : "Aguardando resposta do paciente.",
      actionHint: consent.status === "rejected" ? "Manter atendimento humano." : "Acompanhar resposta ou assumir conversa.",
      conversationId: consent.conversationId,
      contactName: consent.contactName ?? conversation.contactName,
      phone: consent.phone ?? conversation.phone,
      patientName: consent.patientName ?? conversation.patientName,
      resourceId: consent.id,
      resourceStatus: consent.status,
      createdAt: consent.updatedAt ?? consent.createdAt,
      latestMessage: latestMessages[consent.conversationId]
    });
  }

  const ordered = items.sort((a, b) => {
    const severityScore = { high: 3, medium: 2, low: 1 };
    const severityDiff = (severityScore[b.severity] ?? 0) - (severityScore[a.severity] ?? 0);
    if (severityDiff) return severityDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
  return {
    summary: {
      total: ordered.length,
      high: ordered.filter((item) => item.severity === "high").length,
      review: ordered.filter((item) => item.type === "review").length,
      lgpd: ordered.filter((item) => item.type === "lgpd").length,
      delivery: ordered.filter((item) => item.type === "delivery").length,
      insurance: ordered.filter((item) => item.type === "insurance").length
    },
    items: ordered.slice(0, 120),
    updatedAt: new Date().toISOString()
  };
}

function latestWhatsappItemsByConversation(items) {
  const latest = {};
  for (const item of items) {
    if (!item.conversationId) continue;
    const current = latest[item.conversationId];
    if (!current || new Date(item.createdAt ?? item.updatedAt ?? 0).getTime() > new Date(current.createdAt ?? current.updatedAt ?? 0).getTime()) {
      latest[item.conversationId] = item;
    }
  }
  return latest;
}

function whatsappActionLabelForException(action) {
  const labels = {
    consent_rejected: "Paciente recusou consentimento LGPD.",
    human_review: "Fluxo exige revisao humana.",
    autonomy_review: "Regra de autonomia bloqueou a acao automatica.",
    identity_review: "Identidade precisa de conferencia.",
    identity_update_review: "Dados informados divergem do cadastro.",
    insurance_review: "Convenio precisa de revisao.",
    not_found: "Agente nao encontrou registro local."
  };
  return labels[action] ?? "Excecao do agente.";
}

async function approveWhatsappAutonomyReview(taskId, note, user, request) {
  const task = get("relationship_whatsapp_tasks", taskId);
  if (!task || task.action !== "autonomy_review") return undefined;
  const conversation = get("relationship_whatsapp_conversations", task.conversationId);
  if (!conversation) return undefined;
  const approvedAt = new Date().toISOString();
  const approvedTask = create("relationship_whatsapp_tasks", {
    ...task,
    status: "approved",
    approvedBy: user.id,
    approvedByName: user.name,
    approvedAt,
    approvalNote: note,
    updatedAt: approvedAt
  });
  const releasedConversation = create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "open",
    automationPaused: false,
    assignedTo: undefined,
    assignedToName: undefined,
    assignedAt: undefined,
    updatedAt: approvedAt
  });
  auditWhatsapp(request, user, "whatsapp.autonomy_rule_approved", approvedTask, {
    conversationId: releasedConversation.id,
    ruleId: task.orderData?.autonomyRuleId,
    ruleName: task.orderData?.autonomyRuleName,
    requestedAction: task.orderData?.requestedAction ?? inferWhatsappAutonomyRequestedAction(task)
  });
  const continuation = await continueWhatsappAfterAutonomyApproval(approvedTask, releasedConversation, request, user);
  return { task: approvedTask, conversation: releasedConversation, ...continuation };
}

function rejectWhatsappAutonomyReview(taskId, note, user, request) {
  const task = get("relationship_whatsapp_tasks", taskId);
  if (!task || task.action !== "autonomy_review") return undefined;
  const conversation = get("relationship_whatsapp_conversations", task.conversationId);
  const rejectedAt = new Date().toISOString();
  const rejectedTask = create("relationship_whatsapp_tasks", {
    ...task,
    status: "rejected",
    rejectedBy: user.id,
    rejectedByName: user.name,
    rejectedAt,
    rejectionNote: note,
    updatedAt: rejectedAt
  });
  const assigned = conversation ? create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "human_assigned",
    automationPaused: true,
    assignedTo: user.id,
    assignedToName: user.name,
    assignedAt: conversation.assignedAt ?? rejectedAt,
    updatedAt: rejectedAt
  }) : undefined;
  auditWhatsapp(request, user, "whatsapp.autonomy_rule_rejected", rejectedTask, {
    conversationId: task.conversationId,
    ruleId: task.orderData?.autonomyRuleId,
    ruleName: task.orderData?.autonomyRuleName,
    requestedAction: task.orderData?.requestedAction ?? inferWhatsappAutonomyRequestedAction(task)
  });
  return { task: rejectedTask, conversation: assigned };
}

async function continueWhatsappAfterAutonomyApproval(task, conversation, request, user) {
  const config = getWhatsappConfig();
  const requestedAction = task.orderData?.requestedAction ?? inferWhatsappAutonomyRequestedAction(task);
  const latestInbound = latestWhatsappInboundMessage(conversation.id) ?? {};
  const message = {
    provider: latestInbound.provider ?? config.provider,
    fromPhone: conversation.phone,
    contactName: conversation.contactName,
    messageType: latestInbound.messageType ?? "text",
    text: latestInbound.text ?? task.orderData?.rawText ?? "",
    caption: latestInbound.caption,
    extractedText: latestInbound.extractedText,
    patientId: conversation.patientId,
    patientName: conversation.patientName,
    patientDocumentNumber: conversation.patientDocumentNumber,
    patientBirthDate: conversation.patientBirthDate,
    patientMatchedBy: conversation.patientMatchedBy,
    patientIdentityStatus: conversation.patientIdentityStatus
  };
  if (requestedAction === "schedule" || requestedAction === "order_photo") {
    const agent = scheduleWhatsappAppointment(message, conversation, task.orderData ?? {}, config, request, user, requestedAction === "order_photo" ? "order_photo" : "schedule", undefined, { bypassAutonomy: true });
    const outbound = config.autoReplyEnabled ? await createWhatsappOutbound(conversation.id, conversation.phone, agent.reply, agent, request, user, config) : undefined;
    return { continuationTask: agent, outbound };
  }
  if (requestedAction === "cancel") {
    const agent = cancelWhatsappAppointment(message, conversation, request, user, undefined, { bypassAutonomy: true });
    const outbound = config.autoReplyEnabled ? await createWhatsappOutbound(conversation.id, conversation.phone, agent.reply, agent, request, user, config) : undefined;
    return { continuationTask: agent, outbound };
  }
  const outbound = await approveLatestWhatsappAutonomyOutbound(conversation.id, request, user);
  return { outbound };
}

function latestWhatsappInboundMessage(conversationId) {
  return list("relationship_whatsapp_messages")
    .filter((message) => message.conversationId === conversationId && message.direction === "inbound")
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
}

async function approveLatestWhatsappAutonomyOutbound(conversationId, request, user) {
  const message = list("relationship_whatsapp_messages")
    .filter((item) => item.conversationId === conversationId && item.direction === "outbound" && ["blocked_review", "pending_approval", "draft", "queued"].includes(item.status))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
  if (!message) return undefined;
  const approved = updateWhatsappMessageStatus(message, {
    status: "queued",
    approvalRequired: false,
    approvedBy: user.id,
    approvedByName: user.name,
    approvedAt: new Date().toISOString(),
    error: undefined
  }, request, user);
  return sendWhatsappMessage(approved, request, user, { force: true });
}

function assumeWhatsappConversation(conversationId, user, request) {
  const conversation = get("relationship_whatsapp_conversations", conversationId);
  if (!conversation) return undefined;
  const updated = create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "human_assigned",
    automationPaused: true,
    assignedTo: user.id,
    assignedToName: user.name,
    assignedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.conversation_assumed", updated, { automationPaused: true });
  return updated;
}

function releaseWhatsappConversation(conversationId, user, request) {
  const conversation = get("relationship_whatsapp_conversations", conversationId);
  if (!conversation) return undefined;
  const updated = create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "open",
    automationPaused: false,
    releasedBy: user.id,
    releasedByName: user.name,
    releasedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.conversation_released", updated, { automationPaused: false });
  return updated;
}

function resolveWhatsappConversation(conversationId, user, request) {
  const conversation = get("relationship_whatsapp_conversations", conversationId);
  if (!conversation) return undefined;
  const updated = create("relationship_whatsapp_conversations", {
    ...conversation,
    status: "resolved",
    automationPaused: false,
    resolvedBy: user.id,
    resolvedByName: user.name,
    resolvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.conversation_resolved", updated, {});
  return updated;
}

async function createManualWhatsappReply(conversationId, text, user, request) {
  const conversation = get("relationship_whatsapp_conversations", conversationId);
  if (!conversation || !String(text).trim()) return undefined;
  const message = create("relationship_whatsapp_messages", {
    id: id("wam"),
    clinicId: clinicId(request),
    conversationId,
    direction: "outbound",
    provider: getWhatsappConfig().provider,
    toPhone: conversation.phone,
    messageType: "text",
    text: String(text).trim(),
    agentIntent: "human",
    agentAction: "manual_reply",
    status: "queued",
    attempts: 0,
    maxAttempts: Number(getWhatsappConfig().retryLimit ?? 3),
    createdBy: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString()
  });
  auditWhatsapp(request, user, "whatsapp.manual_reply_created", message, { conversationId });
  return sendWhatsappMessage(message, request, user, { force: true });
}

async function getEvolutionStatus(config = getWhatsappConfig()) {
  if (config.provider !== "evolution-api") {
    return { ok: false, status: "provider_disabled", message: "Provedor atual nao e Evolution API." };
  }
  const root = await evolutionRequest(config, "/");
  const instances = root.ok ? await evolutionRequest(config, `/instance/fetchInstances?instanceName=${encodeURIComponent(config.evolutionInstance)}`) : undefined;
  const connection = root.ok ? await evolutionRequest(config, `/instance/connectionState/${encodeURIComponent(config.evolutionInstance)}`) : undefined;
  return {
    ok: Boolean(root.ok),
    status: root.ok ? "reachable" : "unreachable",
    baseUrl: config.evolutionBaseUrl,
    instance: config.evolutionInstance,
    root: root.payload,
    rootError: root.error,
    connection: connection?.payload,
    connectionError: connection?.error,
    instances: instances?.payload,
    checkedAt: new Date().toISOString()
  };
}

async function createEvolutionInstance(request, user, config = getWhatsappConfig()) {
  const webhookUrl = `${dockerReachablePublicBaseUrl()}/webhooks/relationship/whatsapp/evolution`;
  const payload = {
    instanceName: config.evolutionInstance,
    integration: "WHATSAPP-BAILEYS",
    token: config.evolutionApiKey,
    qrcode: true,
    rejectCall: true,
    msgCall: "No momento atendemos por mensagem. Envie sua solicitacao por aqui.",
    groupsIgnore: true,
    alwaysOnline: true,
    readMessages: true,
    readStatus: true,
    webhook: {
      url: webhookUrl,
      byEvents: true,
      base64: true,
      headers: {
        "Content-Type": "application/json",
        "x-whatsapp-secret": config.webhookSecret
      },
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "SEND_MESSAGE", "QRCODE_UPDATED"]
    }
  };
  const result = await evolutionRequest(config, "/instance/create", { method: "POST", body: payload });
  auditWhatsapp(request, user, "whatsapp.evolution_instance_created", { id: config.evolutionInstance }, { ok: result.ok, status: result.httpStatus, error: result.error });
  return { ...result, instance: config.evolutionInstance, webhookUrl };
}

function dockerReachablePublicBaseUrl() {
  return publicBaseUrl
    .replace("http://localhost:", "http://host.docker.internal:")
    .replace("http://127.0.0.1:", "http://host.docker.internal:");
}

async function connectEvolutionInstance(number, config = getWhatsappConfig()) {
  const query = number ? `?number=${encodeURIComponent(normalizePhone(number))}` : "";
  const result = await evolutionRequest(config, `/instance/connect/${encodeURIComponent(config.evolutionInstance)}${query}`);
  return { ...result, instance: config.evolutionInstance };
}

async function evolutionRequest(config, path, options = {}) {
  if (!config.evolutionBaseUrl || !config.evolutionApiKey) {
    return { ok: false, status: "missing_config", error: "Evolution URL ou API key nao configurados." };
  }
  try {
    const response = await fetch(`${String(config.evolutionBaseUrl).replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", apikey: config.evolutionApiKey },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
    return {
      ok: response.ok,
      httpStatus: response.status,
      payload,
      error: response.ok ? undefined : payload?.message ?? payload?.error ?? `Evolution API HTTP ${response.status}`
    };
  } catch (error) {
    return { ok: false, status: "network_error", error: error instanceof Error ? error.message : "Falha ao acessar Evolution API." };
  }
}

async function sendWhatsappMessage(message, request, user, options = {}) {
  const config = getWhatsappConfig();
  const attempts = Number(message.attempts ?? 0) + 1;
  const maxAttempts = Number(message.maxAttempts ?? config.retryLimit ?? 3);
  if (!options.force && message.status === "blocked_review") {
    return updateWhatsappMessageStatus(message, {
      status: "blocked_review",
      attempts: Number(message.attempts ?? 0),
      error: "Resposta bloqueada para revisao humana."
    }, request, user);
  }
  if (!options.ignoreProfileBlock) {
    const profileBlock = hasBlockingWhatsappDeliveryIssue(message.conversationId, message.toPhone);
    if (profileBlock) {
      const blocked = updateWhatsappMessageStatus(message, {
        status: "blocked_profile",
        attempts: Number(message.attempts ?? 0),
        profileBlockIssueId: profileBlock.id,
        failureCategory: "profile_issue",
        failureHint: "Corrigir telefone/WhatsApp na pendencia cadastral antes de liberar envio.",
        error: "Envio bloqueado por pendencia cadastral de telefone."
      }, request, user);
      auditWhatsapp(request, user, "whatsapp.outbound_blocked_profile_issue", blocked, {
        profileUpdateId: profileBlock.id,
        toPhone: message.toPhone
      });
      return blocked;
    }
  }
  if (attempts > maxAttempts) {
    return updateWhatsappMessageStatus(message, {
      status: "failed",
      attempts: attempts - 1,
      error: `Limite de ${maxAttempts} tentativa(s) atingido.`,
      failureCategory: "retry_limit",
      failureHint: "Revisar manualmente antes de nova tentativa."
    }, request, user);
  }

  const phoneValidation = validateWhatsappDestinationPhone(message.toPhone);
  if (!phoneValidation.ok) {
    const failed = updateWhatsappMessageStatus(message, {
      status: "failed",
      attempts: Number(message.attempts ?? 0),
      failureCategory: phoneValidation.category,
      failureHint: phoneValidation.hint,
      error: phoneValidation.error
    }, request, user);
    auditWhatsapp(request, user, "whatsapp.outbound_send_blocked", failed, {
      category: phoneValidation.category,
      hint: phoneValidation.hint,
      toPhone: message.toPhone
    });
    ensureWhatsappDeliveryProfileIssue({
      request,
      user,
      message: failed,
      diagnosis: classifyWhatsappDeliveryFailure(failed)
    });
    return failed;
  }

  const sending = updateWhatsappMessageStatus(message, {
    status: "sending",
    provider: config.provider,
    attempts,
    lastAttemptAt: new Date().toISOString(),
    error: undefined
  }, request, user, false);

  const result = config.provider === "cloud-api"
    ? await sendWhatsappViaCloud(sending, config)
    : config.provider === "simulation"
      ? { ok: true, externalId: `sim-out-${Date.now()}`, providerResponse: { simulated: true } }
      : config.provider === "evolution-api"
        ? await sendWhatsappViaEvolution(sending, config)
        : { ok: false, error: `Envio direto por ${config.provider} ainda nao esta habilitado. Use Evolution API ou Meta Cloud API.` };

  const failureDiagnosis = result.ok ? undefined : classifyWhatsappDeliveryFailure({ ...sending, error: result.error, providerResponse: result.providerResponse });
  const updated = updateWhatsappMessageStatus(sending, {
    status: result.ok ? "sent" : "failed",
    sentAt: result.ok ? new Date().toISOString() : sending.sentAt,
    externalId: result.externalId ?? sending.externalId,
    providerResponse: result.providerResponse,
    error: result.ok ? undefined : result.error,
    failureCategory: failureDiagnosis?.category,
    failureHint: failureDiagnosis?.hint
  }, request, user);
  auditWhatsapp(request, user, "whatsapp.outbound_send_attempted", updated, { status: updated.status, provider: config.provider, error: updated.error });
  if (updated.status === "failed") {
    const diagnosis = classifyWhatsappDeliveryFailure(updated);
    if (["invalid_phone", "missing_country_code"].includes(diagnosis.category)) {
      ensureWhatsappDeliveryProfileIssue({ request, user, message: updated, diagnosis });
    }
  }
  return updated;
}

async function sendWhatsappViaEvolution(message, config) {
  if (!config.evolutionBaseUrl || !config.evolutionInstance || !config.evolutionApiKey) {
    return { ok: false, error: "Evolution API nao configurada." };
  }
  try {
    const endpoint = `${String(config.evolutionBaseUrl).replace(/\/$/, "")}/message/sendText/${encodeURIComponent(config.evolutionInstance)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.evolutionApiKey },
      body: JSON.stringify({ number: normalizePhone(message.toPhone), text: message.text })
    });
    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
    return {
      ok: response.ok,
      externalId: payload?.key?.id ?? payload?.messageId ?? payload?.id,
      providerResponse: payload,
      error: response.ok ? undefined : `Evolution API HTTP ${response.status}`
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar pela Evolution API." };
  }
}

async function sendWhatsappViaCloud(message, config) {
  if (!config.cloudPhoneNumberId || !config.cloudAccessToken) {
    return { ok: false, error: "Meta Cloud API nao configurada." };
  }
  try {
    const endpoint = `https://graph.facebook.com/${config.cloudGraphVersion ?? "v23.0"}/${encodeURIComponent(config.cloudPhoneNumberId)}/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.cloudAccessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(message.toPhone),
        type: "text",
        text: { body: message.text }
      })
    });
    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
    return {
      ok: response.ok,
      externalId: payload?.messages?.[0]?.id,
      providerResponse: payload,
      error: response.ok ? undefined : `Meta Cloud API HTTP ${response.status}`
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar pela Meta Cloud API." };
  }
}

function validateWhatsappDestinationPhone(value) {
  const digits = normalizePhone(value);
  if (!digits) {
    return { ok: false, category: "invalid_phone", error: "Destino WhatsApp vazio ou sem numeros.", hint: "Revisar cadastro do paciente antes de enviar." };
  }
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, category: "invalid_phone", error: `Destino WhatsApp invalido (${digits.length} digitos).`, hint: "Corrigir telefone para formato com DDI e DDD, ex.: 5562999999999." };
  }
  if (digits.startsWith("1029") || digits.startsWith("100") || digits.startsWith("0")) {
    return { ok: false, category: "invalid_phone", error: "Destino parece ser ID interno, protocolo ou numero sem formato telefonico.", hint: "Vincular conversa ao telefone real do paciente." };
  }
  if (digits.length <= 11 && !digits.startsWith("55")) {
    return { ok: false, category: "missing_country_code", error: "Destino sem DDI do pais.", hint: "Adicionar DDI antes do envio, ex.: 55 para Brasil." };
  }
  return { ok: true, phone: digits };
}

function classifyWhatsappDeliveryFailure(message = {}) {
  const phoneValidation = validateWhatsappDestinationPhone(message.toPhone);
  if (!phoneValidation.ok) return { category: phoneValidation.category, label: whatsappFailureCategoryLabel(phoneValidation.category), hint: phoneValidation.hint };
  const error = normalizeText(message.error ?? "");
  const provider = normalizeText(message.provider ?? "");
  if (error.includes("http 400")) return { category: "provider_bad_request", label: "Requisicao rejeitada", hint: "Nao insistir automaticamente; revisar numero, instancia e payload." };
  if (error.includes("http 401") || error.includes("http 403") || error.includes("api key") || error.includes("token")) return { category: "provider_auth", label: "Autenticacao do provedor", hint: "Revisar API key/token do conector." };
  if (error.includes("http 404") || error.includes("instance") || error.includes("instancia")) return { category: "instance_not_found", label: "Instancia indisponivel", hint: "Verificar se a instancia Evolution existe e esta conectada." };
  if (error.includes("http 500") || error.includes("network") || error.includes("falha ao enviar") || error.includes("fetch")) return { category: "provider_unavailable", label: "Provedor instavel", hint: "Testar conector e tentar novamente depois." };
  if (error.includes("limite")) return { category: "retry_limit", label: "Limite de tentativas", hint: "Assumir manualmente antes de nova tentativa." };
  return { category: provider ? "provider_unknown" : "unknown", label: whatsappFailureCategoryLabel(provider ? "provider_unknown" : "unknown"), hint: "Revisar detalhes do erro antes de reenviar." };
}

function whatsappFailureCategoryLabel(category) {
  const labels = {
    invalid_phone: "Telefone invalido",
    missing_country_code: "DDI ausente",
    profile_issue: "Pendencia cadastral",
    provider_bad_request: "Requisicao rejeitada",
    provider_auth: "Credencial do provedor",
    instance_not_found: "Instancia indisponivel",
    provider_unavailable: "Provedor instavel",
    retry_limit: "Limite de tentativas",
    provider_unknown: "Falha do provedor",
    unknown: "Falha desconhecida"
  };
  return labels[category] ?? category;
}

function updateWhatsappMessageStatus(message, patch, request, user, shouldAudit = true) {
  const updated = create("relationship_whatsapp_messages", {
    ...message,
    ...patch,
    updatedBy: user.id,
    updatedByName: user.name,
    updatedAt: new Date().toISOString()
  });
  if (shouldAudit) auditWhatsapp(request, user, "whatsapp.outbound_status_updated", updated, { status: updated.status, attempts: updated.attempts, error: updated.error });
  return updated;
}

function findOrCreateWhatsappPatient(message, orderData, request) {
  const phone = normalizePhone(message.fromPhone);
  const existing = message.patientId
    ? get("patients", message.patientId)
    : list("patients").find((item) =>
      phoneMatches(item.phone, message.fromPhone)
      || phoneMatches(item.mobile, message.fromPhone)
      || (orderData.cpf && (normalizeDocument(item.documentNumber) === orderData.cpf || normalizeDocument(item.cpf) === orderData.cpf))
      || normalizeText(item.fullName) === normalizeText(orderData.patientName)
    );
  if (existing) return existing;
  return create("patients", {
    id: id("pat"),
    clinicId: clinicId(request),
    fullName: orderData.patientName ?? message.contactName ?? "Paciente WhatsApp",
    documentNumber: orderData.documentNumber ?? orderData.cpf,
    birthDate: orderData.birthDate,
    phone: message.fromPhone,
    createdAt: new Date().toISOString()
  });
}

function buildAppointmentAvailability({ procedureName, preferredDate, preferredPeriod, limit = 6 } = {}) {
  const plan = buildWhatsappAppointmentPlan({ procedureName, preferredDate, preferredPeriod, limit });
  return {
    procedure: plan.procedure,
    rooms: plan.rooms,
    slots: plan.slots,
    selectedSlot: plan.slot,
    generatedAt: new Date().toISOString()
  };
}

function buildWhatsappAppointmentPlan(orderData = {}) {
  const procedure = resolveWhatsappProcedure(orderData.procedureName);
  const durationMinutes = procedureDurationMinutes(procedure);
  const modality = procedure.modality ?? inferModality(procedure.name, "");
  const rooms = compatibleWhatsappRooms(modality);
  const slots = findWhatsappAvailableSlots({
    procedure,
    rooms,
    durationMinutes,
    preferredDate: orderData.preferredDate,
    preferredPeriod: orderData.preferredPeriod,
    limit: Number(orderData.limit ?? 6)
  });
  const slot = slots[0] ?? fallbackWhatsappSlot(procedure, rooms[0], durationMinutes, orderData.preferredDate);
  const doctor = list("registry_doctors").find((item) => item.status !== "inactive");
  return {
    procedure,
    rooms,
    slots,
    slot,
    professionalId: doctor?.id ?? "whatsapp_agent",
    professionalName: doctor?.name ?? "Equipe de atendimento"
  };
}

function resolveWhatsappProcedure(procedureName = "") {
  const normalized = normalizeText(procedureName);
  const procedures = list("registry_procedures").filter((item) => item.status !== "inactive");
  const exact = procedures.find((item) => normalizeText(item.name) === normalized);
  const byName = procedures.find((item) => normalized && (normalized.includes(normalizeText(item.name)) || normalizeText(item.name).includes(normalized)));
  const byKeyword = procedures.find((item) => {
    const haystack = normalizeText(`${item.name} ${item.keywords ?? ""} ${item.modality ?? ""}`);
    return normalized && normalized.split(/\s+/).filter((part) => part.length > 2).some((part) => haystack.includes(part));
  });
  const alias = [
    ["tomografia", "CT", "Tomografia"],
    ["tc", "CT", "Tomografia"],
    ["ressonancia", "MR", "Ressonancia magnetica"],
    ["rm", "MR", "Ressonancia magnetica"],
    ["ultrassom", "US", "Ultrassom"],
    ["raio x", "CR", "Raio-X"],
    ["mamografia", "MG", "Mamografia"],
    ["hemograma", "OT", "Hemograma completo"]
  ].find(([key]) => normalized.includes(key));
  const aliasProcedure = alias ? procedures.find((item) => item.modality === alias[1] || normalizeText(`${item.name} ${item.keywords ?? ""}`).includes(alias[0])) : undefined;
  const selected = exact ?? byName ?? byKeyword ?? aliasProcedure;
  if (selected) return selected;
  return {
    id: "procedure_whatsapp_generic",
    name: procedureName || alias?.[2] || "Exame a definir",
    modality: alias?.[1] ?? "OT",
    duration: "30 min",
    status: "active"
  };
}

function procedureDurationMinutes(procedure = {}) {
  const match = String(procedure.duration ?? "").match(/(\d+)/);
  return Math.max(15, Math.min(180, Number(match?.[1] ?? 30)));
}

function findRegistryByName(collection, value) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  return list(collection).find((row) => row.status !== "inactive" && normalizeText(row.name ?? row.description ?? row.id) === normalized);
}

function compatibleWhatsappRooms(modality) {
  const rooms = list("registry_rooms").filter((room) => room.status !== "inactive");
  const compatible = rooms.filter((room) => !modality || modality === "OT" || room.modality === modality);
  return (compatible.length ? compatible : rooms).map((room) => ({
    id: room.id,
    name: room.name,
    roomName: room.name,
    modality: room.modality ?? modality ?? "OT",
    branchName: room.branch ?? "Matriz",
    unitName: room.unitName ?? room.branch ?? "Unidade principal",
    equipment: room.equipment
  }));
}

function findWhatsappAvailableSlots({ procedure, rooms, durationMinutes, preferredDate, preferredPeriod, limit = 6 }) {
  const slots = [];
  const startDate = parsePreferredDate(preferredDate) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  startDate.setMinutes(0, 0, 0);
  const activeAppointments = list("appointments").filter((appointment) => !["cancelled", "completed", "no_show"].includes(appointment.status));
  const candidateRooms = rooms.length ? rooms : compatibleWhatsappRooms(procedure.modality);
  const periods = whatsappPeriodWindow(preferredPeriod);
  for (let day = 0; day < 21 && slots.length < limit; day += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + day);
    if (date.getDay() === 0) continue;
    const [startHour, endHour] = periods;
    for (let hour = startHour; hour < endHour && slots.length < limit; hour += 1) {
      for (const minute of [0, 30]) {
        if (slots.length >= limit) break;
        const startsAt = new Date(date);
        startsAt.setHours(hour, minute, 0, 0);
        if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) continue;
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
        if (endsAt.getHours() > endHour || (endsAt.getHours() === endHour && endsAt.getMinutes() > 0)) continue;
        const room = candidateRooms.find((candidate) => !hasAppointmentConflict(activeAppointments, candidate.roomName, startsAt, endsAt));
        if (!room) continue;
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          durationMinutes,
          procedureName: procedure.name,
          modality: procedure.modality ?? room.modality ?? "OT",
          roomId: room.id,
          roomName: room.roomName,
          branchName: room.branchName,
          unitName: room.unitName,
          label: `${formatIsoForPatient(startsAt.toISOString())} - ${room.roomName}`
        });
      }
    }
  }
  return slots;
}

function hasAppointmentConflict(appointments, roomName, startsAt, endsAt) {
  return appointments.some((appointment) => {
    if (appointment.roomName !== roomName) return false;
    const currentStart = new Date(appointment.startsAt);
    const currentEnd = new Date(appointment.endsAt ?? new Date(currentStart.getTime() + 30 * 60 * 1000));
    return startsAt < currentEnd && endsAt > currentStart;
  });
}

function fallbackWhatsappSlot(procedure, room, durationMinutes, preferredDate) {
  const startsAt = nextWhatsappSlot(preferredDate);
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60 * 1000).toISOString();
  const fallbackRoom = room ?? { roomName: "Sala 01", modality: procedure.modality ?? "OT", branchName: "Matriz", unitName: "Unidade principal" };
  return {
    startsAt,
    endsAt,
    durationMinutes,
    procedureName: procedure.name,
    modality: procedure.modality ?? fallbackRoom.modality ?? "OT",
    roomId: fallbackRoom.id,
    roomName: fallbackRoom.roomName,
    branchName: fallbackRoom.branchName,
    unitName: fallbackRoom.unitName,
    label: `${formatIsoForPatient(startsAt)} - ${fallbackRoom.roomName}`
  };
}

function whatsappPeriodWindow(period) {
  const normalized = normalizeText(period);
  if (normalized.includes("manha")) return [8, 12];
  if (normalized.includes("tarde")) return [12, 18];
  if (normalized.includes("noite")) return [17, 20];
  return [8, 18];
}

function extractWhatsappSchedulePreference(text) {
  const normalized = normalizeText(text);
  const today = new Date();
  const target = new Date(today);
  let preferredDate;
  if (normalized.includes("depois de amanha")) {
    target.setDate(today.getDate() + 2);
    preferredDate = target.toISOString().slice(0, 10);
  } else if (normalized.includes("amanha")) {
    target.setDate(today.getDate() + 1);
    preferredDate = target.toISOString().slice(0, 10);
  }
  const preferredPeriod = normalized.includes("manha") ? "manha" : normalized.includes("tarde") ? "tarde" : normalized.includes("noite") ? "noite" : undefined;
  return { preferredDate, preferredPeriod };
}

function nextWhatsappSlot(preferredDate) {
  const date = parsePreferredDate(preferredDate) ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function parsePreferredDate(value) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T09:00:00`);
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(`${match[3]}-${match[2]}-${match[1]}T09:00:00`) : undefined;
}

function whatsappOcrAvailable(config = getWhatsappConfig()) {
  if (config.ocrEngine !== "tesseract-cli") return Boolean(config.ocrEngine);
  try {
    execFileSync("tesseract", ["--version"], { timeout: 3000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function whatsappMediaExtension(mimeType, mediaUrl = "") {
  const fromMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/tiff": ".tif",
    "application/pdf": ".pdf"
  }[String(mimeType).toLowerCase()];
  if (fromMime) return fromMime;
  const match = String(mediaUrl).match(/\.(jpg|jpeg|png|webp|tif|tiff|pdf)(?:\?|$)/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg").replace("tiff", "tif")}` : ".bin";
}

function estimateOcrTextConfidence(text) {
  const normalized = normalizeText(text);
  let score = 0.2;
  if (normalized.includes("paciente") || normalized.includes("nome")) score += 0.18;
  if (normalized.includes("procedimento") || normalized.includes("exame") || normalized.includes("solicito")) score += 0.18;
  if (normalized.includes("medico") || normalized.includes("solicitante") || normalized.includes("crm")) score += 0.14;
  if (normalized.includes("convenio") || normalized.includes("guia")) score += 0.08;
  if (String(text).length > 40) score += 0.12;
  if (String(text).length > 120) score += 0.1;
  return Math.min(0.95, score);
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizePhoneTail(value) {
  const digits = normalizePhone(value);
  if (digits.length < 8) return "";
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function normalizeDocument(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function whatsappConversationId(phone) {
  return `wa_${normalizePhone(phone) || "unknown"}`;
}

function formatIsoForPatient(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function auditWhatsapp(request, user, action, resource, details = {}) {
  const event = create("relationship_whatsapp_audit", {
    id: id("waa"),
    clinicId: clinicId(request),
    userId: user.id,
    userName: user.name,
    action,
    resourceId: resource.id,
    details,
    createdAt: new Date().toISOString()
  });
  logAudit(request, { user, action, resource: "relationship_whatsapp", resourceId: resource.id, details });
  return event;
}

function booleanValue(value, fallback = false) {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === "0") return false;
  return Boolean(fallback);
}

function simulateDicomStore(body) {
  const modality = optional(body.modality) ?? "MR";
  const patientName = optional(body.patientName) ?? "Paciente DICOM";
  const accessionNumber = optional(body.accessionNumber) ?? `ACC-${Date.now()}`;
  const studyInstanceUid = optional(body.studyInstanceUid) ?? dicomUid();
  const seriesCount = Number(body.seriesCount || 2);
  const instancesCount = Number(body.instancesCount || 96);
  const worklistOrder = buildWorklistOrders().find((order) => order.accessionNumber === accessionNumber);
  const didMatch = Boolean(worklistOrder);
  const modalityMatches = !worklistOrder || worklistOrder.modality === modality || (worklistOrder.modality === "DX" && modality === "RX");

  return {
    id: id("study"),
    clinicId: "clinic_demo",
    source: "simulated-c-store",
    pacsEngine: "orthanc",
    viewer: "ohif",
    patientId: optional(body.patientId) ?? `PID-${Math.floor(Math.random() * 90000 + 10000)}`,
    patientName,
    accessionNumber,
    studyInstanceUid,
    studyDescription: optional(body.studyDescription) ?? `${modality} - ${optional(body.bodyPart) ?? "Exame"}`,
    modality,
    bodyPart: optional(body.bodyPart) ?? "HEAD",
    seriesCount,
    instancesCount,
    status: "stored",
    reconciliationStatus: didMatch && modalityMatches ? "matched" : didMatch ? "modality_mismatch" : "orphan",
    matchedAppointmentId: worklistOrder?.appointmentId,
    matchedPatientId: worklistOrder?.patientId,
    matchedPatientName: worklistOrder?.patientName,
    matchedProcedureName: worklistOrder?.procedureName,
    matchedRoomName: worklistOrder?.roomName,
    matchedMwlStatus: worklistOrder?.mwlStatus,
    orthancStudyId: `orthanc-${studyInstanceUid.split(".").slice(-2).join("-")}`,
    viewerUrl: `/viewer/ohif?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`,
    receivedAt: new Date().toISOString()
  };
}

function dicomUid() {
  const now = Date.now();
  const random = Math.floor(Math.random() * 1000000000);
  return `2.25.${now}${random}`;
}

function inferRelationshipIntent(queueId, reason) {
  const normalizedReason = normalizeText(reason);
  if (normalizedReason.includes("remarcar") || normalizedReason.includes("agendar")) return "Agendamento";
  if (normalizedReason.includes("resultado") || normalizedReason.includes("laudo")) return "Resultado";
  if (normalizedReason.includes("valor") || normalizedReason.includes("pagamento") || normalizedReason.includes("nota")) return "Financeiro";
  const labels = {
    scheduling: "Agendamento",
    results: "Resultado",
    finance: "Financeiro",
    human: "Atendimento humano"
  };
  return labels[queueId] ?? "Relacionamento";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
