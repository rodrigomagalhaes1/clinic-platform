import { normalize } from "@clinic/shared";

const API_BASE_URL = window.location.origin;
const tokenKey = "clinic.session.token";
const sidebarPinnedKey = "clinic.sidebar.pinned";
const settingsPlanKey = "clinic.settings.readiness.plan";

const state = {
  token: localStorage.getItem(tokenKey),
  user: null,
  patients: [],
  appointments: [],
  frontdeskSnapshot: null,
  totemQueues: [],
  totemCounters: [],
  totemTickets: [],
  totemCalls: [],
  totemDisplay: null,
  totemDisplayConfig: null,
  totemAudit: [],
  worklist: [],
  pacsStudies: [],
  laboratoryOrders: [],
  laboratorySamples: [],
  laboratoryInterfaces: [],
  supportLabExams: [],
  invoices: [],
  billingBatches: [],
  billingDenials: [],
  doctorPayouts: [],
  finance: [],
  relationshipQueues: [],
  relationshipCalls: [],
  whatsappConfig: null,
  whatsappReadiness: null,
  whatsappSafetyDashboard: null,
  whatsappEvolution: null,
  whatsappEvolutionConnect: null,
  whatsappSupervision: null,
  whatsappExceptions: null,
  whatsappAutonomyReviews: null,
  whatsappProfileUpdates: [],
  whatsappConsents: [],
  whatsappFlows: [],
  whatsappTemplates: [],
  whatsappAutonomyRules: [],
  whatsappAutonomyProfiles: [],
  whatsappJourneys: [],
  whatsappAvailability: null,
  whatsappInsuranceValidation: null,
  whatsappPrepRules: [],
  whatsappConversations: [],
  whatsappMessages: [],
  whatsappOutbox: [],
  whatsappTasks: [],
  whatsappOcr: [],
  whatsappAudit: [],
  uraConfig: null,
  uraFlows: [],
  uraLiveCalls: [],
  uraAudit: [],
  uraReadiness: null,
  uraEvents: [],
  uraConnector: null,
  uraCommands: [],
  users: [],
  securityAudit: [],
  securityReadiness: null,
  securityDeployment: null,
  apiHealth: null,
  apiInfo: null,
  registries: [],
  registryData: {},
  navigationOverrides: [],
  appointmentNotes: [],
  appointmentAudit: [],
  deniedAccess: null,
  lastDeniedAuditKey: "",
  activeRoute: "dashboard",
  frontdeskFilters: {},
  walkinItems: [],
  selectedAppointmentId: "",
  selectedAppointmentDetailTab: "attendance",
  selectedRegistryType: "branches",
  registryEditingId: "",
  selectedWhatsappConversationId: "",
  selectedSettingsModule: "settings-attendance",
  pendingRouteFocus: "",
  settingsPendingOnly: false,
  settingsPlan: {},
  hrSearch: "",
  hrPageSize: 10,
  hrPage: 1,
  hrSortKey: "name",
  hrSortDir: "asc",
  hrAccessFilter: "all",
  hrPendingEditEmployeeId: "",
  hrPendingAccessEmployeeId: "",
  hrPendingAccessUserId: "",
  pendingRegistryDeleteId: "",
  registryDeleteResolver: null
};

const registryTypes = [
  "branches",
  "units",
  "rooms",
  "insurances",
  "plans",
  "procedures",
  "doctors",
  "employees",
  "user-groups",
  "financial-categories",
  "cost-centers",
  "accounts",
  "payment-methods"
];

const permissionCatalog = [
  ["restricted_hours_view", "Ver horarios restritos"],
  ["restricted_hours_schedule", "Agendar horario restrito"],
  ["schedule_reserve", "Reservar agenda"],
  ["cancel_attendance", "Cancelar atendimento"],
  ["cancel_executed_attendance", "Cancelar atendimento executado"],
  ["transfer_attendance", "Transferir atendimento"],
  ["billing_batches", "Lotes de faturamento"],
  ["denial_management", "Glosas"],
  ["financial_reconciliation", "Conciliação financeira"],
  ["lis_interface", "Interface LIS"],
  ["support_lab_receive", "Laboratório de apoio"],
  ["release_results", "Liberar resultados"],
  ["edit_privileges", "Editar privilégios"],
  ["stock_access", "Estoque"],
  ["purchase_access", "Compras"]
];

const routeMap = {
  dashboard: { section: "dashboard", parent: "dashboard", title: "Dashboard" },
  attendance: { section: "attendance", parent: "attendance", title: "Atendimento", subview: "frontdesk" },
  "attendance-walkin": { section: "attendance", parent: "attendance", title: "Atendimento - Encaixe", subview: "walkin" },
  "attendance-emergency": { section: "attendance", parent: "attendance", title: "Atendimento - Pronto Atendimento", subview: "emergency" },
  "attendance-frontdesk": { section: "attendance", parent: "attendance", title: "Atendimento · Recepção", subview: "frontdesk" },
  "attendance-patients": { section: "attendance", parent: "attendance", title: "Atendimento · Pacientes", subview: "patients" },
  "attendance-appointments": { section: "attendance", parent: "attendance", title: "Atendimento · Agenda", subview: "appointments" },
  "attendance-totem": { section: "attendance", parent: "attendance", title: "Atendimento · Totem", subview: "totem" },
  "attendance-detail": { section: "attendance", parent: "attendance", title: "Atendimento - Detalhe", subview: "detail" },
  imaging: { section: "imaging", parent: "imaging", title: "Central de Laudos" },
  "imaging-worklist": { section: "settings", parent: "settings", title: "Configurações - Central de Laudos - Worklist", subview: "imaging-worklist" },
  "imaging-pacs": { section: "settings", parent: "settings", title: "Configurações - Central de Laudos - PACS", subview: "imaging-pacs" },
  "imaging-reports": { section: "imaging", parent: "imaging", title: "Central de Laudos · Laudos", subview: "reports" },
  laboratory: { section: "laboratory", parent: "laboratory", title: "Laboratório" },
  "laboratory-orders": { section: "laboratory", parent: "laboratory", title: "Laboratório · Pedidos e coletas", subview: "orders" },
  "laboratory-lis": { section: "settings", parent: "settings", title: "Configurações · Laboratório · Interfaces LIS", subview: "laboratory-lis" },
  "laboratory-support": { section: "laboratory", parent: "laboratory", title: "Laboratório · Laboratório de apoio", subview: "support" },
  billing: { section: "billing", parent: "billing", title: "Faturamento" },
  "billing-invoices": { section: "billing", parent: "billing", title: "Faturamento · Faturas", subview: "invoices" },
  "billing-batches": { section: "billing", parent: "billing", title: "Faturamento · Lotes", subview: "batches" },
  "billing-denials": { section: "billing", parent: "billing", title: "Faturamento · Glosas", subview: "denials" },
  "billing-payouts": { section: "billing", parent: "billing", title: "Faturamento · Repasses", subview: "payouts" },
  finance: { section: "finance", parent: "finance", title: "Financeiro" },
  "finance-receivables": { section: "finance", parent: "finance", title: "Financeiro · A receber", subview: "receivables", financeDirection: "receivable" },
  "finance-payables": { section: "finance", parent: "finance", title: "Financeiro · A pagar", subview: "payables", financeDirection: "payable" },
  "finance-cash": { section: "finance", parent: "finance", title: "Financeiro · Caixa", subview: "cash" },
  "finance-reconciliation": { section: "finance", parent: "finance", title: "Financeiro · Conciliação", subview: "reconciliation", reconciliation: "pending" },
  relationship: { section: "relationship", parent: "relationship", title: "Relacionamento", subview: "ura" },
  "relationship-ura": { section: "relationship", parent: "relationship", title: "Relacionamento · URA", subview: "ura" },
  "relationship-whatsapp": { section: "relationship", parent: "relationship", title: "Relacionamento · WhatsApp", subview: "whatsapp" },
  "relationship-reputation": { section: "relationship", parent: "relationship", title: "Relacionamento · Reputação", subview: "reputation" },
  "relationship-social": { section: "relationship", parent: "relationship", title: "Relacionamento · Redes sociais", subview: "social" },
  "relationship-agent": { section: "relationship", parent: "relationship", title: "Relacionamento · Agente", subview: "agent" },
  security: { section: "security-users", parent: "settings", title: "Segurança", subview: "overview" },
  "security-users": { section: "security-users", parent: "settings", title: "Segurança · Usuários", subview: "users" },
  "security-permissions": { section: "security-users", parent: "settings", title: "Segurança · Grupos e permissões", subview: "permissions" },
  "security-system-state": { section: "security-users", parent: "settings", title: "Segurança · Estado do sistema", subview: "system-state" },
  "security-lgpd": { section: "security-users", parent: "settings", title: "Segurança · LGPD", subview: "lgpd" },
  "human-resources": { section: "human-resources", parent: "human-resources", title: "Recursos Humanos" },
  settings: { section: "settings", parent: "settings", title: "Configurações" },
  "settings-attendance": { section: "settings", parent: "settings", title: "Configurações · Atendimento", subview: "attendance" },
  "settings-registries": { section: "settings", parent: "settings", title: "Configurações · Cadastros", subview: "registries" },
  "settings-integrations": { section: "settings", parent: "settings", title: "Configurações · Integrações", subview: "integrations" },
  "settings-finance": { section: "settings", parent: "settings", title: "Configurações · Financeiro", subview: "finance" },
  "settings-relationship": { section: "settings", parent: "settings", title: "Configurações · Relacionamento", subview: "relationship" },
  "settings-security": { section: "settings", parent: "settings", title: "Configurações · Segurança", subview: "security" },
  "settings-imaging": { section: "settings", parent: "settings", title: "Configurações - Central de Laudos", subview: "imaging" },
  "settings-laboratory": { section: "settings", parent: "settings", title: "Configurações · Laboratório", subview: "laboratory" },
  "settings-menus": { section: "settings", parent: "settings", title: "Configurações · Menus do sistema", subview: "menus" },
  "access-denied": { section: "access-denied", parent: "access-denied", title: "Acesso negado" }
};

const navigationItems = [
  { route: "dashboard", label: "Dashboard", icon: "dashboard", order: 10 },
  {
    route: "attendance",
    label: "Atendimento",
    icon: "users",
    order: 20,
    children: [
      { route: "attendance-frontdesk", label: "Recepção", order: 10 },
      { route: "attendance-walkin", label: "Encaixe", order: 20 },
      { route: "attendance-emergency", label: "Pronto Atendimento", order: 30 },
      { route: "attendance-patients", label: "Pacientes", order: 40 },
      { route: "attendance-appointments", label: "Agenda", order: 50 },
      { route: "attendance-totem", label: "Totem", order: 60 }
    ]
  },
  {
    route: "imaging",
    label: "Central de Laudos",
    icon: "image",
    order: 30,
    children: [
      { route: "imaging-reports", label: "Laudos", order: 30 }
    ]
  },
  {
    route: "laboratory",
    label: "Laboratório",
    icon: "lab",
    order: 40,
    children: [
      { route: "laboratory-orders", label: "Pedidos e coletas", order: 10 },
      { route: "laboratory-support", label: "Laboratório de apoio", order: 30, permission: "support_lab_receive" }
    ]
  },
  {
    route: "billing",
    label: "Faturamento",
    icon: "bill",
    order: 50,
    children: [
      { route: "billing-invoices", label: "Faturas", order: 10 },
      { route: "billing-batches", label: "Lotes", order: 20, permission: "billing_batches" },
      { route: "billing-denials", label: "Glosas", order: 30, permission: "denial_management" },
      { route: "billing-payouts", label: "Repasses", order: 40 }
    ]
  },
  {
    route: "finance",
    label: "Financeiro",
    icon: "wallet",
    order: 60,
    children: [
      { route: "finance-receivables", label: "A receber", order: 10 },
      { route: "finance-payables", label: "A pagar", order: 20 },
      { route: "finance-cash", label: "Caixa", order: 30 },
      { route: "finance-reconciliation", label: "Conciliação", order: 40, permission: "financial_reconciliation" }
    ]
  },
  {
    route: "relationship",
    label: "Relacionamento",
    icon: "phone",
    parent: "relationship",
    order: 70,
    children: [
      { route: "relationship-ura", label: "URA", order: 10 },
      { route: "relationship-whatsapp", label: "WhatsApp", order: 20 },
      { route: "relationship-reputation", label: "Reputação", order: 30 },
      { route: "relationship-social", label: "Redes sociais", order: 40 },
      { route: "relationship-agent", label: "Agente", order: 50 }
    ]
  },
  { route: "human-resources", label: "Recursos Humanos", icon: "users", order: 80 },
  {
    route: "settings",
    label: "Configurações",
    icon: "settings",
    order: 90,
    children: [
      { route: "settings-attendance", label: "Atendimento", order: 10 },
      { route: "settings-imaging", label: "Central de Laudos", order: 20 },
      { route: "settings-laboratory", label: "Laboratório", order: 30 },
      { route: "settings-finance", label: "Financeiro", order: 40 },
      { route: "settings-relationship", label: "Relacionamento", order: 50 },
      { route: "settings-security", label: "Segurança", order: 60 },
      { route: "settings-registries", label: "Cadastros", order: 70 },
      { route: "settings-integrations", label: "Integrações", order: 80 },
      { route: "settings-menus", label: "Menus do sistema", order: 90 }
    ]
  }
];

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  sidebar: document.querySelector(".sidebar"),
  sidebarPinButton: document.querySelector("#sidebarPinButton"),
  mainNav: document.querySelector("#mainNav"),
  pageTitle: document.querySelector("#pageTitle"),
  sessionChip: document.querySelector("#sessionChip"),
  loginOverlay: document.querySelector("#loginOverlay"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  refreshButton: document.querySelector("#refreshButton"),
  logoutButton: document.querySelector("#logoutButton"),
  dashboardSummary: document.querySelector("#dashboardSummary"),
  dashboardAppointments: document.querySelector("#dashboardAppointments"),
  appointmentCount: document.querySelector("#appointmentCount"),
  patientForm: document.querySelector("#patientForm"),
  appointmentForm: document.querySelector("#appointmentForm"),
  frontdeskSummary: document.querySelector("#frontdeskSummary"),
  frontdeskActiveCount: document.querySelector("#frontdeskActiveCount"),
  frontdeskPendingCount: document.querySelector("#frontdeskPendingCount"),
  frontdeskFilteredCount: document.querySelector("#frontdeskFilteredCount"),
  frontdeskFilterForm: document.querySelector("#frontdeskFilterForm"),
  frontdeskSearch: document.querySelector("#frontdeskSearch"),
  frontdeskDateFrom: document.querySelector("#frontdeskDateFrom"),
  frontdeskDateTo: document.querySelector("#frontdeskDateTo"),
  frontdeskBranchFilter: document.querySelector("#frontdeskBranchFilter"),
  frontdeskUnitFilter: document.querySelector("#frontdeskUnitFilter"),
  frontdeskRoomFilter: document.querySelector("#frontdeskRoomFilter"),
  frontdeskModalityFilter: document.querySelector("#frontdeskModalityFilter"),
  frontdeskInsuranceFilter: document.querySelector("#frontdeskInsuranceFilter"),
  frontdeskPlanFilter: document.querySelector("#frontdeskPlanFilter"),
  frontdeskStatusFilter: document.querySelector("#frontdeskStatusFilter"),
  frontdeskFlowFilter: document.querySelector("#frontdeskFlowFilter"),
  frontdeskDoctorFilter: document.querySelector("#frontdeskDoctorFilter"),
  frontdeskPaymentCodeFilter: document.querySelector("#frontdeskPaymentCodeFilter"),
  frontdeskClearFilters: document.querySelector("#frontdeskClearFilters"),
  frontdeskSaveFilters: document.querySelector("#frontdeskSaveFilters"),
  frontdeskTableCount: document.querySelector("#frontdeskTableCount"),
  frontdeskTableBody: document.querySelector("#frontdeskTableBody"),
  frontdeskJourney: document.querySelector("#frontdeskJourney"),
  frontdeskQueueList: document.querySelector("#frontdeskQueueList"),
  frontdeskDetailList: document.querySelector("#frontdeskDetailList"),
  appointmentDetailTitle: document.querySelector("#appointmentDetailTitle"),
  appointmentDetailStatus: document.querySelector("#appointmentDetailStatus"),
  appointmentDetailTabs: document.querySelector("#appointmentDetailTabs"),
  appointmentDetailContent: document.querySelector("#appointmentDetailContent"),
  walkinForm: document.querySelector("#walkinForm"),
  walkinImportButton: document.querySelector("#walkinImportButton"),
  walkinPatientSelect: document.querySelector("#walkinPatientSelect"),
  walkinBranchSelect: document.querySelector("#walkinBranchSelect"),
  walkinMemberInput: document.querySelector("#walkinMemberInput"),
  walkinInsuranceSelect: document.querySelector("#walkinInsuranceSelect"),
  walkinPlanSelect: document.querySelector("#walkinPlanSelect"),
  walkinGuideInput: document.querySelector("#walkinGuideInput"),
  walkinRequesterCrmInput: document.querySelector("#walkinRequesterCrmInput"),
  walkinDateInput: document.querySelector("#walkinDateInput"),
  walkinTimeInput: document.querySelector("#walkinTimeInput"),
  walkinProcedureSelect: document.querySelector("#walkinProcedureSelect"),
  walkinRoomSelect: document.querySelector("#walkinRoomSelect"),
  walkinDoctorSelect: document.querySelector("#walkinDoctorSelect"),
  walkinRequesterDoctorInput: document.querySelector("#walkinRequesterDoctorInput"),
  walkinSaveButton: document.querySelector("#walkinSaveButton"),
  walkinClearButton: document.querySelector("#walkinClearButton"),
  walkinItemsCount: document.querySelector("#walkinItemsCount"),
  walkinItemsTable: document.querySelector("#walkinItemsTable"),
  emergencyForm: document.querySelector("#emergencyForm"),
  emergencyPatientSelect: document.querySelector("#emergencyPatientSelect"),
  emergencyBranchSelect: document.querySelector("#emergencyBranchSelect"),
  emergencySourceSelect: document.querySelector("#emergencySourceSelect"),
  emergencyPrioritySelect: document.querySelector("#emergencyPrioritySelect"),
  emergencyTriageColorSelect: document.querySelector("#emergencyTriageColorSelect"),
  emergencyProcedureSelect: document.querySelector("#emergencyProcedureSelect"),
  emergencyRoomSelect: document.querySelector("#emergencyRoomSelect"),
  emergencyDoctorSelect: document.querySelector("#emergencyDoctorSelect"),
  emergencyInsuranceSelect: document.querySelector("#emergencyInsuranceSelect"),
  emergencyPlanSelect: document.querySelector("#emergencyPlanSelect"),
  emergencyMemberInput: document.querySelector("#emergencyMemberInput"),
  emergencyGuideInput: document.querySelector("#emergencyGuideInput"),
  emergencyResetButton: document.querySelector("#emergencyResetButton"),
  emergencySummary: document.querySelector("#emergencySummary"),
  emergencyCounterSelect: document.querySelector("#emergencyCounterSelect"),
  emergencyQueueCount: document.querySelector("#emergencyQueueCount"),
  emergencyQueueTable: document.querySelector("#emergencyQueueTable"),
  appointmentPatientSelect: document.querySelector("#appointmentPatientSelect"),
  appointmentDoctorSelect: document.querySelector("#appointmentDoctorSelect"),
  appointmentProcedureSelect: document.querySelector("#appointmentProcedureSelect"),
  appointmentBranchSelect: document.querySelector("#appointmentBranchSelect"),
  appointmentUnitSelect: document.querySelector("#appointmentUnitSelect"),
  appointmentRoomSelect: document.querySelector("#appointmentRoomSelect"),
  appointmentInsuranceSelect: document.querySelector("#appointmentInsuranceSelect"),
  appointmentPlanSelect: document.querySelector("#appointmentPlanSelect"),
  appointmentRulePreview: document.querySelector("#appointmentRulePreview"),
  appointmentMemberInput: document.querySelector("#appointmentMemberInput"),
  appointmentGuideInput: document.querySelector("#appointmentGuideInput"),
  appointmentStartsAtInput: document.querySelector("#appointmentStartsAtInput"),
  appointmentEndsAtInput: document.querySelector("#appointmentEndsAtInput"),
  appointmentsList: document.querySelector("#appointmentsList"),
  totemTicketForm: document.querySelector("#totemTicketForm"),
  totemCallForm: document.querySelector("#totemCallForm"),
  totemDisplayConfigForm: document.querySelector("#totemDisplayConfigForm"),
  totemQueueSelect: document.querySelector("#totemQueueSelect"),
  totemCallQueueSelect: document.querySelector("#totemCallQueueSelect"),
  totemCounterSelect: document.querySelector("#totemCounterSelect"),
  totemDisplayTitleInput: document.querySelector("#totemDisplayTitleInput"),
  totemDisplayUrlInput: document.querySelector("#totemDisplayUrlInput"),
  totemDisplayTypeSelect: document.querySelector("#totemDisplayTypeSelect"),
  totemDisplayLayoutSelect: document.querySelector("#totemDisplayLayoutSelect"),
  totemWaitingCount: document.querySelector("#totemWaitingCount"),
  totemSummary: document.querySelector("#totemSummary"),
  totemDisplayPanel: document.querySelector("#totemDisplayPanel"),
  totemTicketsList: document.querySelector("#totemTicketsList"),
  totemAuditList: document.querySelector("#totemAuditList"),
  imagingSummary: document.querySelector("#imagingSummary"),
  worklistList: document.querySelector("#worklistList"),
  pacsStudiesList: document.querySelector("#pacsStudiesList"),
  laboratoryOrdersList: document.querySelector("#laboratoryOrdersList"),
  lisInterfaceForm: document.querySelector("#lisInterfaceForm"),
  supportLabForm: document.querySelector("#supportLabForm"),
  lisInterfacesList: document.querySelector("#lisInterfacesList"),
  supportLabList: document.querySelector("#supportLabList"),
  invoiceForm: document.querySelector("#invoiceForm"),
  invoicePatientSelect: document.querySelector("#invoicePatientSelect"),
  billingBatchForm: document.querySelector("#billingBatchForm"),
  billingListTitle: document.querySelector("#billingListTitle"),
  billingList: document.querySelector("#billingList"),
  financeForm: document.querySelector("#financeForm"),
  financeSummary: document.querySelector("#financeSummary"),
  financeCount: document.querySelector("#financeCount"),
  financeSearch: document.querySelector("#financeSearch"),
  financeDirectionFilter: document.querySelector("#financeDirectionFilter"),
  financeStatusFilter: document.querySelector("#financeStatusFilter"),
  financeReconciliationFilter: document.querySelector("#financeReconciliationFilter"),
  financeCategorySelect: document.querySelector("#financeCategorySelect"),
  financeCostCenterSelect: document.querySelector("#financeCostCenterSelect"),
  financeAccountSelect: document.querySelector("#financeAccountSelect"),
  financePaymentMethodSelect: document.querySelector("#financePaymentMethodSelect"),
  financeReceivablesCount: document.querySelector("#financeReceivablesCount"),
  financePayablesCount: document.querySelector("#financePayablesCount"),
  financeReconciliationCount: document.querySelector("#financeReconciliationCount"),
  financeReceivablesList: document.querySelector("#financeReceivablesList"),
  financePayablesList: document.querySelector("#financePayablesList"),
  financeReconciliationList: document.querySelector("#financeReconciliationList"),
  relationshipCallForm: document.querySelector("#relationshipCallForm"),
  relationshipDtmfSelect: document.querySelector("#relationshipDtmfSelect"),
  relationshipQueuesCount: document.querySelector("#relationshipQueuesCount"),
  relationshipQueuesList: document.querySelector("#relationshipQueuesList"),
  relationshipCallsCount: document.querySelector("#relationshipCallsCount"),
  relationshipCallsList: document.querySelector("#relationshipCallsList"),
  whatsappConfigForm: document.querySelector("#whatsappConfigForm"),
  whatsappStatus: document.querySelector("#whatsappStatus"),
  whatsappSimulationForm: document.querySelector("#whatsappSimulationForm"),
  whatsappReadinessSummary: document.querySelector("#whatsappReadinessSummary"),
  whatsappSafetySummary: document.querySelector("#whatsappSafetySummary"),
  whatsappSafetyExecutive: document.querySelector("#whatsappSafetyExecutive"),
  whatsappSafetyReasonsList: document.querySelector("#whatsappSafetyReasonsList"),
  whatsappSafetyDeliveryList: document.querySelector("#whatsappSafetyDeliveryList"),
  whatsappSafetyRecentList: document.querySelector("#whatsappSafetyRecentList"),
  whatsappEvolutionStatus: document.querySelector("#whatsappEvolutionStatus"),
  whatsappEvolutionSummary: document.querySelector("#whatsappEvolutionSummary"),
  whatsappEvolutionQr: document.querySelector("#whatsappEvolutionQr"),
  whatsappEvolutionNumberInput: document.querySelector("#whatsappEvolutionNumberInput"),
  whatsappEvolutionRefreshButton: document.querySelector("#whatsappEvolutionRefreshButton"),
  whatsappEvolutionCreateButton: document.querySelector("#whatsappEvolutionCreateButton"),
  whatsappEvolutionConnectButton: document.querySelector("#whatsappEvolutionConnectButton"),
  whatsappInboxStatus: document.querySelector("#whatsappInboxStatus"),
  whatsappInboxConversations: document.querySelector("#whatsappInboxConversations"),
  whatsappInboxTitle: document.querySelector("#whatsappInboxTitle"),
  whatsappInboxMessages: document.querySelector("#whatsappInboxMessages"),
  whatsappInboxContext: document.querySelector("#whatsappInboxContext"),
  whatsappInboxReplyForm: document.querySelector("#whatsappInboxReplyForm"),
  whatsappInboxConversationInput: document.querySelector("#whatsappInboxConversationInput"),
  whatsappInboxReplyText: document.querySelector("#whatsappInboxReplyText"),
  whatsappSupervisionSummary: document.querySelector("#whatsappSupervisionSummary"),
  whatsappSupervisionList: document.querySelector("#whatsappSupervisionList"),
  whatsappExceptionsSummary: document.querySelector("#whatsappExceptionsSummary"),
  whatsappExceptionsList: document.querySelector("#whatsappExceptionsList"),
  whatsappAutonomyReviewsSummary: document.querySelector("#whatsappAutonomyReviewsSummary"),
  whatsappAutonomyReviewsList: document.querySelector("#whatsappAutonomyReviewsList"),
  whatsappProfileUpdatesCount: document.querySelector("#whatsappProfileUpdatesCount"),
  whatsappProfileUpdatesList: document.querySelector("#whatsappProfileUpdatesList"),
  whatsappConsentsCount: document.querySelector("#whatsappConsentsCount"),
  whatsappConsentsList: document.querySelector("#whatsappConsentsList"),
  whatsappManualReplyForm: document.querySelector("#whatsappManualReplyForm"),
  whatsappManualConversationSelect: document.querySelector("#whatsappManualConversationSelect"),
  whatsappManualTextInput: document.querySelector("#whatsappManualTextInput"),
  whatsappFlowForm: document.querySelector("#whatsappFlowForm"),
  whatsappFlowsCount: document.querySelector("#whatsappFlowsCount"),
  whatsappFlowsList: document.querySelector("#whatsappFlowsList"),
  whatsappTemplateForm: document.querySelector("#whatsappTemplateForm"),
  whatsappTemplatesCount: document.querySelector("#whatsappTemplatesCount"),
  whatsappTemplatesList: document.querySelector("#whatsappTemplatesList"),
  whatsappAutonomyRuleForm: document.querySelector("#whatsappAutonomyRuleForm"),
  whatsappAutonomyRulesCount: document.querySelector("#whatsappAutonomyRulesCount"),
  whatsappAutonomyRulesList: document.querySelector("#whatsappAutonomyRulesList"),
  whatsappAutonomyProfileForm: document.querySelector("#whatsappAutonomyProfileForm"),
  whatsappAutonomyProfilesCount: document.querySelector("#whatsappAutonomyProfilesCount"),
  whatsappAutonomyProfilesList: document.querySelector("#whatsappAutonomyProfilesList"),
  whatsappJourneyForm: document.querySelector("#whatsappJourneyForm"),
  whatsappJourneysCount: document.querySelector("#whatsappJourneysCount"),
  whatsappJourneysList: document.querySelector("#whatsappJourneysList"),
  whatsappAvailabilityForm: document.querySelector("#whatsappAvailabilityForm"),
  whatsappAvailabilityList: document.querySelector("#whatsappAvailabilityList"),
  whatsappInsuranceValidationForm: document.querySelector("#whatsappInsuranceValidationForm"),
  whatsappInsuranceValidationResult: document.querySelector("#whatsappInsuranceValidationResult"),
  whatsappPrepRuleForm: document.querySelector("#whatsappPrepRuleForm"),
  whatsappPrepRulesCount: document.querySelector("#whatsappPrepRulesCount"),
  whatsappPrepRulesList: document.querySelector("#whatsappPrepRulesList"),
  whatsappConversationsCount: document.querySelector("#whatsappConversationsCount"),
  whatsappConversationsList: document.querySelector("#whatsappConversationsList"),
  whatsappTasksCount: document.querySelector("#whatsappTasksCount"),
  whatsappTasksList: document.querySelector("#whatsappTasksList"),
  whatsappOcrCount: document.querySelector("#whatsappOcrCount"),
  whatsappOcrList: document.querySelector("#whatsappOcrList"),
  whatsappMessagesCount: document.querySelector("#whatsappMessagesCount"),
  whatsappMessagesList: document.querySelector("#whatsappMessagesList"),
  whatsappOutboxCount: document.querySelector("#whatsappOutboxCount"),
  whatsappOutboxList: document.querySelector("#whatsappOutboxList"),
  whatsappSendPendingButton: document.querySelector("#whatsappSendPendingButton"),
  whatsappAuditCount: document.querySelector("#whatsappAuditCount"),
  whatsappAuditList: document.querySelector("#whatsappAuditList"),
  uraConfigForm: document.querySelector("#uraConfigForm"),
  uraConfigStatus: document.querySelector("#uraConfigStatus"),
  uraFallbackQueueSelect: document.querySelector("#uraFallbackQueueSelect"),
  uraFlowForm: document.querySelector("#uraFlowForm"),
  uraFlowQueueSelect: document.querySelector("#uraFlowQueueSelect"),
  uraLiveCallForm: document.querySelector("#uraLiveCallForm"),
  uraLiveDtmfSelect: document.querySelector("#uraLiveDtmfSelect"),
  uraProviderEventForm: document.querySelector("#uraProviderEventForm"),
  uraProviderEventDtmfSelect: document.querySelector("#uraProviderEventDtmfSelect"),
  uraConnectorStatus: document.querySelector("#uraConnectorStatus"),
  uraConnectorDetails: document.querySelector("#uraConnectorDetails"),
  uraConnectorTestButton: document.querySelector("#uraConnectorTestButton"),
  uraConnectorConnectButton: document.querySelector("#uraConnectorConnectButton"),
  uraConnectorDisconnectButton: document.querySelector("#uraConnectorDisconnectButton"),
  uraCommandForm: document.querySelector("#uraCommandForm"),
  uraCommandLiveCallSelect: document.querySelector("#uraCommandLiveCallSelect"),
  uraCommandQueueSelect: document.querySelector("#uraCommandQueueSelect"),
  uraCommandsCount: document.querySelector("#uraCommandsCount"),
  uraCommandsList: document.querySelector("#uraCommandsList"),
  uraFlowsCount: document.querySelector("#uraFlowsCount"),
  uraFlowsList: document.querySelector("#uraFlowsList"),
  uraLiveCallsCount: document.querySelector("#uraLiveCallsCount"),
  uraLiveCallsList: document.querySelector("#uraLiveCallsList"),
  uraReadinessSummary: document.querySelector("#uraReadinessSummary"),
  uraEventsCount: document.querySelector("#uraEventsCount"),
  uraEventsList: document.querySelector("#uraEventsList"),
  uraAuditCount: document.querySelector("#uraAuditCount"),
  uraAuditList: document.querySelector("#uraAuditList"),
  userForm: document.querySelector("#userForm"),
  userProfessionalTypeSelect: document.querySelector("#userProfessionalTypeSelect"),
  userProfessionalSelect: document.querySelector("#userProfessionalSelect"),
  userGroupSelect: document.querySelector("#userGroupSelect"),
  userPermissionGrid: document.querySelector("#userPermissionGrid"),
  usersCount: document.querySelector("#usersCount"),
  usersList: document.querySelector("#usersList"),
  securityRiskSummary: document.querySelector("#securityRiskSummary"),
  systemStateSummary: document.querySelector("#systemStateSummary"),
  systemStateChecks: document.querySelector("#systemStateChecks"),
  systemStateRunButton: document.querySelector("#systemStateRunButton"),
  systemStateHistoryButton: document.querySelector("#systemStateHistoryButton"),
  systemStateLastRun: document.querySelector("#systemStateLastRun"),
  systemStateHistoryList: document.querySelector("#systemStateHistoryList"),
  securityPermissionsList: document.querySelector("#securityPermissionsList"),
  securityAuditCount: document.querySelector("#securityAuditCount"),
  securityAuditList: document.querySelector("#securityAuditList"),
  registrySearch: document.querySelector("#registrySearch"),
  registryTypeList: document.querySelector("#registryTypeList"),
  registryTitle: document.querySelector("#registryTitle"),
  registryForm: document.querySelector("#registryForm"),
  registryRecordsList: document.querySelector("#registryRecordsList"),
  menuAuditStatus: document.querySelector("#menuAuditStatus"),
  menuAuditSummary: document.querySelector("#menuAuditSummary"),
  menuAuditIssues: document.querySelector("#menuAuditIssues"),
  menuAuditList: document.querySelector("#menuAuditList"),
  settingsModuleGrid: document.querySelector(".settings-module-grid"),
  settingsChecklistTitle: document.querySelector("#settingsChecklistTitle"),
  settingsChecklistBadge: document.querySelector("#settingsChecklistBadge"),
  settingsChecklistList: document.querySelector("#settingsChecklistList"),
  settingsPendingOnlyToggle: document.querySelector("#settingsPendingOnlyToggle"),
  settingsSnapshotButton: document.querySelector("#settingsSnapshotButton"),
  hrPageSize: document.querySelector("#hrPageSize"),
  hrSearch: document.querySelector("#hrSearch"),
  hrTableBody: document.querySelector("#hrTableBody"),
  hrTableMeta: document.querySelector("#hrTableMeta"),
  hrPrevPageButton: document.querySelector("#hrPrevPageButton"),
  hrNextPageButton: document.querySelector("#hrNextPageButton"),
  hrPageInfo: document.querySelector("#hrPageInfo"),
  registryDeleteModal: document.querySelector("#registryDeleteModal"),
  registryDeleteConfirmInput: document.querySelector("#registryDeleteConfirmInput"),
  registryDeleteError: document.querySelector("#registryDeleteError"),
  registryDeleteConfirmButton: document.querySelector("#registryDeleteConfirmButton"),
  registryDeleteCancelButton: document.querySelector("#registryDeleteCancelButton"),
  accessDeniedBadge: document.querySelector("#accessDeniedBadge"),
  accessDeniedMessage: document.querySelector("#accessDeniedMessage"),
  accessDeniedSummary: document.querySelector("#accessDeniedSummary")
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

initializeSidebar();
renderNavigation();
bindEvents();
syncRoute();
window.addEventListener("hashchange", syncRoute);
bootstrap();

function renderNavigation() {
  if (!els.mainNav) return;
  const items = visibleNavigationItems(applyNavigationOverrides(navigationItems));
  els.mainNav.innerHTML = items.map(renderNavigationItem).join("");
  auditNavigationRoutes(items);
}

function applyNavigationOverrides(items) {
  const overrides = navigationOverrideMap();
  return items.map((item) => {
    const override = overrides.get(item.route) ?? {};
    return {
      ...item,
      status: override.status ?? item.status ?? "active",
      order: Number(override.order ?? item.order ?? 0),
      permission: override.permission !== undefined ? override.permission || undefined : item.permission,
      children: applyNavigationOverrides(item.children ?? [])
    };
  });
}

function navigationOverrideMap() {
  return new Map((state.navigationOverrides ?? []).map((item) => [item.route, item]));
}

function visibleNavigationItems(items) {
  return [...items]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((item) => {
      const children = visibleNavigationItems(item.children ?? []);
      if (item.status === "inactive") return undefined;
      const canSeeItem = !state.user || hasPermission(item.permission);
      if (!canSeeItem && !children.length) return undefined;
      return { ...item, children };
    })
    .filter(Boolean);
}

function renderNavigationItem(item) {
  const config = routeMap[item.route];
  if (!config) return "";
  const parent = item.parent ?? config.parent ?? item.route;
  const section = config.section;
  const icon = item.icon ? `<svg><use href="#icon-${escapeHtml(item.icon)}"></use></svg>` : "";
  const link = navigationLink({ ...item, parent, section, icon });
  if (!item.children?.length) return link;
  return `
    <div class="nav-group" data-nav-parent="${escapeHtml(parent)}">
      ${link}
      <div class="submenu">
        ${item.children.map((child) => {
          const childConfig = routeMap[child.route] ?? {};
          return navigationLink({
            ...child,
            parent: child.parent ?? childConfig.parent ?? parent,
            section: childConfig.section ?? section,
            icon: ""
          });
        }).join("")}
      </div>
    </div>
  `;
}

function navigationLink({ route, label, section, parent, icon = "", permission }) {
  const permissionAttr = permission ? ` data-permission="${escapeHtml(permission)}"` : "";
  return `<a class="nav-parent" href="#${escapeHtml(route)}" title="${escapeHtml(label)}" data-route="${escapeHtml(route)}" data-section="${escapeHtml(section)}" data-parent="${escapeHtml(parent)}"${permissionAttr}>${icon}<span class="nav-label">${escapeHtml(label)}</span></a>`;
}

function initializeSidebar() {
  const pinned = localStorage.getItem(sidebarPinnedKey) === "true";
  document.body.classList.toggle("sidebar-pinned", pinned);
  updateSidebarPinButton(pinned);
  try {
    state.frontdeskFilters = JSON.parse(localStorage.getItem("clinic.frontdesk.filters") ?? "{}");
  } catch {
    state.frontdeskFilters = {};
  }
  try {
    state.settingsPlan = JSON.parse(localStorage.getItem(settingsPlanKey) ?? "{}");
  } catch {
    state.settingsPlan = {};
  }
}

function updateSidebarPinButton(pinned = document.body.classList.contains("sidebar-pinned")) {
  if (!els.sidebarPinButton) return;
  els.sidebarPinButton.classList.toggle("active", pinned);
  els.sidebarPinButton.setAttribute("aria-pressed", String(pinned));
  els.sidebarPinButton.setAttribute("aria-label", pinned ? "Recolher menu lateral" : "Fixar menu aberto");
  els.sidebarPinButton.title = pinned ? "Recolher menu lateral" : "Fixar menu aberto";
}

function auditNavigationRoutes(items) {
  const missing = [];
  const visit = (item) => {
    if (!routeMap[item.route]) missing.push(item.route);
    (item.children ?? []).forEach(visit);
  };
  items.forEach(visit);
  if (missing.length) console.warn("Rotas de menu sem configuracao:", missing.join(", "));
}

function bindEvents() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.textContent = "";
    try {
      const response = await api("/v1/auth/login", { method: "POST", body: formPayload(event.currentTarget), auth: false });
      state.token = response.data.token;
      state.user = response.data.user;
      localStorage.setItem(tokenKey, state.token);
      els.loginOverlay.classList.add("hidden");
      renderNavigation();
      syncRoute();
      await refreshAll();
    } catch (error) {
      els.loginError.textContent = error.message;
    }
  });

  els.refreshButton.addEventListener("click", refreshAll);
  els.logoutButton.addEventListener("click", logout);
  els.systemStateRunButton?.addEventListener("click", handleSystemStateRun);
  els.systemStateHistoryButton?.addEventListener("click", toggleSystemStateHistory);
  els.sidebar?.addEventListener("mouseenter", () => document.body.classList.add("sidebar-expanded"));
  els.sidebar?.addEventListener("mouseleave", () => document.body.classList.remove("sidebar-expanded"));
  els.sidebarPinButton?.addEventListener("click", () => {
    const pinned = !document.body.classList.contains("sidebar-pinned");
    document.body.classList.toggle("sidebar-pinned", pinned);
    document.body.classList.remove("sidebar-expanded");
    localStorage.setItem(sidebarPinnedKey, String(pinned));
    updateSidebarPinButton(pinned);
  });
  els.patientForm.addEventListener("submit", handlePatientSubmit);
  els.appointmentForm.addEventListener("submit", handleAppointmentSubmit);
  els.appointmentDetailTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-detail-tab]");
    if (!button) return;
    state.selectedAppointmentDetailTab = button.dataset.detailTab;
    renderAppointmentDetail();
  });
  els.appointmentDetailContent?.addEventListener("submit", handleAppointmentDetailSubmit);
  els.appointmentDetailContent?.addEventListener("click", handleAppointmentDetailClick);
  els.walkinForm?.addEventListener("submit", handleWalkinAdd);
  els.walkinSaveButton?.addEventListener("click", handleWalkinSave);
  els.walkinClearButton?.addEventListener("click", () => {
    state.walkinItems = [];
    renderWalkin();
  });
  els.walkinItemsTable?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-walkin-remove]");
    if (!button) return;
    state.walkinItems.splice(Number(button.dataset.walkinRemove), 1);
    renderWalkinItems();
  });
  [els.walkinProcedureSelect, els.walkinInsuranceSelect, els.walkinBranchSelect].forEach((element) => {
    element?.addEventListener("change", renderWalkinDependentFields);
  });
  els.emergencyForm?.addEventListener("submit", handleEmergencySubmit);
  els.emergencyResetButton?.addEventListener("click", () => {
    els.emergencyForm.reset();
    renderEmergency();
  });
  [els.emergencyProcedureSelect, els.emergencyInsuranceSelect, els.emergencyBranchSelect].forEach((element) => {
    element?.addEventListener("change", renderEmergencyDependentFields);
  });
  els.emergencyQueueTable?.addEventListener("click", async (event) => {
    const ticketButton = event.target.closest("[data-emergency-ticket]");
    if (ticketButton) {
      await handleEmergencyTicketClick(ticketButton);
      return;
    }
    const callButton = event.target.closest("[data-emergency-call]");
    if (callButton) {
      await handleEmergencyCallClick(callButton);
      return;
    }
    const worklistButton = event.target.closest("[data-emergency-worklist]");
    if (worklistButton) {
      await handleEmergencyWorklistClick(worklistButton);
      return;
    }
    const labButton = event.target.closest("[data-emergency-lab]");
    if (labButton) {
      await handleEmergencyLabClick(labButton);
      return;
    }
    const stageButton = event.target.closest("[data-emergency-stage]");
    if (stageButton) {
      await handleEmergencyStageClick(stageButton);
      return;
    }
    const detailButton = event.target.closest("[data-appointment-detail]");
    if (!detailButton) return;
    await openAppointmentDetail(detailButton.dataset.appointmentDetail);
  });
  els.dashboardAppointments?.addEventListener("click", async (event) => {
    const detailButton = event.target.closest("[data-appointment-detail]");
    if (!detailButton) return;
    await openAppointmentDetail(detailButton.dataset.appointmentDetail);
  });
  els.frontdeskFilterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.frontdeskFilters = formPayload(event.currentTarget);
    renderFrontdesk();
  });
  els.frontdeskFilterForm?.addEventListener("input", () => {
    state.frontdeskFilters = formPayload(els.frontdeskFilterForm);
    renderFrontdesk();
  });
  els.frontdeskFilterForm?.addEventListener("change", () => {
    state.frontdeskFilters = formPayload(els.frontdeskFilterForm);
    renderFrontdesk();
  });
  els.frontdeskClearFilters?.addEventListener("click", () => {
    els.frontdeskFilterForm.reset();
    state.frontdeskFilters = {};
    renderFrontdesk();
  });
  els.frontdeskSaveFilters?.addEventListener("click", () => {
    state.frontdeskFilters = formPayload(els.frontdeskFilterForm);
    localStorage.setItem("clinic.frontdesk.filters", JSON.stringify(state.frontdeskFilters));
  });
  [
    els.appointmentProcedureSelect,
    els.appointmentInsuranceSelect,
    els.appointmentBranchSelect,
    els.appointmentUnitSelect,
    els.appointmentStartsAtInput
  ].forEach((element) => element?.addEventListener("change", () => renderAppointmentDependentFields(true)));
  els.totemTicketForm.addEventListener("submit", handleTotemTicketSubmit);
  els.totemCallForm.addEventListener("submit", handleTotemCallSubmit);
  els.totemDisplayConfigForm.addEventListener("submit", handleTotemDisplayConfigSubmit);
  els.lisInterfaceForm.addEventListener("submit", handleLisSubmit);
  els.supportLabForm.addEventListener("submit", handleSupportLabSubmit);
  els.laboratoryOrdersList?.addEventListener("click", handleLaboratoryOrderClick);
  els.invoiceForm.addEventListener("submit", handleInvoiceSubmit);
  els.billingBatchForm.addEventListener("submit", handleBillingBatchSubmit);
  els.financeForm.addEventListener("submit", handleFinanceSubmit);
  [els.financeSearch, els.financeDirectionFilter, els.financeStatusFilter, els.financeReconciliationFilter].forEach((element) => {
    element.addEventListener("input", renderFinance);
    element.addEventListener("change", renderFinance);
  });
  els.relationshipCallForm.addEventListener("submit", handleRelationshipCallSubmit);
  els.whatsappConfigForm?.addEventListener("submit", handleWhatsappConfigSubmit);
  els.whatsappSimulationForm?.addEventListener("submit", handleWhatsappSimulationSubmit);
  els.whatsappEvolutionRefreshButton?.addEventListener("click", handleWhatsappEvolutionRefresh);
  els.whatsappEvolutionCreateButton?.addEventListener("click", handleWhatsappEvolutionCreate);
  els.whatsappEvolutionConnectButton?.addEventListener("click", handleWhatsappEvolutionConnect);
  els.whatsappInboxConversations?.addEventListener("click", handleWhatsappInboxClick);
  els.whatsappInboxContext?.addEventListener("click", handleWhatsappSupervisionClick);
  els.whatsappInboxContext?.addEventListener("submit", handleWhatsappSupervisionClick);
  els.whatsappInboxReplyForm?.addEventListener("submit", handleWhatsappInboxReply);
  els.whatsappSupervisionList?.addEventListener("click", handleWhatsappSupervisionClick);
  els.whatsappSupervisionList?.addEventListener("submit", handleWhatsappSupervisionClick);
  els.whatsappExceptionsList?.addEventListener("click", handleWhatsappSupervisionClick);
  els.whatsappExceptionsList?.addEventListener("submit", handleWhatsappSupervisionClick);
  els.whatsappAutonomyReviewsList?.addEventListener("click", handleWhatsappSupervisionClick);
  els.whatsappAutonomyReviewsList?.addEventListener("submit", handleWhatsappSupervisionClick);
  els.whatsappProfileUpdatesList?.addEventListener("click", handleWhatsappProfileUpdateClick);
  els.whatsappProfileUpdatesList?.addEventListener("submit", handleWhatsappProfileUpdateSubmit);
  els.whatsappManualReplyForm?.addEventListener("submit", handleWhatsappManualReply);
  els.whatsappFlowForm?.addEventListener("submit", handleWhatsappFlowSubmit);
  els.whatsappTemplateForm?.addEventListener("submit", handleWhatsappTemplateSubmit);
  els.whatsappAutonomyRuleForm?.addEventListener("submit", handleWhatsappAutonomyRuleSubmit);
  els.whatsappAutonomyProfileForm?.addEventListener("submit", handleWhatsappAutonomyProfileSubmit);
  els.whatsappJourneyForm?.addEventListener("submit", handleWhatsappJourneySubmit);
  els.whatsappAvailabilityForm?.addEventListener("submit", handleWhatsappAvailabilitySubmit);
  els.whatsappInsuranceValidationForm?.addEventListener("submit", handleWhatsappInsuranceValidationSubmit);
  els.whatsappPrepRuleForm?.addEventListener("submit", handleWhatsappPrepRuleSubmit);
  els.whatsappOutboxList?.addEventListener("click", handleWhatsappOutboxClick);
  els.whatsappOutboxList?.addEventListener("submit", handleWhatsappOutboxClick);
  els.whatsappSafetyDeliveryList?.addEventListener("click", handleWhatsappOutboxClick);
  els.whatsappSendPendingButton?.addEventListener("click", handleWhatsappSendPending);
  els.uraConfigForm?.addEventListener("submit", handleUraConfigSubmit);
  els.uraFlowForm?.addEventListener("submit", handleUraFlowSubmit);
  els.uraLiveCallForm?.addEventListener("submit", handleUraLiveCallSubmit);
  els.uraProviderEventForm?.addEventListener("submit", handleUraProviderEventSubmit);
  els.uraConnectorTestButton?.addEventListener("click", () => handleUraConnectorAction("test"));
  els.uraConnectorConnectButton?.addEventListener("click", () => handleUraConnectorAction("connect"));
  els.uraConnectorDisconnectButton?.addEventListener("click", () => handleUraConnectorAction("disconnect"));
  els.uraCommandForm?.addEventListener("submit", handleUraCommandSubmit);
  els.userForm.addEventListener("submit", handleUserSubmit);
  els.usersList?.addEventListener("submit", handleUserEditSubmit);
  els.usersList?.addEventListener("click", handleUserStatusClick);
  els.registryForm.addEventListener("submit", handleRegistrySubmit);
  els.registryForm.addEventListener("click", (event) => {
    const cancel = event.target.closest("[data-registry-edit-cancel]");
    if (!cancel) return;
    state.registryEditingId = "";
    els.registryForm.reset();
    renderRegistries();
  });
  els.registryRecordsList?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-registry-edit-id]");
    if (editButton) {
      startRegistryEdit(editButton.dataset.registryEditId);
      return;
    }
    const deleteButton = event.target.closest("[data-registry-delete-id]");
    if (deleteButton) {
      handleRegistryDelete(deleteButton.dataset.registryDeleteId);
    }
  });
  els.registrySearch.addEventListener("input", renderRegistries);
  els.menuAuditList?.addEventListener("submit", handleNavigationOverrideSubmit);
  els.userProfessionalTypeSelect.addEventListener("change", renderUserProfessionalOptions);
  els.userGroupSelect.addEventListener("change", applyUserGroupDefaults);

  document.querySelectorAll("[data-route]").forEach((link) => {
    link.addEventListener("click", () => setTimeout(syncRoute));
  });
  els.settingsModuleGrid?.addEventListener("click", (event) => {
    const tile = event.target.closest(".settings-module-tile[data-route]");
    if (!tile) return;
    event.preventDefault();
    state.selectedSettingsModule = tile.dataset.route;
    renderSettingsReadiness();
  });
  els.settingsChecklistList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-resolve-route]");
    if (!button) return;
    const route = button.dataset.resolveRoute;
    if (!route) return;
    state.pendingRouteFocus = route;
    location.hash = `#${route}`;
    syncRoute();
  });
  els.settingsChecklistList?.addEventListener("change", (event) => {
    const field = event.target.closest("[data-plan-item][data-plan-field]");
    if (!field) return;
    updateSettingsPlanField(field.dataset.planItem, field.dataset.planField, field.value ?? "");
    renderSettingsReadiness();
  });
  els.settingsPendingOnlyToggle?.addEventListener("change", (event) => {
    state.settingsPendingOnly = Boolean(event.target.checked);
    renderSettingsReadiness();
  });
  els.settingsSnapshotButton?.addEventListener("click", handleSettingsSnapshotExport);
  els.hrSearch?.addEventListener("input", (event) => {
    state.hrSearch = event.target.value ?? "";
    state.hrPage = 1;
    renderHumanResources();
  });
  els.hrPageSize?.addEventListener("change", (event) => {
    state.hrPageSize = Number(event.target.value) || 10;
    state.hrPage = 1;
    renderHumanResources();
  });
  els.hrPrevPageButton?.addEventListener("click", () => {
    state.hrPage = Math.max(1, Number(state.hrPage || 1) - 1);
    renderHumanResources();
  });
  els.hrNextPageButton?.addEventListener("click", () => {
    state.hrPage = Number(state.hrPage || 1) + 1;
    renderHumanResources();
  });
  els.hrTableBody?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-hr-edit-id]");
    const accessButton = event.target.closest("[data-hr-access-id]");
    if (editButton) {
      openEmployeeEditFromHr(editButton.dataset.hrEditId);
      return;
    }
    if (accessButton) {
      openEmployeeAccessFromHr(accessButton.dataset.hrAccessId);
    }
  });
  document.querySelector("#hrAccessFilters")?.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-hr-access-filter]");
    if (!filterButton) return;
    state.hrAccessFilter = filterButton.dataset.hrAccessFilter || "all";
    state.hrPage = 1;
    renderHumanResources();
  });
  document.querySelector("#human-resources")?.addEventListener("click", (event) => {
    const sortButton = event.target.closest("[data-hr-sort]");
    if (!sortButton) return;
    const key = sortButton.dataset.hrSort;
    if (!key) return;
    if (state.hrSortKey === key) {
      state.hrSortDir = state.hrSortDir === "asc" ? "desc" : "asc";
    } else {
      state.hrSortKey = key;
      state.hrSortDir = "asc";
    }
    state.hrPage = 1;
    renderHumanResources();
  });
  els.registryDeleteConfirmInput?.addEventListener("input", () => {
    const ok = (els.registryDeleteConfirmInput.value ?? "").trim() === "EXCLUIR";
    if (els.registryDeleteConfirmButton) els.registryDeleteConfirmButton.disabled = !ok;
  });
  els.registryDeleteCancelButton?.addEventListener("click", () => closeRegistryDeleteModal(false));
  els.registryDeleteConfirmButton?.addEventListener("click", () => closeRegistryDeleteModal(true));
  els.registryDeleteModal?.addEventListener("click", (event) => {
    if (event.target === els.registryDeleteModal) closeRegistryDeleteModal(false);
  });

  document.querySelector("#attendance").addEventListener("click", async (event) => {
    const detailButton = event.target.closest("[data-appointment-detail]");
    const statusButton = event.target.closest("[data-appointment-status]");
    const authorizationButton = event.target.closest("[data-authorization-status]");
    const worklistButton = event.target.closest("[data-publish-worklist]");
    if (detailButton) {
      await openAppointmentDetail(detailButton.dataset.appointmentDetail);
      return;
    } else if (statusButton) {
      await api(`/v1/appointments/${statusButton.dataset.appointmentId}/status`, {
        method: "PATCH",
        body: { status: statusButton.dataset.appointmentStatus }
      });
    } else if (authorizationButton) {
      await api(`/v1/appointments/${authorizationButton.dataset.appointmentId}/authorization`, {
        method: "PATCH",
        body: { authorizationStatus: authorizationButton.dataset.authorizationStatus }
      });
    } else if (worklistButton) {
      await api(`/v1/worklist/${worklistButton.dataset.publishWorklist}/publish`, { method: "POST", body: {} });
    } else {
      return;
    }
    await refreshAll();
  });

  els.totemTicketsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-totem-status]");
    if (!button) return;
    await api(`/v1/totem/tickets/${button.dataset.ticketId}/status`, {
      method: "PATCH",
      body: { status: button.dataset.totemStatus }
    });
    await refreshAll();
  });

  els.worklistList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-publish-worklist]");
    if (!button) return;
    await api(`/v1/worklist/${button.dataset.publishWorklist}/publish`, { method: "POST", body: {} });
    await refreshAll();
  });

  document.querySelector("#finance").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-finance-reconcile]");
    const statusButton = event.target.closest("[data-finance-status]");
    if (button) {
      await api(`/v1/finance/entries/${button.dataset.financeReconcile}/reconciliation`, {
        method: "PATCH",
        body: { reconciliationStatus: "reconciled" }
      });
    } else if (statusButton) {
      await api(`/v1/finance/entries/${statusButton.dataset.financeStatus}/status`, {
        method: "PATCH",
        body: { status: statusButton.dataset.status }
      });
    } else {
      return;
    }
    await refreshAll();
  });
}

async function bootstrap() {
  try {
    const health = await getOptional("/health", false);
    els.apiStatus.textContent = health?.status === "ok" ? "API online" : "API indisponivel";
    if (!state.token) {
      els.loginOverlay.classList.remove("hidden");
      return;
    }
    const me = await api("/v1/auth/me");
    state.user = me.data;
    els.loginOverlay.classList.add("hidden");
    renderNavigation();
    syncRoute();
    await refreshAll();
  } catch {
    els.apiStatus.textContent = "API indisponivel";
    els.loginOverlay.classList.remove("hidden");
  }
}

async function refreshAll() {
  if (!state.token) return;
  const results = await Promise.all([
    getOptional("/v1/patients"),
    getOptional("/v1/appointments"),
    getOptional("/v1/frontdesk/summary"),
    getOptional("/v1/totem/queues"),
    getOptional("/v1/totem/counters"),
    getOptional("/v1/totem/tickets"),
    getOptional("/v1/totem/calls"),
    getOptional("/v1/totem/display"),
    getOptional("/v1/totem/display-config"),
    getOptional("/v1/totem/audit"),
    getOptional("/v1/worklist"),
    getOptional("/v1/pacs/studies"),
    getOptional("/v1/laboratory/orders"),
    getOptional("/v1/laboratory/samples"),
    getOptional("/v1/laboratory/interfaces"),
    getOptional("/v1/laboratory/support-exams"),
    getOptional("/v1/billing/invoices"),
    getOptional("/v1/billing/batches"),
    getOptional("/v1/billing/denials"),
    getOptional("/v1/billing/payouts"),
    getOptional("/v1/finance/entries"),
    getOptional("/v1/relationship/queues"),
    getOptional("/v1/relationship/calls"),
    getOptional("/v1/relationship/whatsapp/config"),
    getOptional("/v1/relationship/whatsapp/readiness"),
    getOptional("/v1/relationship/whatsapp/safety-dashboard"),
    getOptional("/v1/relationship/whatsapp/flows"),
    getOptional("/v1/relationship/whatsapp/templates"),
    getOptional("/v1/relationship/whatsapp/autonomy-rules"),
    getOptional("/v1/relationship/whatsapp/autonomy-profiles"),
    getOptional("/v1/relationship/whatsapp/journeys"),
    getOptional("/v1/relationship/whatsapp/prep-rules"),
    getOptional("/v1/relationship/whatsapp/evolution/status"),
    getOptional("/v1/relationship/whatsapp/supervision"),
    getOptional("/v1/relationship/whatsapp/exceptions"),
    getOptional("/v1/relationship/whatsapp/autonomy-reviews"),
    getOptional("/v1/relationship/whatsapp/profile-updates"),
    getOptional("/v1/relationship/whatsapp/consents"),
    getOptional("/v1/relationship/whatsapp/conversations"),
    getOptional("/v1/relationship/whatsapp/messages"),
    getOptional("/v1/relationship/whatsapp/outbox"),
    getOptional("/v1/relationship/whatsapp/tasks"),
    getOptional("/v1/relationship/whatsapp/ocr"),
    getOptional("/v1/relationship/whatsapp/audit"),
    getOptional("/v1/relationship/ura/config"),
    getOptional("/v1/relationship/ura/flows"),
    getOptional("/v1/relationship/ura/live"),
    getOptional("/v1/relationship/ura/audit"),
    getOptional("/v1/relationship/ura/readiness"),
    getOptional("/v1/relationship/ura/events"),
    getOptional("/v1/relationship/ura/connector"),
    getOptional("/v1/relationship/ura/commands"),
    getOptional("/v1/security/users"),
    getOptional("/v1/security/audit"),
    getOptional("/v1/security/readiness"),
    getOptional("/v1/security/deployment"),
    getOptional("/v1/registries"),
    ...registryTypes.map((type) => getOptional(`/v1/registries/${type}`)),
    getOptional("/v1/settings/navigation"),
    getOptional("/v1/appointments/notes"),
    getOptional("/health", false),
    getOptional("/v1", false)
  ]);

  [
    state.patients,
    state.appointments,
    state.frontdeskSnapshot,
    state.totemQueues,
    state.totemCounters,
    state.totemTickets,
    state.totemCalls,
    state.totemDisplay,
    state.totemDisplayConfig,
    state.totemAudit,
    state.worklist,
    state.pacsStudies,
    state.laboratoryOrders,
    state.laboratorySamples,
    state.laboratoryInterfaces,
    state.supportLabExams,
    state.invoices,
    state.billingBatches,
    state.billingDenials,
    state.doctorPayouts,
    state.finance,
    state.relationshipQueues,
    state.relationshipCalls,
    state.whatsappConfig,
    state.whatsappReadiness,
    state.whatsappSafetyDashboard,
    state.whatsappFlows,
    state.whatsappTemplates,
    state.whatsappAutonomyRules,
    state.whatsappAutonomyProfiles,
    state.whatsappJourneys,
    state.whatsappPrepRules,
    state.whatsappEvolution,
    state.whatsappSupervision,
    state.whatsappExceptions,
    state.whatsappAutonomyReviews,
    state.whatsappProfileUpdates,
    state.whatsappConsents,
    state.whatsappConversations,
    state.whatsappMessages,
    state.whatsappOutbox,
    state.whatsappTasks,
    state.whatsappOcr,
    state.whatsappAudit,
    state.uraConfig,
    state.uraFlows,
    state.uraLiveCalls,
    state.uraAudit,
    state.uraReadiness,
    state.uraEvents,
    state.uraConnector,
    state.uraCommands,
    state.users,
    state.securityAudit,
    state.securityReadiness,
    state.securityDeployment,
    state.registries
  ] = results.slice(0, 57).map((response, index) => {
    if (index === 2) return response?.data ?? null;
    if (index === 7) return response?.data ?? null;
    if (index === 8) return response?.data ?? null;
    if (index === 23) return response?.data ?? null;
    if (index === 24) return response?.data ?? null;
    if (index === 25) return response?.data ?? null;
    if (index === 32) return response?.data ?? null;
    if (index === 33) return response?.data ?? null;
    if (index === 34) return response?.data ?? null;
    if (index === 35) return response?.data ?? null;
    if (index === 44) return response?.data ?? null;
    if (index === 48) return response?.data ?? null;
    if (index === 50) return response?.data ?? null;
    if (index === 54) return response?.data ?? null;
    if (index === 55) return response?.data ?? null;
    return response?.data ?? [];
  });

  const registryStart = 57;
  state.registryData = Object.fromEntries(
    registryTypes.map((type, index) => [type, results[registryStart + index]?.data ?? []])
  );
  const navigationIndex = registryStart + registryTypes.length;
  state.navigationOverrides = results[navigationIndex]?.data ?? [];
  state.appointmentNotes = results[navigationIndex + 1]?.data ?? [];
  state.apiHealth = results[navigationIndex + 2]?.data ?? null;
  state.apiInfo = results[navigationIndex + 3]?.data ?? null;
  renderNavigation();
  syncRoute();

  render();
}

function render() {
  renderSession();
  renderDashboard();
  renderAttendance();
  renderAppointmentDetail();
  renderTotem();
  renderImaging();
  renderLaboratory();
  renderBilling();
  renderFinance();
  renderRelationship();
  renderSecurity();
  renderHumanResources();
  renderRegistries();
  renderMenuAudit();
  renderSettingsReadiness();
  renderAccessDenied();
  applyPermissionState();
}

function renderSettingsReadinessLegacy() {
  const updateTile = (route, ready, total, pendingLabel) => {
    const tile = document.querySelector(`.settings-module-tile[data-route="${route}"]`);
    const meta = document.querySelector(`[data-settings-meta="${route}"]`);
    if (!tile || !meta) return;
    const ok = ready >= total;
    meta.textContent = `${ready}/${total}${ok ? " pronto" : ` · falta ${pendingLabel}`}`;
    tile.classList.toggle("warn", !ok);
  };

  const active = (type) => (state.registryData?.[type] ?? []).filter((row) => row.status !== "inactive");
  const check = (value) => (value ? 1 : 0);

  const attendanceChecks = [
    check(active("branches").length > 0),
    check(active("units").length > 0),
    check(active("rooms").length > 0),
    check(active("procedures").length > 0)
  ];
  updateTile("settings-attendance", attendanceChecks.reduce((a, b) => a + b, 0), attendanceChecks.length, "cadastros");

  const imagingChecks = [
    check((state.worklist ?? []).length > 0),
    check((state.pacsStudies ?? []).length > 0)
  ];
  updateTile("settings-imaging", imagingChecks.reduce((a, b) => a + b, 0), imagingChecks.length, "worklist/pacs");

  const labChecks = [
    check((state.laboratoryInterfaces ?? []).length > 0),
    check((active("procedures").filter((row) => normalize(`${row.modality ?? ""} ${row.name ?? ""}`).includes("lab")).length > 0))
  ];
  updateTile("settings-laboratory", labChecks.reduce((a, b) => a + b, 0), labChecks.length, "LIS/procedimentos");

  const financeChecks = [
    check(active("financial-categories").length > 0),
    check(active("cost-centers").length > 0),
    check(active("accounts").length > 0),
    check(active("payment-methods").length > 0)
  ];
  updateTile("settings-finance", financeChecks.reduce((a, b) => a + b, 0), financeChecks.length, "cadastros");

  const relationshipChecks = [
    check(state.uraReadiness?.status && state.uraReadiness?.status !== "needs_configuration"),
    check(state.whatsappReadiness?.status && state.whatsappReadiness?.status !== "needs_configuration"),
    check((state.relationshipQueues ?? []).length > 0)
  ];
  updateTile("settings-relationship", relationshipChecks.reduce((a, b) => a + b, 0), relationshipChecks.length, "URA/WhatsApp");

  const securityChecks = [
    check((state.users ?? []).some((user) => user.role === "admin" && user.status !== "inactive")),
    check((state.securityReadiness?.checks ?? []).some((item) => item.id === "backup" && item.status === "ready")),
    check((state.securityAudit ?? []).length > 0)
  ];
  updateTile("settings-security", securityChecks.reduce((a, b) => a + b, 0), securityChecks.length, "admin/backup");

  const hrChecks = [check(active("employees").length > 0)];
  updateTile("human-resources", hrChecks.reduce((a, b) => a + b, 0), hrChecks.length, "colaboradores");
}

function buildSettingsReadinessModel() {
  const itemId = (route, label) => `${route}::${normalize(label)}`;
  const planFor = (id) => state.settingsPlan?.[id] ?? {};
  const active = (type) => (state.registryData?.[type] ?? []).filter((row) => row.status !== "inactive");
  const check = (ok, label, route = "", priority = "media", moduleRoute = route) => {
    const id = itemId(moduleRoute, label);
    return { ok: Boolean(ok), label, route, priority, id, plan: planFor(id) };
  };
  return {
    "settings-attendance": {
      title: "Atendimento",
      items: [
        check(active("branches").length > 0, "filiais", "settings-registries", "alta", "settings-attendance"),
        check(active("units").length > 0, "unidades", "settings-registries", "alta", "settings-attendance"),
        check(active("rooms").length > 0, "salas", "settings-registries", "alta", "settings-attendance"),
        check(active("procedures").length > 0, "procedimentos", "settings-registries", "alta", "settings-attendance")
      ]
    },
    "settings-imaging": {
      title: "Central de Laudos",
      items: [
        check((state.worklist ?? []).length > 0, "worklist", "imaging-worklist", "alta", "settings-imaging"),
        check((state.pacsStudies ?? []).length > 0, "pacs", "imaging-pacs", "media", "settings-imaging")
      ]
    },
    "settings-laboratory": {
      title: "Laboratorio",
      items: [
        check((state.laboratoryInterfaces ?? []).length > 0, "interface lis", "laboratory-lis", "alta", "settings-laboratory"),
        check(active("procedures").some((row) => normalize(`${row.modality ?? ""} ${row.name ?? ""}`).includes("lab")), "procedimentos lab", "settings-registries", "media", "settings-laboratory")
      ]
    },
    "settings-finance": {
      title: "Financeiro",
      items: [
        check(active("financial-categories").length > 0, "categorias", "settings-registries", "alta", "settings-finance"),
        check(active("cost-centers").length > 0, "centros de custo", "settings-registries", "media", "settings-finance"),
        check(active("accounts").length > 0, "contas", "settings-registries", "alta", "settings-finance"),
        check(active("payment-methods").length > 0, "formas de pagamento", "settings-registries", "media", "settings-finance")
      ]
    },
    "settings-relationship": {
      title: "Relacionamento",
      items: [
        check(state.uraReadiness?.status && state.uraReadiness?.status !== "needs_configuration", "ura", "relationship-ura", "alta", "settings-relationship"),
        check(state.whatsappReadiness?.status && state.whatsappReadiness?.status !== "needs_configuration", "whatsapp", "relationship-whatsapp", "alta", "settings-relationship"),
        check((state.relationshipQueues ?? []).length > 0, "filas", "relationship-ura", "media", "settings-relationship")
      ]
    },
    "settings-security": {
      title: "Seguranca",
      items: [
        check((state.users ?? []).some((user) => user.role === "admin" && user.status !== "inactive"), "usuario admin", "security-users", "alta", "settings-security"),
        check((state.securityReadiness?.checks ?? []).some((item) => item.id === "backup" && item.status === "ready"), "backup", "security-system-state", "alta", "settings-security"),
        check((state.securityAudit ?? []).length > 0, "auditoria", "security-system-state", "baixa", "settings-security")
      ]
    },
    "human-resources": {
      title: "Recursos Humanos",
      items: [check(active("employees").length > 0, "colaboradores", "human-resources", "media", "human-resources")]
    }
  };
}

function updateSettingsPlanField(itemId, field, value) {
  if (!itemId || !field) return;
  if (!state.settingsPlan[itemId]) state.settingsPlan[itemId] = {};
  state.settingsPlan[itemId][field] = String(value ?? "");
  localStorage.setItem(settingsPlanKey, JSON.stringify(state.settingsPlan));
}

function renderSettingsReadiness() {
  const updateTile = (route, checks) => {
    const tile = document.querySelector(`.settings-module-tile[data-route="${route}"]`);
    const meta = document.querySelector(`[data-settings-meta="${route}"]`);
    if (!tile) return { route, checks, ready: 0, total: checks.length };
    const total = checks.length;
    const ready = checks.filter((item) => item.ok).length;
    const pending = checks.filter((item) => !item.ok).map((item) => item.label);
    const isReady = ready >= total;
    const pendingText = pending.length ? pending.join(", ") : "";
    if (meta) meta.textContent = `${ready}/${total}${isReady ? " pronto" : ` - falta ${pendingText}`}`;
    tile.title = isReady ? "Configuracao pronta" : `Falta: ${pendingText}`;
    tile.classList.toggle("warn", !isReady);
    tile.classList.toggle("ok", isReady);
    tile.classList.toggle("selected", state.selectedSettingsModule === route);
    return { route, checks, ready, total };
  };

  const readiness = buildSettingsReadinessModel();

  const routes = Object.keys(readiness);
  if (!routes.includes(state.selectedSettingsModule)) {
    state.selectedSettingsModule = "settings-attendance";
  }
  const summaries = routes.map((route) => updateTile(route, readiness[route].items));
  const selectedSummary = summaries.find((item) => item.route === state.selectedSettingsModule) ?? summaries[0];
  const selectedReadiness = readiness[selectedSummary.route];

  if (els.settingsChecklistTitle) {
    els.settingsChecklistTitle.textContent = `Checklist · ${selectedReadiness.title}`;
  }
  if (els.settingsChecklistBadge) {
    const ok = selectedSummary.ready >= selectedSummary.total;
    els.settingsChecklistBadge.textContent = `${selectedSummary.ready}/${selectedSummary.total}${ok ? " pronto" : ""}`;
    els.settingsChecklistBadge.classList.toggle("warn", !ok);
  }
  if (els.settingsPendingOnlyToggle) {
    els.settingsPendingOnlyToggle.checked = Boolean(state.settingsPendingOnly);
  }
  if (els.settingsChecklistList) {
    const items = state.settingsPendingOnly ? selectedSummary.checks.filter((item) => !item.ok) : selectedSummary.checks;
    els.settingsChecklistList.innerHTML = items
      .map((item) => `
        <div class="settings-check-item ${item.ok ? "ok" : "pending"}">
          <span>${item.ok ? "OK" : "!"}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <em class="settings-priority ${item.priority ?? "media"}">${escapeHtml(item.priority ?? "media")}</em>
          <small>${item.ok ? "configurado" : "pendente"}</small>
          <div class="settings-plan-row">
            <input data-plan-item="${escapeHtml(item.id)}" data-plan-field="owner" placeholder="Responsavel" value="${escapeHtml(item.plan?.owner ?? "")}" />
            <input data-plan-item="${escapeHtml(item.id)}" data-plan-field="dueDate" type="date" value="${escapeHtml(item.plan?.dueDate ?? "")}" />
            <select data-plan-item="${escapeHtml(item.id)}" data-plan-field="status">
              <option value="novo" ${(item.plan?.status ?? "novo") === "novo" ? "selected" : ""}>novo</option>
              <option value="em_andamento" ${(item.plan?.status ?? "") === "em_andamento" ? "selected" : ""}>em andamento</option>
              <option value="bloqueado" ${(item.plan?.status ?? "") === "bloqueado" ? "selected" : ""}>bloqueado</option>
              <option value="concluido" ${(item.plan?.status ?? "") === "concluido" ? "selected" : ""}>concluido</option>
            </select>
          </div>
          ${!item.ok && item.route ? `<button type="button" class="secondary settings-resolve-button" data-resolve-route="${escapeHtml(item.route)}">Resolver agora</button>` : ""}
        </div>
      `)
      .join("");
  }
}

async function handleSettingsSnapshotExport() {
  const readiness = buildSettingsReadinessModel();
  const lines = [`Snapshot tecnico - ${new Date().toLocaleString("pt-BR")}`];
  Object.entries(readiness).forEach(([route, module]) => {
    const total = module.items.length;
    const ready = module.items.filter((item) => item.ok).length;
    const pending = module.items.filter((item) => !item.ok);
    lines.push(`- ${module.title}: ${ready}/${total}`);
    pending.forEach((item) => {
      const owner = item.plan?.owner || "sem responsavel";
      const dueDate = item.plan?.dueDate || "sem prazo";
      const status = item.plan?.status || "novo";
      lines.push(`  - [${item.priority}] ${item.label} -> #${item.route || route} | ${owner} | ${dueDate} | ${status}`);
    });
  });
  const snapshot = lines.join("\n");
  try {
    await navigator.clipboard.writeText(snapshot);
    if (els.settingsSnapshotButton) els.settingsSnapshotButton.textContent = "Copiado";
  } catch {
    if (els.settingsSnapshotButton) els.settingsSnapshotButton.textContent = "Falha ao copiar";
  }
  setTimeout(() => {
    if (els.settingsSnapshotButton) els.settingsSnapshotButton.textContent = "Exportar snapshot";
  }, 1800);
}

function renderSession() {
  els.sessionChip.textContent = state.user ? `${state.user.name} · ${roleLabel(state.user.role)}` : "sem sessao";
}

function renderDashboard() {
  const totalReceivable = state.finance.filter((entry) => entry.direction === "receivable").reduce((sum, entry) => sum + Number(entry.amountCents ?? 0), 0);
  const totalPayable = state.finance.filter((entry) => entry.direction === "payable").reduce((sum, entry) => sum + Number(entry.amountCents ?? 0), 0);
  els.dashboardSummary.innerHTML = [
    summaryCard("Pacientes", state.patients.length),
    summaryCard("Atendimentos", state.appointments.length),
    summaryCard("Worklist", state.worklist.length),
    summaryCard("Faturas", state.invoices.length),
    summaryCard("Saldo previsto", currency.format((totalReceivable - totalPayable) / 100))
  ].join("");
  els.appointmentCount.textContent = `${state.appointments.length} atendimento(s)`;
  renderList(els.dashboardAppointments, state.appointments.slice(0, 8), appointmentItem);
}

function renderAttendance() {
  renderFrontdesk();
  renderWalkin();
  renderEmergency();
  renderSelect(els.appointmentPatientSelect, state.patients, "Selecione o paciente", (patient) => patient.id, (patient) => patient.fullName);
  renderSelect(els.invoicePatientSelect, state.patients, "Selecione o paciente", (patient) => patient.id, (patient) => patient.fullName);
  renderSelect(els.appointmentDoctorSelect, registryRows("doctors"), "Selecione o medico", (row) => registryValue(row), (row) => doctorLabel(row));
  renderSelect(els.appointmentProcedureSelect, activeRegistryRows("procedures"), "Procedimento", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`);
  renderSelect(els.appointmentBranchSelect, activeRegistryRows("branches"), "Filial", (row) => row.name, (row) => row.name, false);
  renderSelect(els.appointmentUnitSelect, activeRegistryRows("units"), "Unidade", (row) => row.name, (row) => row.name, false);
  renderSelect(els.appointmentInsuranceSelect, activeRegistryRows("insurances"), "Particular", (row) => row.name, (row) => row.name, false);
  renderAppointmentDependentFields(false);
  renderList(els.appointmentsList, state.appointments, appointmentItem);
}

function renderAppointmentDependentFields(forceDuration = false) {
  const procedure = selectedRegistryRow("procedures", els.appointmentProcedureSelect?.value);
  const insurance = selectedRegistryRow("insurances", els.appointmentInsuranceSelect?.value);
  const branchName = els.appointmentBranchSelect?.value ?? "";
  const unitName = els.appointmentUnitSelect?.value ?? "";
  const plans = insurance?.name
    ? activeRegistryRows("plans").filter((plan) => normalize(plan.insurance) === normalize(insurance.name))
    : [];
  const rooms = compatibleAppointmentRooms(procedure, branchName, unitName);
  renderSelect(els.appointmentPlanSelect, plans, "Plano", (row) => row.name, (row) => row.name, Boolean(insurance?.name && plans.length));
  renderSelect(els.appointmentRoomSelect, rooms, "Sala", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`, true);

  const guideRequired = isGuideRequired(insurance);
  els.appointmentGuideInput.required = guideRequired;
  els.appointmentMemberInput.required = Boolean(insurance?.name && normalize(insurance.name) !== "particular");
  if (forceDuration) applyProcedureDuration(procedure);
  renderAppointmentRulePreview({ procedure, insurance, rooms });
}

function renderAppointmentRulePreview({ procedure, insurance, rooms }) {
  if (!els.appointmentRulePreview) return;
  const duration = procedureDurationMinutes(procedure);
  const guideRequired = isGuideRequired(insurance);
  const room = rooms.find((item) => item.name === els.appointmentRoomSelect.value) ?? rooms[0];
  const chips = [
    procedure?.modality ? `Modalidade ${procedure.modality}` : "Modalidade a definir",
    procedure?.duration ? `Duração ${procedure.duration}` : `Duração ${duration} min`,
    insurance?.name ? `${insurance.name}${guideRequired ? " exige guia" : " sem guia obrigatória"}` : "Particular / sem guia",
    room ? `Sala sugerida: ${room.name}` : "Sem sala compatível cadastrada"
  ];
  els.appointmentRulePreview.innerHTML = `
    <div class="rule-preview-row">
      ${chips.map((chip) => `<span class="badge ${guideRequired && chip.includes("exige") ? "warn" : ""}">${escapeHtml(chip)}</span>`).join("")}
    </div>
    <small>${escapeHtml(procedure?.preparation ?? procedure?.prep ?? procedure?.instructions ?? "Sem preparo cadastrado para este procedimento.")}</small>
  `;
}

function renderFrontdesk() {
  if (!els.frontdeskSummary) return;
  const appointments = state.appointments
    .slice()
    .sort((a, b) => new Date(a.startsAt ?? a.createdAt ?? 0).getTime() - new Date(b.startsAt ?? b.createdAt ?? 0).getTime());
  renderFrontdeskFilterOptions();
  syncFrontdeskFilterForm();
  const filteredAppointments = filterFrontdeskAppointments(appointments);
  const active = filteredAppointments.filter((appointment) => !["completed", "cancelled", "no_show"].includes(appointment.status));
  const preAttendance = active.filter((appointment) => ["scheduled", "confirmed"].includes(appointment.status));
  const arrived = active.filter((appointment) => appointment.status === "checked_in");
  const inAttendance = active.filter((appointment) => appointment.status === "in_attendance");
  const pending = active.filter((appointment) => appointmentPendencies(appointment).length);
  const completedToday = filteredAppointments.filter((appointment) => appointment.status === "completed");

  els.frontdeskFilteredCount.textContent = `${filteredAppointments.length} registro(s)`;
  els.frontdeskTableCount.textContent = `${filteredAppointments.length} atendimento(s)`;
  els.frontdeskActiveCount.textContent = `${active.length} ativos`;
  els.frontdeskPendingCount.textContent = `${pending.length} pendencias`;
  els.frontdeskSummary.innerHTML = [
    summaryCard("Pre-atendimento", preAttendance.length),
    summaryCard("Chegada", arrived.length),
    summaryCard("Sala/exame", inAttendance.length),
    summaryCard("Pendencias", pending.length),
    summaryCard("Concluidos", completedToday.length)
  ].join("");

  els.frontdeskJourney.innerHTML = [
    frontdeskStage("Pre-atendimento", preAttendance, "Confirmar dados, convênio, guia e pedido antes da chegada."),
    frontdeskStage("Chegada", arrived, "Paciente presente aguardando encaminhamento."),
    frontdeskStage("Sala/exame", inAttendance, "Paciente encaminhado para execução do procedimento."),
    frontdeskStage("Finalizacao", completedToday.slice(0, 6), "Atendimento concluido e pronto para faturamento/laudo.")
  ].join("");

  renderFrontdeskTable(filteredAppointments);
  renderList(els.frontdeskQueueList, active, frontdeskQueueItem);
  renderList(els.frontdeskDetailList, active.slice(0, 8), frontdeskDetailItem);
}

function renderFrontdeskFilterOptions() {
  renderSelect(els.frontdeskBranchFilter, activeRegistryRows("branches"), "Todas", (row) => row.name, (row) => row.name, false);
  renderSelect(els.frontdeskUnitFilter, activeRegistryRows("units"), "Todas", (row) => row.name, (row) => row.name, false);
  renderSelect(els.frontdeskRoomFilter, activeRegistryRows("rooms"), "Todas", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`, false);
  renderSelect(els.frontdeskInsuranceFilter, activeRegistryRows("insurances"), "Todos", (row) => row.name, (row) => row.name, false);
  renderSelect(els.frontdeskPlanFilter, activeRegistryRows("plans"), "Todos", (row) => row.name, (row) => row.name, false);
  const modalities = [...new Set([
    ...activeRegistryRows("rooms").map((row) => row.modality),
    ...activeRegistryRows("procedures").map((row) => row.modality),
    ...state.appointments.map((row) => row.modality)
  ].filter(Boolean))].map((modality) => ({ modality }));
  renderSelect(els.frontdeskModalityFilter, modalities, "Todas", (row) => row.modality, (row) => row.modality, false);
}

function syncFrontdeskFilterForm() {
  if (!els.frontdeskFilterForm) return;
  Object.entries(state.frontdeskFilters ?? {}).forEach(([key, value]) => {
    const field = els.frontdeskFilterForm.elements[key];
    if (field && field.value !== value) field.value = value;
  });
}

function filterFrontdeskAppointments(appointments) {
  const filters = state.frontdeskFilters ?? {};
  const search = normalize(filters.search);
  return appointments.filter((appointment) => {
    const patient = patientById(appointment.patientId);
    const pendencies = appointmentPendencies(appointment);
    const haystack = normalize([
      patient?.fullName,
      patient?.documentNumber,
      patient?.birthDate,
      patient?.phone,
      appointment.patientName,
      appointment.procedureName,
      appointment.status,
      appointment.insuranceName,
      appointment.planName,
      appointment.roomName,
      appointment.modality,
      appointment.guideNumber,
      appointment.memberId,
      appointment.accessionNumber,
      appointment.paymentCode,
      appointment.professionalId,
      appointment.requesterDoctor,
      appointment.executorDoctor,
      appointment.reportDoctor
    ].filter(Boolean).join(" "));
    if (search && !haystack.includes(search)) return false;
    if (filters.dateFrom && String(appointment.startsAt ?? "").slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && String(appointment.startsAt ?? "").slice(0, 10) > filters.dateTo) return false;
    if (filters.branchName && appointment.branchName !== filters.branchName) return false;
    if (filters.unitName && appointment.unitName !== filters.unitName) return false;
    if (filters.roomName && appointment.roomName !== filters.roomName) return false;
    if (filters.modality && appointment.modality !== filters.modality) return false;
    if (filters.insuranceName && appointment.insuranceName !== filters.insuranceName) return false;
    if (filters.planName && appointment.planName !== filters.planName) return false;
    if (filters.status && appointment.status !== filters.status) return false;
    if (filters.doctor && !normalize(`${appointment.professionalId ?? ""} ${appointment.requesterDoctor ?? ""} ${appointment.executorDoctor ?? ""} ${appointment.reportDoctor ?? ""}`).includes(normalize(filters.doctor))) return false;
    if (filters.paymentCode && !normalize(appointment.paymentCode).includes(normalize(filters.paymentCode))) return false;
    if (filters.flow === "pending" && !pendencies.length) return false;
    if (filters.flow === "authorized" && appointment.authorizationStatus !== "authorized") return false;
    if (filters.flow === "authorization_pending" && appointment.authorizationStatus !== "pending") return false;
    if (filters.flow === "guide_missing" && !(appointment.guideRequired && !appointment.guideNumber)) return false;
    if (filters.flow === "walk_in" && appointment.attendanceType !== "walk_in") return false;
    if (filters.flow === "urgent_care" && appointment.attendanceType !== "urgent_care") return false;
    if (filters.flow === "completed" && appointment.status !== "completed") return false;
    if (filters.flow === "billing_pending" && !(appointment.status === "completed" && appointment.fiscalStatus !== "issued")) return false;
    return true;
  });
}

function renderFrontdeskTable(rows) {
  if (!els.frontdeskTableBody) return;
  els.frontdeskTableBody.innerHTML = rows.length
    ? rows.map(frontdeskTableRow).join("")
    : `<tr><td colspan="10"><div class="empty-state">Nenhum atendimento encontrado com os filtros atuais.</div></td></tr>`;
}

function frontdeskTableRow(appointment) {
  const patient = patientById(appointment.patientId);
  const pendencies = appointmentPendencies(appointment);
  const snapshot = frontdeskSnapshotRow(appointment);
  const date = appointment.startsAt ? new Date(appointment.startsAt) : null;
  return `
    <tr>
      <td>
        <div class="table-actions">
          ${frontdeskActions(appointment)}
        </div>
      </td>
      <td>${escapeHtml(date ? date.toLocaleDateString("pt-BR") : "")}</td>
      <td>${escapeHtml(date ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "")}</td>
      <td><strong>${escapeHtml(patient?.fullName ?? appointment.patientName ?? appointment.patientId)}</strong><small>${escapeHtml(patient?.documentNumber ?? appointment.patientId ?? "")}</small></td>
      <td>${escapeHtml(appointment.procedureName ?? "Atendimento")}<small>${escapeHtml(appointment.accessionNumber ?? "")}</small></td>
      <td><span class="badge">${escapeHtml(statusLabel(appointment.status))}</span><small>${escapeHtml(stageTimeLabel(appointment))}</small></td>
      <td>${escapeHtml(appointment.insuranceName ?? "Particular")}<small>${escapeHtml(appointment.planName ?? "")}</small></td>
      <td>${escapeHtml(appointment.roomName ?? "Sala pendente")}<small>${escapeHtml(appointment.modality ?? "")}</small></td>
      <td>${escapeHtml(appointment.requesterDoctor ?? appointment.executorDoctor ?? appointment.professionalId ?? "")}</td>
      <td>
        ${pendencies.length ? pendencies.map((item) => `<span class="badge warn">${escapeHtml(item)}</span>`).join(" ") : `<span class="badge">pronto</span>`}
        <small>${escapeHtml(snapshot?.nextAction ?? frontdeskNextAction(appointment))}</small>
      </td>
    </tr>
  `;
}

function renderWalkin() {
  if (!els.walkinForm) return;
  renderSelect(els.walkinPatientSelect, state.patients, "Selecione um paciente", (patient) => patient.id, (patient) => patient.fullName);
  renderSelect(els.walkinBranchSelect, activeRegistryRows("branches"), "Selecione uma filial", (row) => row.name, (row) => row.name, false);
  renderSelect(els.walkinInsuranceSelect, activeRegistryRows("insurances"), "Selecione um convenio", (row) => row.name, (row) => row.name, false);
  renderSelect(els.walkinProcedureSelect, activeRegistryRows("procedures"), "Selecione um procedimento", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`);
  renderSelect(els.walkinDoctorSelect, registryRows("doctors"), "Selecione um medico", (row) => registryValue(row), (row) => doctorLabel(row));
  if (!els.walkinDateInput.value) els.walkinDateInput.value = new Date().toISOString().slice(0, 10);
  if (!els.walkinTimeInput.value) els.walkinTimeInput.value = toLocalDateTime(new Date()).slice(11, 16);
  renderWalkinDependentFields();
  renderWalkinItems();
}

function renderWalkinDependentFields() {
  if (!els.walkinForm) return;
  const procedure = selectedRegistryRow("procedures", els.walkinProcedureSelect?.value);
  const insurance = selectedRegistryRow("insurances", els.walkinInsuranceSelect?.value);
  const rooms = compatibleAppointmentRooms(procedure, els.walkinBranchSelect?.value ?? "", "");
  const plans = insurance?.name
    ? activeRegistryRows("plans").filter((plan) => normalize(plan.insurance) === normalize(insurance.name))
    : [];
  renderSelect(els.walkinPlanSelect, plans, "Selecione um plano", (row) => row.name, (row) => row.name, Boolean(plans.length));
  renderSelect(els.walkinRoomSelect, rooms, "Selecione uma sala", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`, true);
  const guideRequired = isGuideRequired(insurance);
  els.walkinGuideInput.required = guideRequired;
  els.walkinMemberInput.required = Boolean(insurance?.name && normalize(insurance.name) !== "particular");
}

function renderWalkinItems() {
  if (!els.walkinItemsTable) return;
  els.walkinItemsCount.textContent = `${state.walkinItems.length} item(ns)`;
  els.walkinItemsTable.innerHTML = state.walkinItems.length
    ? state.walkinItems.map((item, index) => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(item.time)}</td>
        <td>${escapeHtml(item.procedureName)}</td>
        <td>${escapeHtml(item.roomName)}</td>
        <td>${escapeHtml(item.requesterDoctor ?? "")}</td>
        <td>${escapeHtml(item.professionalId ?? "")}</td>
        <td>${escapeHtml(item.guideNumber ?? "")}</td>
        <td><button class="secondary icon-button" type="button" data-walkin-remove="${index}">Remover</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="8"><div class="empty-state">Nenhum procedimento adicionado ao encaixe.</div></td></tr>`;
}

function renderEmergency() {
  if (!els.emergencyForm) return;
  renderSelect(els.emergencyPatientSelect, state.patients, "Selecione um paciente", (patient) => patient.id, (patient) => patient.fullName);
  renderSelect(els.emergencyBranchSelect, activeRegistryRows("branches"), "Selecione uma filial", (row) => row.name, (row) => row.name, false);
  renderSelect(els.emergencyInsuranceSelect, activeRegistryRows("insurances"), "Particular", (row) => row.name, (row) => row.name, false);
  renderSelect(els.emergencyProcedureSelect, activeRegistryRows("procedures"), "Selecione um procedimento", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`);
  renderSelect(els.emergencyDoctorSelect, registryRows("doctors"), "Selecione um medico", (row) => registryValue(row), (row) => doctorLabel(row));
  renderSelect(els.emergencyCounterSelect, state.totemCounters, "Selecione o display", (counter) => counter.id, (counter) => `${counter.name}${counter.location ? ` - ${counter.location}` : ""}`);
  renderEmergencyDependentFields();
  renderEmergencyQueue();
}

function renderEmergencyDependentFields() {
  if (!els.emergencyForm) return;
  const procedure = selectedRegistryRow("procedures", els.emergencyProcedureSelect?.value);
  const insurance = selectedRegistryRow("insurances", els.emergencyInsuranceSelect?.value);
  const rooms = compatibleAppointmentRooms(procedure, els.emergencyBranchSelect?.value ?? "", "");
  const plans = insurance?.name
    ? activeRegistryRows("plans").filter((plan) => normalize(plan.insurance) === normalize(insurance.name))
    : [];
  renderSelect(els.emergencyPlanSelect, plans, "Selecione um plano", (row) => row.name, (row) => row.name, Boolean(plans.length));
  renderSelect(els.emergencyRoomSelect, rooms, "Selecione uma sala", (row) => row.name, (row) => `${row.name}${row.modality ? ` - ${row.modality}` : ""}`, true);
  const guideRequired = isGuideRequired(insurance);
  els.emergencyGuideInput.required = guideRequired;
  els.emergencyMemberInput.required = Boolean(insurance?.name && normalize(insurance.name) !== "particular");
}

function renderEmergencyQueue() {
  if (!els.emergencyQueueTable) return;
  const rows = state.appointments
    .filter((appointment) => appointment.attendanceType === "urgent_care")
    .filter((appointment) => !["completed", "cancelled", "no_show"].includes(appointment.status))
    .sort((a, b) => emergencyPriorityWeight(b.priority) - emergencyPriorityWeight(a.priority) || emergencyStageWeight(a.emergencyStage) - emergencyStageWeight(b.emergencyStage) || new Date(a.startsAt ?? a.createdAt ?? 0) - new Date(b.startsAt ?? b.createdAt ?? 0));
  const urgentCareRows = state.appointments.filter((appointment) => appointment.attendanceType === "urgent_care");
  const waitingTriage = rows.filter((appointment) => emergencyStageValue(appointment) === "triage_waiting").length;
  const triageStarted = rows.filter((appointment) => emergencyStageValue(appointment) === "triage_started").length;
  const triaged = rows.filter((appointment) => emergencyStageValue(appointment) === "triaged").length;
  const inCare = rows.filter((appointment) => emergencyStageValue(appointment) === "in_care").length;
  const referred = rows.filter((appointment) => emergencyStageValue(appointment) === "referred_exam").length;
  const referredLab = rows.filter((appointment) => emergencyStageValue(appointment) === "referred_lab").length;
  const completed = urgentCareRows.filter((appointment) => appointment.status === "completed" || emergencyStageValue(appointment) === "completed").length;
  if (els.emergencySummary) {
    els.emergencySummary.innerHTML = [
      summaryCard("Aguardando triagem", waitingTriage),
      summaryCard("Em triagem", triageStarted),
      summaryCard("Triados", triaged),
      summaryCard("Em atendimento", inCare),
      summaryCard("Imagem", referred),
      summaryCard("Laboratório", referredLab),
      summaryCard("Finalizados", completed)
    ].join("");
  }
  els.emergencyQueueCount.textContent = `${rows.length} ativo(s)`;
  els.emergencyQueueTable.innerHTML = rows.length
    ? rows.map((appointment) => {
      const patient = patientById(appointment.patientId);
      const arrival = appointment.startsAt ? new Date(appointment.startsAt) : null;
      const actions = emergencyStageActions(appointment);
      return `
        <tr>
          <td><span class="badge ${emergencyPriorityClass(appointment.priority)}">${escapeHtml(emergencyPriorityLabel(appointment.priority))}</span><small>${escapeHtml(emergencyTicketLabel(appointment))}</small></td>
          <td>${escapeHtml(arrival ? arrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "")}</td>
          <td><strong>${escapeHtml(patient?.fullName ?? appointment.patientName ?? appointment.patientId)}</strong><small>${escapeHtml(`${emergencyTriageLabel(appointment.triageColor)} · ${appointment.chiefComplaint ?? ""}`)}</small></td>
          <td>${escapeHtml(appointment.procedureName ?? "Pronto atendimento")}</td>
          <td><span class="badge">${escapeHtml(emergencyStageLabel(appointment.emergencyStage))}</span><small>${escapeHtml(statusLabel(appointment.status))}</small></td>
          <td>${escapeHtml(appointment.roomName ?? "Sala pendente")}</td>
          <td>${escapeHtml(appointment.executorDoctor ?? appointment.professionalId ?? "")}</td>
          <td>
            <div class="table-actions">
              ${emergencyDisplayActions(appointment)}
              ${emergencyWorklistActions(appointment)}
              ${emergencyLabActions(appointment)}
              ${actions.map((action) => `<button class="secondary icon-button" type="button" data-emergency-stage="${escapeHtml(action.stage)}" data-appointment-id="${escapeHtml(appointment.id)}">${escapeHtml(action.label)}</button>`).join("")}
              <button class="secondary icon-button" type="button" data-appointment-detail="${escapeHtml(appointment.id)}">Abrir</button>
            </div>
          </td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="8"><div class="empty-state">Nenhum pronto atendimento ativo agora.</div></td></tr>`;
}

function renderAppointmentDetail() {
  if (!els.appointmentDetailContent) return;
  const appointment = selectedAppointment();
  if (!appointment) {
    els.appointmentDetailTitle.textContent = "Nenhum atendimento selecionado";
    els.appointmentDetailStatus.textContent = "sem atendimento";
    els.appointmentDetailContent.innerHTML = `<div class="panel empty-state">Selecione um atendimento na Recepção ou Agenda para abrir o detalhe operacional.</div>`;
    return;
  }

  const patient = patientById(appointment.patientId);
  els.appointmentDetailTitle.textContent = `${patient?.fullName ?? appointment.patientName ?? "Paciente"} - ${appointment.procedureName ?? "Atendimento"}`;
  els.appointmentDetailStatus.textContent = statusLabel(appointment.status);
  els.appointmentDetailTabs.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.detailTab === state.selectedAppointmentDetailTab);
  });

  const tab = state.selectedAppointmentDetailTab;
  const renderers = {
    attendance: () => appointmentAttendanceTab(appointment),
    patient: () => appointmentPatientTab(appointment, patient),
    finance: () => appointmentFinanceTab(appointment),
    tiss: () => appointmentTissTab(appointment),
    material: () => appointmentMaterialTab(appointment),
    documents: () => appointmentDocumentsTab(appointment),
    report: () => appointmentReportTab(appointment),
    notes: () => appointmentNotesTab(appointment),
    honorary: () => appointmentHonoraryTab(appointment),
    associated: () => appointmentAssociatedTab(appointment)
  };
  els.appointmentDetailContent.innerHTML = (renderers[tab] ?? renderers.attendance)();
}

function appointmentAttendanceTab(appointment) {
  const snapshot = frontdeskSnapshotRow(appointment);
  return `
    <form class="panel form-grid detail-form" data-appointment-edit="${escapeHtml(appointment.id)}">
      <div class="panel-heading"><h2>Atendimento</h2><span class="badge">${escapeHtml(appointment.accessionNumber ?? "sem accession")}</span></div>
      <div class="frontdesk-next-action span-2">
        <span class="badge ${appointmentPendencies(appointment).length ? "warn" : ""}">${escapeHtml(snapshot?.nextAction ?? frontdeskNextAction(appointment))}</span>
        <small>${escapeHtml(stageTimeLabel(appointment))}</small>
      </div>
      ${detailInput("Procedimento", "procedureName", appointment.procedureName)}
      ${detailInput("Sala", "roomName", appointment.roomName)}
      ${detailInput("Inicio", "startsAt", toLocalInputValue(appointment.startsAt), "datetime-local")}
      ${detailInput("Fim", "endsAt", toLocalInputValue(appointment.endsAt), "datetime-local")}
      ${detailInput("ID sistema externo", "externalSystemId", appointment.externalSystemId)}
      ${detailInput("Procedencia", "origin", appointment.origin)}
      ${detailInput("Convenio", "insuranceName", appointment.insuranceName)}
      ${detailInput("Plano", "planName", appointment.planName)}
      ${detailInput("Matricula", "memberId", appointment.memberId)}
      ${detailInput("Guia", "guideNumber", appointment.guideNumber)}
      ${detailInput("Senha autorizacao", "authorizationCode", appointment.authorizationCode)}
      <label>Status autorizacao ${selectField("authorizationStatus", appointment.authorizationStatus, [["not_required", "Nao exige"], ["pending", "Pendente"], ["authorized", "Autorizado"], ["denied", "Negado"]])}</label>
      ${detailInput("Guia operadora", "operatorGuide", appointment.operatorGuide)}
      ${detailInput("Guia principal", "mainGuide", appointment.mainGuide)}
      ${detailInput("CID", "cid", appointment.cid)}
      ${detailInput("Indicacao clinica", "clinicalIndication", appointment.clinicalIndication)}
      ${appointment.attendanceType === "urgent_care" ? emergencyDetailFields(appointment) : ""}
      ${detailInput("CRM solicitante", "requesterCrm", appointment.requesterCrm)}
      ${detailInput("Medico solicitante", "requesterDoctor", appointment.requesterDoctor)}
      ${detailInput("CRM executor", "executorCrm", appointment.executorCrm)}
      ${detailInput("Medico executor", "executorDoctor", appointment.executorDoctor)}
      ${detailInput("CRM revisor", "reviewerCrm", appointment.reviewerCrm)}
      ${detailInput("Medico revisor", "reviewerDoctor", appointment.reviewerDoctor)}
      <label>Utiliza anestesia ${selectField("anesthesia", appointment.anesthesia, [["Nao", "Nao"], ["Sim", "Sim"]])}</label>
      ${detailInput("Medico anestesista", "anesthetistDoctor", appointment.anesthetistDoctor)}
      ${detailInput("Senha totem", "totemTicketNumber", appointment.totemTicketNumber)}
      <label class="span-2">Pedido / nota atendimento <textarea name="orderSummary" rows="3">${escapeHtml(appointment.orderSummary ?? "")}</textarea></label>
      <label class="span-2">Pendencias <textarea name="pendencySummary" rows="2">${escapeHtml(appointment.pendencySummary ?? appointmentPendencies(appointment).join(", "))}</textarea></label>
      <div class="action-row span-2">
        <button type="submit">Salvar atendimento</button>
        ${frontdeskActions(appointment, true)}
      </div>
    </form>
    ${appointmentTimeline(appointment)}
  `;
}

function emergencyDetailFields(appointment) {
  return `
    <label>Etapa PA ${selectField("emergencyStage", emergencyStageValue(appointment), [
      ["triage_waiting", "Aguardando triagem"],
      ["triage_started", "Em triagem"],
      ["triaged", "Triado"],
      ["in_care", "Em atendimento"],
      ["referred_exam", "Encaminhado para exame"],
      ["completed", "Finalizado"]
    ])}</label>
    <label>Prioridade ${selectField("priority", appointment.priority ?? "routine", [
      ["routine", "Rotina"],
      ["priority", "Prioritario"],
      ["urgent", "Urgente"],
      ["emergency", "Emergencia"]
    ])}</label>
    <label>Risco ${selectField("triageColor", appointment.triageColor ?? "green", [
      ["blue", "Azul"],
      ["green", "Verde"],
      ["yellow", "Amarelo"],
      ["orange", "Laranja"],
      ["red", "Vermelho"]
    ])}</label>
    ${detailInput("Queixa principal", "chiefComplaint", appointment.chiefComplaint)}
    ${detailInput("Pressao arterial", "bloodPressure", appointment.bloodPressure)}
    ${detailInput("Freq. cardiaca", "heartRate", appointment.heartRate)}
    ${detailInput("Saturacao", "oxygenSaturation", appointment.oxygenSaturation)}
    ${detailInput("Temperatura", "temperature", appointment.temperature)}
  `;
}

function appointmentPatientTab(appointment, patient) {
  return `
    <div class="split">
      <div class="panel">
        <div class="panel-heading"><h2>Paciente</h2><span class="badge">${escapeHtml(patient?.documentNumber ?? "sem CPF")}</span></div>
        <div class="detail-kv">
          ${kv("Nome", patient?.fullName)}
          ${kv("Nome social", patient?.socialName)}
          ${kv("Nascimento", patient?.birthDate)}
          ${kv("Sexo", patient?.sex)}
          ${kv("Telefone", patient?.phone)}
          ${kv("Email", patient?.email)}
          ${kv("Responsavel", patient?.guardianName)}
          ${kv("Endereco", patient?.address)}
          ${kv("LGPD", patient?.lgpdConsentStatus)}
          ${kv("Pat ID", appointment.patientId)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><h2>Documentos do paciente</h2></div>
        <div class="empty-state">Documentos pessoais, consentimentos e anexos do paciente serao exibidos aqui.</div>
      </div>
    </div>
  `;
}

function appointmentFinanceTab(appointment) {
  const invoices = state.invoices.filter((item) => item.patientId === appointment.patientId || item.appointmentId === appointment.id);
  const entries = state.finance.filter((item) => item.patientId === appointment.patientId || item.appointmentId === appointment.id);
  return `
    <form class="panel form-grid detail-form" data-appointment-edit="${escapeHtml(appointment.id)}">
      <div class="panel-heading"><h2>Financeiro</h2><span class="badge">${escapeHtml(appointment.paymentCode ?? "sem codigo")}</span></div>
      ${detailInput("Valor procedimento", "procedureAmount", appointment.procedureAmount)}
      ${detailInput("Valor material", "materialAmount", appointment.materialAmount)}
      ${detailInput("Codigo pagamento", "paymentCode", appointment.paymentCode)}
      ${detailInput("Status fiscal", "fiscalStatus", appointment.fiscalStatus)}
      <button type="submit">Salvar financeiro</button>
    </form>
    <div class="split">
      <div class="panel"><div class="panel-heading"><h2>Faturas</h2></div>${simpleRows(invoices, (item) => `${currency.format(Number(item.totalAmountCents ?? 0) / 100)} - ${item.status ?? "aberta"}`)}</div>
      <div class="panel"><div class="panel-heading"><h2>Movimentos</h2></div>${simpleRows(entries, (item) => `${item.description ?? "Movimento"} - ${currency.format(Number(item.amountCents ?? 0) / 100)}`)}</div>
    </div>
  `;
}

function appointmentTissTab(appointment) {
  return detailGenericForm(appointment, "TISS", [
    ["Data faturamento", "tissBillingDate"],
    ["Hora faturamento", "tissBillingTime"],
    ["Codigo operadora", "operatorCode"],
    ["Nome contratado", "contractorName"],
    ["CBO solicitante", "requesterCbo"],
    ["Carater atendimento", "attendanceCharacter"],
    ["Tipo atendimento", "tissAttendanceType"],
    ["Tipo saida", "tissExitType"],
    ["Regime atendimento", "tissRegime"]
  ]);
}

function appointmentMaterialTab(appointment) {
  return detailGenericForm(appointment, "Material", [
    ["Resumo material", "materialSummary"],
    ["Estoque", "stockName"],
    ["Kit", "materialKit"],
    ["Lote material", "materialBatch"],
    ["Quantidade utilizada", "materialQuantity"],
    ["Quantidade faturada", "materialBilledQuantity"]
  ]);
}

function appointmentDocumentsTab(appointment) {
  return `
    ${detailGenericForm(appointment, "Documento", [["Tipo documento", "documentType"], ["Descricao", "documentDescription"], ["Envio externo", "externalDocumentStatus"]])}
    <div class="panel"><div class="panel-heading"><h2>Anexos</h2></div><div class="empty-state">Upload/scan local e envio externo entram nesta area na proxima etapa.</div></div>
  `;
}

function appointmentReportTab(appointment) {
  return detailGenericForm(appointment, "Laudo", [
    ["Prioridade", "reportPriority"],
    ["Situacao", "reportStatus"],
    ["Forma entrega", "reportDeliveryMethod"],
    ["Protocolo", "reportProtocol"],
    ["Grupo laudo", "reportGroup"],
    ["Medico responsavel", "reportDoctor"]
  ]);
}

function appointmentNotesTab(appointment) {
  const notes = state.appointmentNotes.filter((note) => note.appointmentId === appointment.id);
  return `
    <form class="panel form-grid" data-appointment-note="${escapeHtml(appointment.id)}">
      <div class="panel-heading"><h2>Nova observacao</h2></div>
      <label class="span-2">Observacao <textarea name="text" rows="3" required></textarea></label>
      <button type="submit">Salvar observacao</button>
    </form>
    <div class="panel"><div class="panel-heading"><h2>Observacoes</h2><span class="badge">${notes.length}</span></div>${simpleRows(notes, (note) => `${note.text} - ${note.author ?? "Sistema"} - ${formatDate(note.createdAt)}`)}</div>
  `;
}

function appointmentHonoraryTab(appointment) {
  return detailGenericForm(appointment, "Honorario medico", [
    ["Grupo honorario", "medicalHonoraryGroup"],
    ["Tipo honorario", "medicalHonoraryType"],
    ["Previsao pagamento", "medicalHonoraryDueDate"],
    ["Codigo pagamento", "paymentCode"]
  ]);
}

function appointmentAssociatedTab(appointment) {
  return detailGenericForm(appointment, "Associar procedimento", [
    ["Procedimentos associados", "associatedProcedureSummary"],
    ["Valor procedimento", "associatedProcedureAmount"],
    ["Valor material", "associatedMaterialAmount"],
    ["Valor total", "associatedTotalAmount"],
    ["Data ultima menstruacao", "lastMenstruationDate"],
    ["Remedio", "medicine"]
  ]);
}


function renderTotem() {
  renderSelect(els.totemQueueSelect, state.totemQueues, "Selecione a fila", (queue) => queue.id, (queue) => `${queue.prefix} - ${queue.name}`);
  renderSelect(els.totemCallQueueSelect, state.totemQueues, "Todas as filas", (queue) => queue.id, (queue) => `${queue.prefix} - ${queue.name}`, false);
  renderSelect(els.totemCounterSelect, state.totemCounters, "Selecione o guiche", (counter) => counter.id, (counter) => counter.name);

  const waiting = state.totemTickets.filter((ticket) => ticket.status === "waiting");
  const called = state.totemTickets.filter((ticket) => ticket.status === "called");
  const priorityWaiting = waiting.filter((ticket) => Number(ticket.priorityWeight ?? 0) > 1);
  els.totemWaitingCount.textContent = `${waiting.length} aguardando`;
  els.totemSummary.innerHTML = [
    summaryCard("Aguardando", waiting.length),
    summaryCard("Prioritarios", priorityWaiting.length),
    summaryCard("Chamadas recentes", state.totemCalls.length),
    summaryCard("Guiches ativos", state.totemCounters.length)
  ].join("");

  const currentCall = state.totemDisplay?.currentCall;
  const displayConfig = state.totemDisplayConfig ?? {};
  els.totemDisplayTitleInput.value = displayConfig.contentTitle ?? "";
  els.totemDisplayUrlInput.value = displayConfig.contentUrl ?? "";
  els.totemDisplayTypeSelect.value = displayConfig.contentType ?? "online";
  els.totemDisplayLayoutSelect.value = displayConfig.layout ?? "media_left";
  els.totemDisplayPanel.innerHTML = `
    <div class="public-display ${displayConfig.layout === "media_right" ? "media-right" : ""}">
      <div class="display-media">
        ${renderTotemDisplayMedia(displayConfig)}
      </div>
      <div class="display-calls">
        ${currentCall ? `
          <article class="display-call">
            <span>Senha chamada</span>
            <strong>${escapeHtml(currentCall.ticketNumber)}</strong>
            <div>${escapeHtml(currentCall.counterName)} · ${escapeHtml(currentCall.queueName)}</div>
          </article>
          <div class="recent-calls">
            ${(state.totemDisplay?.recentCalls ?? []).slice(1, 6).map((call) => `<span>${escapeHtml(call.ticketNumber)} · ${escapeHtml(call.counterName)}</span>`).join("")}
          </div>
        ` : `<div class="empty-state">Nenhuma senha chamada ainda.</div>`}
      </div>
    </div>
  `;

  renderList(els.totemTicketsList, [...waiting, ...called].sort(sortTotemTicketsClient), (ticket) => `
    <article class="list-item">
      <strong>${escapeHtml(ticket.ticketNumber)} · ${escapeHtml(ticket.patientName)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(ticket.queueName)}</span>
        <span>${escapeHtml(totemPriorityLabel(ticket.priority))}</span>
        <span>${escapeHtml(totemStatusLabel(ticket.status))}</span>
        <span>${formatDate(ticket.issuedAt)}</span>
        ${ticket.counterName ? `<span>${escapeHtml(ticket.counterName)}</span>` : ""}
      </div>
      <div class="action-row">
        <button type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-totem-status="completed" ${ticket.status !== "called" ? "disabled" : ""}>Finalizar</button>
        <button class="secondary" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-totem-status="no_show" ${ticket.status !== "called" ? "disabled" : ""}>Ausente</button>
        <button class="danger" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-totem-status="cancelled">Cancelar</button>
      </div>
    </article>
  `);

  renderList(els.totemAuditList, state.totemAudit.slice(0, 10), (event) => `
    <article class="list-item">
      <strong>${escapeHtml(event.ticketNumber)} · ${escapeHtml(totemAuditLabel(event.action))}</strong>
      <div class="meta-row">
        <span>${escapeHtml(event.userName)}</span>
        <span>${escapeHtml(event.queueName)}</span>
        <span>${formatDate(event.createdAt)}</span>
      </div>
    </article>
  `);
}

function renderImaging() {
  els.imagingSummary.innerHTML = [
    summaryCard("Worklist", state.worklist.length),
    summaryCard("Estudos PACS", state.pacsStudies.length),
    summaryCard("Publicados", state.worklist.filter((order) => order.mwlStatus === "published").length)
  ].join("");
  renderList(els.worklistList, state.worklist, (order) => `
    <article class="list-item">
      <strong>${escapeHtml(order.patientName ?? order.patientId)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(order.modality ?? "MWL")}</span>
        <span>${escapeHtml(order.procedureName ?? "Procedimento")}</span>
        <span>${escapeHtml(order.accessionNumber ?? "Sem accession")}</span>
        <span>${escapeHtml(order.mwlStatus ?? "pendente")}</span>
      </div>
      <div class="action-row">
        <button type="button" data-publish-worklist="${escapeHtml(order.appointmentId)}" data-permission="restricted_hours_schedule">Publicar worklist</button>
      </div>
    </article>
  `);
  renderList(els.pacsStudiesList, state.pacsStudies, (study) => `
    <article class="list-item">
      <strong>${escapeHtml(study.patientName ?? study.patientId ?? "Paciente")}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(study.modality ?? "DICOM")}</span>
        <span>${escapeHtml(study.studyDescription ?? "Estudo")}</span>
        <span>${escapeHtml(study.accessionNumber ?? "sem accession")}</span>
        <span>${escapeHtml(study.matchStatus ?? "sem status")}</span>
      </div>
    </article>
  `);
}

function renderLaboratory() {
  renderList(els.laboratoryOrdersList, state.laboratoryOrders, (order) => {
    const sample = state.laboratorySamples.find((item) => item.orderId === order.id);
    return `
      <article class="list-item">
        <strong>${escapeHtml(order.patientName ?? order.patientId)} - ${escapeHtml(order.examName ?? "Exame laboratorial")}</strong>
        <div class="meta-row">
          <span class="badge">${escapeHtml(laboratoryStatusLabel(order.status))}</span>
          <span>${escapeHtml(order.material ?? "Material nao informado")}</span>
          <span>${escapeHtml(sample?.barcode ?? "sem etiqueta")}</span>
          <span>${escapeHtml(sample?.tube ?? "tubo a definir")}</span>
          <span>${formatDate(order.requestedAt ?? order.createdAt)}</span>
        </div>
        <div class="action-row">
          ${laboratoryStatusActions(order).map((action) => `<button class="secondary" type="button" data-lab-order-id="${escapeHtml(order.id)}" data-lab-status="${escapeHtml(action.status)}">${escapeHtml(action.label)}</button>`).join("")}
        </div>
      </article>
    `;
  });
  renderList(els.lisInterfacesList, state.laboratoryInterfaces, (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.equipmentName)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(item.status ?? "testing")}</span>
        <span>${escapeHtml(item.protocol ?? "ASTM")}</span>
        <span>${escapeHtml(item.connection ?? "sem conexao")}</span>
      </div>
    </article>
  `);
  renderList(els.supportLabList, state.supportLabExams, (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.examName)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(item.status ?? "received")}</span>
        <span>${escapeHtml(item.supportLabName)}</span>
        <span>${escapeHtml(item.patientName)}</span>
      </div>
    </article>
  `);
}

function renderBilling() {
  const subview = routeMap[state.activeRoute]?.subview;
  const allRows = {
    invoices: state.invoices.map((invoice) => ({ kind: "Fatura", title: currency.format(Number(invoice.totalAmountCents ?? 0) / 100), meta: [invoice.status, invoice.payerType, patientName(invoice.patientId)] })),
    batches: state.billingBatches.map((batch) => ({ kind: "Lote", title: batch.title, meta: [batch.status, currency.format(Number(batch.totalAmountCents ?? 0) / 100), `${batch.invoiceCount ?? 0} fatura(s)`] })),
    denials: state.billingDenials.map((denial) => ({ kind: "Glosa", title: denial.reason, meta: [denial.status, currency.format(Number(denial.deniedAmountCents ?? 0) / 100)] })),
    payouts: state.doctorPayouts.map((payout) => ({ kind: "Repasse", title: payout.doctorName, meta: [payout.period, currency.format(Number(payout.payoutAmountCents ?? 0) / 100)] }))
  };
  const rows = subview && allRows[subview]
    ? allRows[subview]
    : Object.values(allRows).flat();
  els.billingListTitle.textContent = subview ? billingSubviewTitle(subview) : "Faturamento";
  renderList(els.billingList, rows, (row) => `
    <article class="list-item">
      <strong>${escapeHtml(row.kind)} · ${escapeHtml(row.title)}</strong>
      <div class="meta-row">${row.meta.map((item) => `<span>${escapeHtml(item ?? "")}</span>`).join("")}</div>
    </article>
  `);
}

function renderFinance() {
  renderFinanceOptions();
  const receivables = state.finance.filter((entry) => entry.direction === "receivable");
  const payables = state.finance.filter((entry) => entry.direction === "payable");
  const openReceivables = receivables.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + Number(entry.amountCents ?? 0), 0);
  const openPayables = payables.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + Number(entry.amountCents ?? 0), 0);
  const reconciled = state.finance.filter((entry) => entry.reconciliationStatus === "reconciled").length;
  const pendingReconciliation = state.finance.filter((entry) => (entry.reconciliationStatus ?? "pending") !== "reconciled").length;

  els.financeSummary.innerHTML = [
    summaryCard("A receber aberto", currency.format(openReceivables / 100)),
    summaryCard("A pagar aberto", currency.format(openPayables / 100)),
    summaryCard("Saldo previsto", currency.format((openReceivables - openPayables) / 100)),
    summaryCard("Conciliados", reconciled),
    summaryCard("Pendentes conciliação", pendingReconciliation)
  ].join("");

  const filtered = filteredFinanceEntries();
  const filteredReceivables = filtered.filter((entry) => entry.direction === "receivable");
  const filteredPayables = filtered.filter((entry) => entry.direction === "payable");
  const filteredReconciliation = filtered.filter((entry) => (entry.reconciliationStatus ?? "pending") !== "reconciled");

  els.financeCount.textContent = `${filtered.length} movimento(s)`;
  els.financeReceivablesCount.textContent = String(filteredReceivables.length);
  els.financePayablesCount.textContent = String(filteredPayables.length);
  els.financeReconciliationCount.textContent = String(filteredReconciliation.length);

  renderList(els.financeReceivablesList, filteredReceivables, financeEntryItem);
  renderList(els.financePayablesList, filteredPayables, financeEntryItem);
  renderList(els.financeReconciliationList, filteredReconciliation, financeEntryItem);
}

function renderRelationship() {
  renderSelect(els.relationshipDtmfSelect, state.relationshipQueues, "Selecione a opcao", (queue) => queue.dtmf, (queue) => `${queue.dtmf} - ${queue.name}`);
  els.relationshipQueuesCount.textContent = `${state.relationshipQueues.length} fila(s)`;
  els.relationshipCallsCount.textContent = `${state.relationshipCalls.length} chamada(s)`;
  renderUraTechnical();
  renderWhatsapp();

  renderList(els.relationshipQueuesList, state.relationshipQueues, (queue) => `
    <article class="list-item">
      <strong>${escapeHtml(queue.dtmf)} · ${escapeHtml(queue.name)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(queue.id)}</span>
        <span>${escapeHtml(queue.transferTarget)}</span>
      </div>
    </article>
  `);

  renderList(els.relationshipCallsList, state.relationshipCalls, (call) => `
    <article class="list-item">
      <strong>${escapeHtml(call.patientName)} &middot; ${escapeHtml(call.originPhone)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(call.queueName)}</span>
        <span>${escapeHtml(relationshipStatusLabel(call.status))}</span>
        <span>${escapeHtml(call.intent)}</span>
        <span>${formatDate(call.startedAt)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(call.agentSummary)}</span>
      </div>
      <div class="meta-row">
        <span class="badge ${call.requiresHumanReview ? "danger" : ""}">${call.requiresHumanReview ? "Revisao humana" : "Agente sugeriu"}</span>
        <span>${escapeHtml(call.agentSuggestion)}</span>
      </div>
    </article>
  `);
}

function renderWhatsapp() {
  if (!els.whatsappConfigForm) return;
  const config = state.whatsappConfig ?? {};
  setFormValues(els.whatsappConfigForm, config);
  if (els.whatsappConfigForm.elements.cloudAccessToken) els.whatsappConfigForm.elements.cloudAccessToken.value = "";
  if (els.whatsappConfigForm.elements.evolutionApiKey) els.whatsappConfigForm.elements.evolutionApiKey.value = "";
  if (els.whatsappStatus) els.whatsappStatus.textContent = uraStatusLabel(config.status ?? "homologation");

  renderWhatsappReadiness();
  renderWhatsappSafetyDashboard();
  renderWhatsappEvolution();
  renderWhatsappInbox();
  renderWhatsappSupervision();
  renderWhatsappExceptions();
  renderWhatsappAutonomyReviews();
  renderWhatsappProfileUpdates();
  renderWhatsappConsents();
  renderWhatsappFlows();
  renderWhatsappTemplates();
  renderWhatsappAutonomyRules();
  renderWhatsappAutonomyProfiles();
  renderWhatsappJourneys();
  renderWhatsappAvailability();
  renderWhatsappInsuranceValidation();
  renderWhatsappPrepRules();
  els.whatsappConversationsCount.textContent = `${state.whatsappConversations.length} conversa(s)`;
  els.whatsappTasksCount.textContent = `${state.whatsappTasks.length} tarefa(s)`;
  els.whatsappOcrCount.textContent = `${state.whatsappOcr.length} OCR`;
  els.whatsappMessagesCount.textContent = `${state.whatsappMessages.length} mensagem(ns)`;
  els.whatsappOutboxCount.textContent = `${state.whatsappOutbox.length} saida(s)`;
  els.whatsappAuditCount.textContent = `${state.whatsappAudit.length} evento(s)`;

  renderList(els.whatsappConversationsList, state.whatsappConversations, (conversation) => `
    <article class="list-item">
      <strong>${escapeHtml(conversation.contactName)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(conversation.status)}</span>
        <span>${escapeHtml(conversation.phone)}</span>
        ${conversation.patientId ? `<span>${escapeHtml(patientMatchLabel(conversation.patientMatchedBy))}: ${escapeHtml(conversation.patientName ?? conversation.contactName)}</span>` : ""}
        ${conversation.whatsappConsentStatus ? `<span>${escapeHtml(whatsappConsentStatusLabel(conversation.whatsappConsentStatus))}</span>` : ""}
        <span>${escapeHtml(conversation.lastIntent ?? "sem intencao")}</span>
        ${conversation.journeyName ? `<span>${escapeHtml(conversation.journeyName)} / ${escapeHtml(conversation.journeyStepTitle ?? "")}</span>` : ""}
        <span>${formatDate(conversation.lastMessageAt)}</span>
      </div>
    </article>
  `);

  renderList(els.whatsappTasksList, state.whatsappTasks, (task) => `
    <article class="list-item">
      <strong>${escapeHtml(whatsappIntentLabel(task.intent))} - ${escapeHtml(whatsappActionLabel(task.action))}</strong>
      <div class="meta-row">
        <span class="badge ${task.status === "needs_review" ? "danger" : ""}">${escapeHtml(task.status)}</span>
        <span>${escapeHtml(task.contactName)}</span>
        <span>Conf. ${Math.round(Number(task.confidence ?? 0) * 100)}%</span>
        ${task.orderData?.procedureName ? `<span>${escapeHtml(task.orderData.procedureName)}</span>` : ""}
        ${task.orderData?.insuranceName ? `<span>${escapeHtml(task.orderData.insuranceName)}</span>` : ""}
        ${task.appointmentId ? `<span>Agenda ${escapeHtml(task.appointmentId)}</span>` : ""}
      </div>
      <div class="meta-row"><span>${escapeHtml(task.reply)}</span></div>
    </article>
  `);

  renderList(els.whatsappOcrList, state.whatsappOcr, (ocr) => `
    <article class="list-item">
      <strong>${escapeHtml(ocr.contactName ?? ocr.fromPhone)}</strong>
      <div class="meta-row">
        <span class="badge ${ocr.status === "failed" || ocr.status === "pending_media" ? "danger" : ""}">${escapeHtml(whatsappOcrStatusLabel(ocr.status))}</span>
        <span>${escapeHtml(ocr.source)}</span>
        <span>Conf. ${Math.round(Number(ocr.confidence ?? 0) * 100)}%</span>
        <span>${formatDate(ocr.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(ocr.text || ocr.error || "sem texto extraido")}</span></div>
    </article>
  `);

  renderList(els.whatsappMessagesList, state.whatsappMessages, (message) => `
    <article class="list-item">
      <strong>${escapeHtml(message.direction === "outbound" ? "Agente" : message.contactName ?? message.fromPhone)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(message.messageType)}</span>
        <span>${escapeHtml(message.provider)}</span>
        ${message.status ? `<span>${escapeHtml(whatsappOutboundStatusLabel(message.status))}</span>` : ""}
        <span>${formatDate(message.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(message.text || message.caption || message.extractedText || "sem texto")}</span></div>
    </article>
  `);

  renderList(els.whatsappOutboxList, state.whatsappOutbox, (message) => `
    <article class="list-item">
      <strong>${escapeHtml(message.toPhone ?? "Destino nao informado")}</strong>
      <div class="meta-row">
        <span class="badge ${["failed", "blocked_profile", "blocked_review"].includes(message.status) ? "danger" : ""}">${escapeHtml(whatsappOutboundStatusLabel(message.status))}</span>
        <span>${escapeHtml(message.provider ?? "sem provedor")}</span>
        <span>${Number(message.attempts ?? 0)}/${Number(message.maxAttempts ?? 3)} tentativa(s)</span>
        <span>${formatDate(message.updatedAt ?? message.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(message.text || "sem texto")}</span></div>
      ${message.reviewedAt ? `<div class="meta-row"><span>Revisado por ${escapeHtml(message.reviewedByName ?? "equipe")} em ${formatDate(message.reviewedAt)}</span></div>` : ""}
      ${message.error ? `<div class="meta-row"><span>${escapeHtml(message.error)}</span></div>` : ""}
      ${["blocked_review", "pending_approval", "draft"].includes(message.status) ? whatsappPendingReviewForm(message) : ""}
      <div class="action-row">
        <button type="button" data-whatsapp-send-id="${escapeHtml(message.id)}" ${["sent", "sending", "blocked_profile", "blocked_review"].includes(message.status) ? "disabled" : ""}>Enviar</button>
        <button class="secondary" type="button" data-whatsapp-retry-id="${escapeHtml(message.id)}" ${message.status !== "failed" ? "disabled" : ""}>Tentar novamente</button>
        <button class="secondary" type="button" data-whatsapp-resolve-failure-id="${escapeHtml(message.id)}" ${message.status !== "failed" ? "disabled" : ""}>Marcar revisada</button>
      </div>
    </article>
  `);

  renderList(els.whatsappAuditList, state.whatsappAudit, (event) => `
    <article class="list-item">
      <strong>${escapeHtml(event.action)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(event.userName)}</span>
        <span>${escapeHtml(event.resourceId)}</span>
        <span>${formatDate(event.createdAt)}</span>
      </div>
    </article>
  `);
}

function renderWhatsappReadiness() {
  const readiness = state.whatsappReadiness;
  if (!els.whatsappReadinessSummary || !readiness) return;
  els.whatsappReadinessSummary.innerHTML = [
    summaryCard("Status", uraReadinessLabel(readiness.status)),
    summaryCard("Checks", `${readiness.okCount ?? 0}/${readiness.totalChecks ?? 0}`),
    summaryCard("Conversas", readiness.conversations ?? 0),
    summaryCard("Mensagens", readiness.messages ?? 0),
    ...(readiness.checks ?? []).map((check) => summaryCard(check.label, check.ok ? "OK" : check.detail))
  ].join("");
}

function renderWhatsappSafetyDashboard() {
  if (!els.whatsappSafetySummary || !els.whatsappSafetyReasonsList || !els.whatsappSafetyDeliveryList || !els.whatsappSafetyRecentList) return;
  const dashboard = state.whatsappSafetyDashboard ?? { summary: {}, executive: {}, reasons: [], deliveryRisks: [], recentEvents: [] };
  const summary = dashboard.summary ?? {};
  els.whatsappSafetySummary.innerHTML = [
    summaryCard("Resumo", whatsappExecutiveStatusLabel(dashboard.executive?.status)),
    summaryCard("Automacao", `${summary.automationRate ?? 0}%`),
    summaryCard("Acoes automaticas", summary.automatedActions ?? 0),
    summaryCard("Intervencoes", summary.humanInterventions ?? 0),
    summaryCard("Pendentes", summary.pendingApprovals ?? 0),
    summaryCard("Falhas envio", summary.failedDeliveries ?? 0),
    summaryCard("Corrigir cadastro", summary.correctionIssues ?? 0),
    summaryCard("Envio OK", `${summary.sendSuccessRate ?? 100}%`),
    summaryCard("Tempo aprov.", `${summary.averageApprovalMinutes ?? 0} min`)
  ].join("");

  if (els.whatsappSafetyExecutive) {
    renderList(els.whatsappSafetyExecutive, dashboard.executive ? [dashboard.executive] : [], (executive) => `
      <article class="list-item">
        <strong>${escapeHtml(executive.label ?? whatsappExecutiveStatusLabel(executive.status))}</strong>
        <div class="meta-row">
          <span class="badge ${["blocked", "attention"].includes(executive.status) ? "danger" : ""}">${escapeHtml(whatsappExecutiveStatusLabel(executive.status))}</span>
          <span>${escapeHtml(executive.recommendation ?? "")}</span>
        </div>
        ${(executive.blockers ?? []).map((item) => `<div class="meta-row"><span>${escapeHtml(item)}</span></div>`).join("")}
      </article>
    `);
  }

  renderList(els.whatsappSafetyReasonsList, dashboard.reasons ?? [], (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.reason ?? "Intervencao humana")}</strong>
      <div class="meta-row">
        <span class="badge">${Number(item.count ?? 0)} ocorrencia(s)</span>
        <span>${escapeHtml(whatsappActionLabel(item.action))}</span>
        <span>${formatDate(item.latestAt)}</span>
      </div>
    </article>
  `);

  renderList(els.whatsappSafetyDeliveryList, dashboard.deliveryRisks ?? [], (message) => `
    <article class="list-item">
      <strong>${escapeHtml(message.toPhone ?? "Destino nao informado")}</strong>
      <div class="meta-row">
        <span class="badge danger">${escapeHtml(whatsappOutboundStatusLabel(message.status))}</span>
        <span>${escapeHtml(message.deliveryDiagnosis?.label ?? whatsappFailureCategoryLabel(message.failureCategory))}</span>
        <span>${escapeHtml(message.provider ?? "sem provedor")}</span>
        <span>${Number(message.attempts ?? 0)}/${Number(message.maxAttempts ?? 3)} tentativa(s)</span>
        <span>${formatDate(message.updatedAt ?? message.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(message.error ?? "Falha de envio sem detalhe.")}</span></div>
      <div class="meta-row"><span>${escapeHtml(message.deliveryDiagnosis?.hint ?? message.failureHint ?? "Revisar antes de reenviar.")}</span></div>
      ${message.correctionIssue ? `<div class="meta-row"><span class="badge danger">Pendencia cadastral</span><span>${escapeHtml(profileUpdateStatusLabel(message.correctionIssue.status))}</span></div>` : ""}
      <div class="action-row">
        <button class="secondary" type="button" data-whatsapp-retry-id="${escapeHtml(message.id)}" ${["invalid_phone", "missing_country_code", "provider_bad_request"].includes(message.deliveryDiagnosis?.category ?? message.failureCategory) ? "disabled" : ""}>Tentar novamente</button>
        <button class="secondary" type="button" data-whatsapp-resolve-failure-id="${escapeHtml(message.id)}">Marcar revisada</button>
      </div>
    </article>
  `);

  renderList(els.whatsappSafetyRecentList, dashboard.recentEvents ?? [], (event) => `
    <article class="list-item">
      <strong>${escapeHtml(whatsappSafetyEventLabel(event.action))}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(event.userName ?? "sistema")}</span>
        <span>${escapeHtml(event.details?.ruleName ?? event.details?.profileScope ?? event.resourceId ?? "")}</span>
        <span>${formatDate(event.createdAt)}</span>
      </div>
    </article>
  `);
}

function renderWhatsappEvolution() {
  if (!els.whatsappEvolutionSummary) return;
  const status = state.whatsappEvolution ?? {};
  const connection = status.connection?.instance ?? status.connection?.payload?.instance ?? status.connection?.instance ?? {};
  const latestConnect = state.whatsappEvolutionConnect;
  if (els.whatsappEvolutionStatus) {
    els.whatsappEvolutionStatus.textContent = status.ok ? "Online" : "Offline";
    els.whatsappEvolutionStatus.classList.toggle("danger", !status.ok);
  }
  els.whatsappEvolutionSummary.innerHTML = [
    summaryCard("API", status.ok ? "Online" : "Offline"),
    summaryCard("URL", status.baseUrl ?? "sem URL"),
    summaryCard("Instancia", status.instance ?? "sem instancia"),
    summaryCard("Conexao", connection.state ?? connection.status ?? status.status ?? "sem estado")
  ].join("");
  if (!els.whatsappEvolutionQr) return;
  const payload = latestConnect?.payload ?? latestConnect ?? {};
  const base64 = payload.base64 ?? payload.qrcode?.base64 ?? payload.qrCode?.base64;
  const pairingCode = payload.pairingCode ?? payload.code;
  const error = latestConnect?.error;
  els.whatsappEvolutionQr.innerHTML = `
    ${base64 ? `<img class="qr-preview" src="${escapeHtml(base64)}" alt="QR Code WhatsApp" />` : ""}
    ${pairingCode ? `<div class="meta-row"><span class="badge">Codigo</span><span>${escapeHtml(pairingCode)}</span></div>` : ""}
    ${error ? `<div class="meta-row"><span class="badge danger">Falha</span><span>${escapeHtml(error)}</span></div>` : ""}
    ${!base64 && !pairingCode && !error ? `<div class="empty-state">Crie ou conecte a instancia para exibir QR Code ou codigo de pareamento.</div>` : ""}
  `;
}

function renderWhatsappInbox() {
  if (!els.whatsappInboxConversations || !els.whatsappInboxMessages || !els.whatsappInboxContext) return;
  const conversations = [...state.whatsappConversations].sort((a, b) => new Date(b.lastMessageAt ?? b.updatedAt ?? 0).getTime() - new Date(a.lastMessageAt ?? a.updatedAt ?? 0).getTime());
  if (!conversations.some((conversation) => conversation.id === state.selectedWhatsappConversationId)) {
    state.selectedWhatsappConversationId = conversations[0]?.id ?? "";
  }
  const selected = conversations.find((conversation) => conversation.id === state.selectedWhatsappConversationId);
  if (els.whatsappInboxStatus) els.whatsappInboxStatus.textContent = selected ? whatsappConversationStatusLabel(selected) : "Sem conversa";
  if (els.whatsappInboxTitle) els.whatsappInboxTitle.textContent = selected ? `${selected.contactName ?? selected.phone}` : "Historico";
  if (els.whatsappInboxConversationInput) els.whatsappInboxConversationInput.value = selected?.id ?? "";

  renderList(els.whatsappInboxConversations, conversations, (conversation) => {
    const latest = latestWhatsappMessage(conversation.id);
    const unreadLike = conversation.status !== "resolved" && latest?.direction === "inbound";
    return `
      <button class="inbox-thread ${conversation.id === state.selectedWhatsappConversationId ? "active" : ""}" type="button" data-inbox-conversation-id="${escapeHtml(conversation.id)}">
        <strong>${escapeHtml(conversation.contactName ?? conversation.phone)}</strong>
        <span>${escapeHtml(latest?.text || latest?.caption || latest?.extractedText || conversation.lastAction || "sem mensagem")}</span>
        <span class="meta-row">
          <span class="badge ${conversation.automationPaused || conversation.status?.includes("review") ? "danger" : ""}">${escapeHtml(whatsappConversationStatusLabel(conversation))}</span>
          ${conversation.whatsappConsentStatus ? `<span>${escapeHtml(whatsappConsentStatusLabel(conversation.whatsappConsentStatus))}</span>` : ""}
          ${unreadLike ? `<span>nova entrada</span>` : ""}
          <span>${formatDate(conversation.lastMessageAt ?? conversation.updatedAt)}</span>
        </span>
      </button>
    `;
  });

  if (!selected) {
    els.whatsappInboxMessages.innerHTML = `<div class="empty-state">Nenhuma conversa WhatsApp encontrada.</div>`;
    els.whatsappInboxContext.innerHTML = `<div class="empty-state">Selecione uma conversa para ver o contexto.</div>`;
    if (els.whatsappInboxReplyText) els.whatsappInboxReplyText.disabled = true;
    return;
  }
  if (els.whatsappInboxReplyText) els.whatsappInboxReplyText.disabled = false;
  renderWhatsappInboxMessages(selected);
  renderWhatsappInboxContext(selected);
}

function renderWhatsappInboxMessages(conversation) {
  const rows = state.whatsappMessages
    .filter((message) => message.conversationId === conversation.id)
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  els.whatsappInboxMessages.innerHTML = rows.length ? rows.map((message) => {
    const outbound = message.direction === "outbound";
    return `
      <article class="message-bubble ${outbound ? "outbound" : "inbound"}">
        <div class="message-author">${escapeHtml(outbound ? "Agente/equipe" : message.contactName ?? conversation.contactName ?? message.fromPhone)}</div>
        <div>${escapeHtml(message.text || message.caption || message.extractedText || "sem texto")}</div>
        <div class="message-meta">
          <span>${formatDate(message.createdAt)}</span>
          <span>${escapeHtml(message.messageType ?? "texto")}</span>
          ${message.status ? `<span>${escapeHtml(whatsappOutboundStatusLabel(message.status))}</span>` : ""}
          ${message.ocrStatus ? `<span>OCR ${escapeHtml(whatsappOcrStatusLabel(message.ocrStatus))}</span>` : ""}
        </div>
      </article>
    `;
  }).join("") : `<div class="empty-state">Ainda nao ha mensagens registradas nesta conversa.</div>`;
}

function renderWhatsappInboxContext(conversation) {
  const latestTask = latestWhatsappTask(conversation.id);
  const pendingOutbound = state.whatsappOutbox.find((message) => message.conversationId === conversation.id && ["blocked_profile", "blocked_review", "pending_approval", "draft", "failed", "queued"].includes(message.status));
  const patient = state.patients.find((item) => item.id === conversation.patientId);
  const consent = latestWhatsappConsentForConversation(conversation);
  const profileUpdates = state.whatsappProfileUpdates.filter((item) => item.conversationId === conversation.id && item.status === "pending");
  const appointments = state.appointments
    .filter((item) => item.patientId && item.patientId === conversation.patientId)
    .sort((a, b) => new Date(b.startsAt ?? b.createdAt ?? 0).getTime() - new Date(a.startsAt ?? a.createdAt ?? 0).getTime())
    .slice(0, 3);

  els.whatsappInboxContext.innerHTML = `
    <article class="list-item">
      <strong>${escapeHtml(conversation.patientName ?? conversation.contactName ?? "Paciente")}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(whatsappConversationStatusLabel(conversation))}</span>
        <span>${escapeHtml(maskProfileValue("phone", conversation.phone))}</span>
      </div>
      <div class="meta-row">
        ${conversation.patientMatchedBy ? `<span>${escapeHtml(patientMatchLabel(conversation.patientMatchedBy))}</span>` : ""}
        ${conversation.patientIdentityStatus ? `<span>${escapeHtml(conversation.patientIdentityStatus)}</span>` : ""}
      </div>
    </article>
    <article class="list-item">
      <strong>Cadastro</strong>
      <div class="meta-row"><span>${escapeHtml(patient?.documentNumber ? maskProfileValue("documentNumber", patient.documentNumber) : "CPF nao informado")}</span></div>
      <div class="meta-row"><span>${escapeHtml(patient?.birthDate ?? "Nascimento nao informado")}</span></div>
      <div class="meta-row"><span>${escapeHtml(patient?.email ?? "Email nao informado")}</span></div>
    </article>
    <article class="list-item">
      <strong>LGPD</strong>
      <div class="meta-row">
        <span class="badge ${consent?.status === "rejected" ? "danger" : ""}">${escapeHtml(whatsappConsentStatusLabel(consent?.status ?? conversation.whatsappConsentStatus ?? "nao_solicitado"))}</span>
        <span>${formatDate(consent?.acceptedAt ?? consent?.rejectedAt ?? consent?.requestedAt ?? conversation.whatsappConsentAt)}</span>
      </div>
    </article>
    <article class="list-item">
      <strong>Agente</strong>
      <div class="meta-row"><span>${escapeHtml(latestTask ? `${whatsappIntentLabel(latestTask.intent)} - ${whatsappActionLabel(latestTask.action)}` : "Sem tarefa recente")}</span></div>
      ${latestTask?.reply ? `<div class="meta-row"><span>${escapeHtml(latestTask.reply)}</span></div>` : ""}
    </article>
    ${pendingOutbound ? `
      <article class="list-item">
        <strong>Saida pendente</strong>
        <div class="meta-row"><span class="badge ${["failed", "blocked_profile"].includes(pendingOutbound.status) ? "danger" : ""}">${escapeHtml(whatsappOutboundStatusLabel(pendingOutbound.status))}</span></div>
        ${["blocked_review", "pending_approval", "draft"].includes(pendingOutbound.status) ? whatsappPendingReviewForm(pendingOutbound) : `<div class="meta-row"><span>${escapeHtml(pendingOutbound.error ?? pendingOutbound.text ?? "Aguardando acao operacional.")}</span></div>`}
      </article>
    ` : ""}
    ${profileUpdates.length ? `
      <article class="list-item">
        <strong>Pendencias cadastrais</strong>
        ${profileUpdates.map((item) => `<div class="meta-row"><span>${escapeHtml(profileUpdateFieldLabel(item.field))}</span><span>${escapeHtml(item.reason ?? "")}</span></div>`).join("")}
      </article>
    ` : ""}
    <article class="list-item">
      <strong>Atendimentos recentes</strong>
      ${appointments.length ? appointments.map((appointment) => `
        <div class="meta-row">
          <span>${escapeHtml(statusLabel(appointment.status))}</span>
          <span>${escapeHtml(appointment.procedureName ?? "Atendimento")}</span>
          <span>${formatDate(appointment.startsAt ?? appointment.createdAt)}</span>
        </div>
      `).join("") : `<div class="meta-row"><span>Nenhum atendimento vinculado.</span></div>`}
    </article>
    <div class="action-row">
      <button type="button" data-whatsapp-assume-id="${escapeHtml(conversation.id)}" ${conversation.automationPaused ? "disabled" : ""}>Assumir</button>
      <button class="secondary" type="button" data-whatsapp-release-id="${escapeHtml(conversation.id)}" ${!conversation.automationPaused ? "disabled" : ""}>Liberar agente</button>
      <button class="secondary" type="button" data-whatsapp-resolve-id="${escapeHtml(conversation.id)}">Resolver</button>
    </div>
  `;
}

function renderWhatsappSupervision() {
  if (!els.whatsappSupervisionSummary || !els.whatsappSupervisionList) return;
  const supervision = state.whatsappSupervision ?? { rows: [], summary: {} };
  const summary = supervision.summary ?? {};
  els.whatsappSupervisionSummary.innerHTML = [
    summaryCard("Conversas", summary.total ?? 0),
    summaryCard("Revisao", summary.review ?? 0),
    summaryCard("Assumidas", summary.manual ?? 0),
    summaryCard("Aprovar", summary.pendingApproval ?? 0),
    summaryCard("Falhas", summary.failed ?? 0)
  ].join("");

  renderSelect(els.whatsappManualConversationSelect, supervision.rows ?? [], "Selecione a conversa", (row) => row.id, (row) => `${row.contactName} - ${row.phone}`, false);

  renderList(els.whatsappSupervisionList, supervision.rows ?? [], (row) => `
    <article class="list-item">
      <strong>${escapeHtml(row.contactName ?? row.phone)}</strong>
      <div class="meta-row">
        <span class="badge ${row.risk === "review" || row.risk === "delivery" ? "danger" : ""}">${escapeHtml(whatsappRiskLabel(row.risk))}</span>
        <span>${escapeHtml(row.phone)}</span>
        <span>${escapeHtml(row.assignedToName ?? "agente")}</span>
        <span>${formatDate(row.lastMessageAt ?? row.updatedAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(row.latestMessage?.text || row.latestMessage?.caption || row.latestMessage?.extractedText || "sem mensagem recente")}</span></div>
      ${row.latestTask ? `<div class="meta-row"><span>${escapeHtml(whatsappActionLabel(row.latestTask.action))}</span><span>Conf. ${Math.round(Number(row.latestTask.confidence ?? 0) * 100)}%</span></div>` : ""}
      ${row.pendingOutbound ? `
        <div class="meta-row"><span class="badge ${["failed", "blocked_profile"].includes(row.pendingOutbound.status) ? "danger" : ""}">${escapeHtml(whatsappOutboundStatusLabel(row.pendingOutbound.status))}</span><span>${escapeHtml(row.pendingOutbound.text ?? "")}</span></div>
        ${["blocked_review", "pending_approval", "draft"].includes(row.pendingOutbound.status) ? whatsappPendingReviewForm(row.pendingOutbound) : ""}
      ` : ""}
      <div class="action-row">
        <button type="button" data-whatsapp-assume-id="${escapeHtml(row.id)}" ${row.automationPaused ? "disabled" : ""}>Assumir</button>
        <button class="secondary" type="button" data-whatsapp-release-id="${escapeHtml(row.id)}" ${!row.automationPaused ? "disabled" : ""}>Liberar agente</button>
        <button class="secondary" type="button" data-whatsapp-resolve-id="${escapeHtml(row.id)}">Resolver</button>
      </div>
    </article>
  `);
}

function renderWhatsappExceptions() {
  if (!els.whatsappExceptionsSummary || !els.whatsappExceptionsList) return;
  const queue = state.whatsappExceptions ?? { summary: {}, items: [] };
  const summary = queue.summary ?? {};
  els.whatsappExceptionsSummary.innerHTML = [
    summaryCard("Excecoes", summary.total ?? 0),
    summaryCard("Urgentes", summary.high ?? 0),
    summaryCard("LGPD", summary.lgpd ?? 0),
    summaryCard("Envio", summary.delivery ?? 0),
    summaryCard("Convenio", summary.insurance ?? 0)
  ].join("");

  renderList(els.whatsappExceptionsList, queue.items ?? [], (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.title ?? "Excecao")}</strong>
      <div class="meta-row">
        <span class="badge ${item.severity === "high" ? "danger" : ""}">${escapeHtml(whatsappExceptionSeverityLabel(item.severity))}</span>
        <span>${escapeHtml(whatsappExceptionTypeLabel(item.type))}</span>
        <span>${escapeHtml(item.patientName ?? item.contactName ?? "Paciente")}</span>
        <span>${escapeHtml(maskProfileValue("phone", item.phone))}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(item.reason ?? "")}</span></div>
      <div class="meta-row"><span>${escapeHtml(item.actionHint ?? "")}</span></div>
      ${item.latestMessage ? `<div class="meta-row"><span>${escapeHtml(item.latestMessage.text || item.latestMessage.caption || item.latestMessage.extractedText || "sem mensagem recente")}</span></div>` : ""}
      <div class="action-row">
        <button type="button" data-whatsapp-assume-id="${escapeHtml(item.conversationId ?? "")}" ${!item.conversationId ? "disabled" : ""}>Assumir</button>
        <button class="secondary" type="button" data-whatsapp-release-id="${escapeHtml(item.conversationId ?? "")}" ${!item.conversationId ? "disabled" : ""}>Liberar agente</button>
        <button class="secondary" type="button" data-whatsapp-resolve-id="${escapeHtml(item.conversationId ?? "")}" ${!item.conversationId ? "disabled" : ""}>Resolver</button>
      </div>
    </article>
  `);
}

function renderWhatsappAutonomyReviews() {
  if (!els.whatsappAutonomyReviewsSummary || !els.whatsappAutonomyReviewsList) return;
  const reviews = state.whatsappAutonomyReviews ?? { summary: {}, rows: [] };
  const summary = reviews.summary ?? {};
  els.whatsappAutonomyReviewsSummary.innerHTML = [
    summaryCard("Pendentes", summary.pending ?? 0),
    summaryCard("Urgentes", summary.high ?? 0),
    summaryCard("Aprovadas", summary.approved ?? 0),
    summaryCard("Mantidas humano", summary.rejected ?? 0)
  ].join("");

  renderList(els.whatsappAutonomyReviewsList, reviews.rows ?? [], (row) => `
    <article class="list-item">
      <strong>${escapeHtml(row.ruleName ?? "Regra de autonomia")}</strong>
      <div class="meta-row">
        <span class="badge ${row.status === "needs_review" ? "danger" : ""}">${escapeHtml(whatsappAutonomyReviewStatusLabel(row.status))}</span>
        <span>${escapeHtml(whatsappAutonomyConditionLabel(row.ruleCondition))}</span>
        <span>${escapeHtml(whatsappAutonomyRequestedActionLabel(row.requestedAction))}</span>
        <span>${escapeHtml(row.contactName ?? row.conversation?.contactName ?? row.phone ?? "")}</span>
        <span>${formatDate(row.createdAt)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(row.latestMessage?.text || row.latestMessage?.caption || row.latestMessage?.extractedText || "sem mensagem recente")}</span></div>
      <div class="meta-row"><span>${escapeHtml(row.reply ?? "Aguardando decisao operacional.")}</span></div>
      ${row.pendingOutbound ? `<div class="meta-row"><span class="badge">${escapeHtml(whatsappOutboundStatusLabel(row.pendingOutbound.status))}</span><span>${escapeHtml(row.pendingOutbound.text ?? "")}</span></div>` : ""}
      <div class="action-row">
        <button type="button" data-whatsapp-autonomy-approve-id="${escapeHtml(row.id)}" ${row.status !== "needs_review" ? "disabled" : ""}>Aprovar e continuar</button>
        <button class="secondary" type="button" data-whatsapp-autonomy-reject-id="${escapeHtml(row.id)}" ${row.status !== "needs_review" ? "disabled" : ""}>Manter humano</button>
        <button class="secondary" type="button" data-whatsapp-assume-id="${escapeHtml(row.conversationId ?? "")}" ${!row.conversationId ? "disabled" : ""}>Assumir</button>
      </div>
    </article>
  `);
}

function renderWhatsappProfileUpdates() {
  if (!els.whatsappProfileUpdatesList) return;
  const pending = state.whatsappProfileUpdates.filter((item) => item.status === "pending");
  if (els.whatsappProfileUpdatesCount) els.whatsappProfileUpdatesCount.textContent = `${pending.length} pendente(s)`;
  renderList(els.whatsappProfileUpdatesList, state.whatsappProfileUpdates, (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.patientName ?? "Paciente")}</strong>
      <div class="meta-row">
        <span class="badge ${item.status === "pending" ? "danger" : ""}">${escapeHtml(profileUpdateStatusLabel(item.status))}</span>
        <span>${escapeHtml(profileUpdateFieldLabel(item.field))}</span>
        <span>${escapeHtml(item.source ?? "")}</span>
        <span>${formatDate(item.updatedAt ?? item.createdAt)}</span>
      </div>
      <div class="meta-row">
        <span>Atual: ${escapeHtml(maskProfileValue(item.field, item.currentValue))}</span>
        <span>Informado: ${escapeHtml(item.proposedValue ? maskProfileValue(item.field, item.proposedValue) : "corrigir no cadastro")}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(item.reason ?? "")}</span></div>
      ${item.messageId ? `<div class="meta-row"><span>Mensagem ${escapeHtml(item.messageId)}</span></div>` : ""}
      ${profilePhoneCorrectionForm(item)}
      <div class="action-row">
        <button type="button" data-profile-update-id="${escapeHtml(item.id)}" data-profile-update-status="reviewed" ${item.status !== "pending" ? "disabled" : ""}>Marcar revisado</button>
        <button class="secondary" type="button" data-profile-update-id="${escapeHtml(item.id)}" data-profile-update-status="rejected" ${item.status !== "pending" ? "disabled" : ""}>Rejeitar</button>
      </div>
    </article>
  `);
}

function profilePhoneCorrectionForm(item) {
  if (item.status !== "pending" || item.field !== "phone") return "";
  const placeholder = item.source === "whatsapp_delivery_failure" ? "5562999999999" : "Telefone com DDI e DDD";
  return `
    <form class="pending-review-form" data-profile-phone-form data-profile-update-id="${escapeHtml(item.id)}">
      <label>Telefone correto
        <input name="correctedValue" inputmode="tel" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(item.proposedValue ?? "")}" />
      </label>
      <label class="inline-check">
        <input name="reprocess" type="checkbox" value="true" ${item.source === "whatsapp_delivery_failure" ? "checked" : ""} />
        Reprocessar mensagens bloqueadas/falhas para este telefone
      </label>
      <div class="action-row">
        <button type="submit">Corrigir cadastro</button>
      </div>
    </form>
  `;
}

function renderWhatsappConsents() {
  if (!els.whatsappConsentsList) return;
  const accepted = state.whatsappConsents.filter((item) => item.status === "accepted").length;
  if (els.whatsappConsentsCount) els.whatsappConsentsCount.textContent = `${accepted}/${state.whatsappConsents.length}`;
  renderList(els.whatsappConsentsList, state.whatsappConsents, (item) => `
    <article class="list-item">
      <strong>${escapeHtml(item.patientName ?? item.contactName ?? "Paciente")}</strong>
      <div class="meta-row">
        <span class="badge ${item.status === "rejected" ? "danger" : ""}">${escapeHtml(whatsappConsentStatusLabel(item.status))}</span>
        <span>${escapeHtml(maskProfileValue("phone", item.phone))}</span>
        <span>${escapeHtml(item.policyVersion ?? "lgpd-whatsapp")}</span>
        <span>${formatDate(item.acceptedAt ?? item.rejectedAt ?? item.requestedAt ?? item.createdAt)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(item.source ?? "agent")}</span>
        ${item.evidenceText ? `<span>${escapeHtml(item.evidenceText)}</span>` : ""}
      </div>
    </article>
  `);
}

function whatsappPendingReviewForm(message) {
  const disabled = ["sent", "sending"].includes(message.status) ? "disabled" : "";
  return `
    <form class="pending-review-form" data-whatsapp-review-form data-message-id="${escapeHtml(message.id)}">
      <label>Editar antes de aprovar
        <textarea name="text" rows="4" ${disabled}>${escapeHtml(message.text ?? "")}</textarea>
      </label>
      <div class="action-row">
        <button type="submit" ${disabled}>Salvar, aprovar e enviar</button>
      </div>
    </form>
  `;
}

function renderWhatsappFlows() {
  if (!els.whatsappFlowsList) return;
  if (els.whatsappFlowsCount) els.whatsappFlowsCount.textContent = `${state.whatsappFlows.length} fluxo(s)`;
  renderList(els.whatsappFlowsList, state.whatsappFlows, (flow) => `
    <article class="list-item">
      <strong>${escapeHtml(flow.name)}</strong>
      <div class="meta-row">
        <span class="badge ${flow.status !== "active" ? "danger" : ""}">${escapeHtml(flow.status ?? "active")}</span>
        <span>${escapeHtml(whatsappIntentLabel(flow.intent))}</span>
        <span>${escapeHtml(whatsappFlowActionLabel(flow.action))}</span>
        <span>Prioridade ${Number(flow.priority ?? 0)}</span>
        ${flow.requiresApproval ? `<span>Exige aprovacao</span>` : ""}
      </div>
      <div class="meta-row"><span>${escapeHtml(flow.keywords ?? "")}</span></div>
      <div class="meta-row"><span>${escapeHtml(flow.responseTemplate ?? "")}</span></div>
    </article>
  `);
}

function renderWhatsappTemplates() {
  if (!els.whatsappTemplatesList) return;
  if (els.whatsappTemplatesCount) els.whatsappTemplatesCount.textContent = `${state.whatsappTemplates.length} template(s)`;
  renderList(els.whatsappTemplatesList, state.whatsappTemplates, (template) => `
    <article class="list-item">
      <strong>${escapeHtml(template.name)}</strong>
      <div class="meta-row">
        <span class="badge ${template.status !== "active" ? "danger" : ""}">${escapeHtml(template.status ?? "active")}</span>
        <span>${escapeHtml(whatsappTemplateCategoryLabel(template.category))}</span>
        <span>${escapeHtml(template.trigger ?? "manual")}</span>
        <span>Prioridade ${Number(template.priority ?? 0)}</span>
        ${template.requiresApproval ? `<span>Exige aprovacao</span>` : ""}
      </div>
      <div class="meta-row"><span>${escapeHtml(template.variables ?? "")}</span></div>
      <div class="meta-row"><span>${escapeHtml(template.body ?? "")}</span></div>
    </article>
  `);
}

function renderWhatsappAutonomyRules() {
  if (!els.whatsappAutonomyRulesList) return;
  if (els.whatsappAutonomyRulesCount) els.whatsappAutonomyRulesCount.textContent = `${state.whatsappAutonomyRules.length} regra(s)`;
  renderList(els.whatsappAutonomyRulesList, state.whatsappAutonomyRules, (rule) => `
    <article class="list-item">
      <strong>${escapeHtml(rule.name)}</strong>
      <div class="meta-row">
        <span class="badge ${rule.status !== "active" ? "danger" : ""}">${escapeHtml(rule.status ?? "active")}</span>
        <span>${escapeHtml(whatsappAutonomyConditionLabel(rule.condition))}</span>
        <span>${escapeHtml(whatsappAutonomyActionLabel(rule.action))}</span>
        <span>${escapeHtml(rule.severity ?? "medium")}</span>
        <span>Prioridade ${Number(rule.priority ?? 0)}</span>
      </div>
      <div class="meta-row">
        <span>Aplica em: ${escapeHtml(rule.appliesTo ?? "todos")}</span>
        ${rule.threshold ? `<span>Limite ${escapeHtml(rule.threshold)}</span>` : ""}
      </div>
      ${rule.keywords ? `<div class="meta-row"><span>${escapeHtml(rule.keywords)}</span></div>` : ""}
    </article>
  `);
}

function renderWhatsappAutonomyProfiles() {
  if (!els.whatsappAutonomyProfilesList) return;
  if (els.whatsappAutonomyProfilesCount) els.whatsappAutonomyProfilesCount.textContent = `${state.whatsappAutonomyProfiles.length} perfil(is)`;
  renderList(els.whatsappAutonomyProfilesList, state.whatsappAutonomyProfiles, (profile) => `
    <article class="list-item">
      <strong>${escapeHtml(profile.name)}</strong>
      <div class="meta-row">
        <span class="badge ${profile.status !== "active" ? "danger" : ""}">${escapeHtml(profile.status ?? "active")}</span>
        <span>${escapeHtml(whatsappAutonomyModeLabel(profile.mode))}</span>
        <span>${escapeHtml(whatsappAutonomyActionLabel(profile.action))}</span>
        <span>${escapeHtml(whatsappAutonomyInsuranceTypeLabel(profile.insuranceType))}</span>
        <span>Prioridade ${Number(profile.priority ?? 0)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(profile.scope ?? "geral")}</span>
        <span>Aplica em: ${escapeHtml(profile.appliesTo ?? "todos")}</span>
      </div>
      ${profile.keywords ? `<div class="meta-row"><span>${escapeHtml(profile.keywords)}</span></div>` : ""}
      ${profile.description ? `<div class="meta-row"><span>${escapeHtml(profile.description)}</span></div>` : ""}
    </article>
  `);
}

function renderWhatsappJourneys() {
  if (!els.whatsappJourneysList) return;
  if (els.whatsappJourneysCount) els.whatsappJourneysCount.textContent = `${state.whatsappJourneys.length} cascata(s)`;
  renderList(els.whatsappJourneysList, state.whatsappJourneys, (journey) => `
    <article class="list-item">
      <strong>${escapeHtml(journey.name)}</strong>
      <div class="meta-row">
        <span class="badge ${journey.status !== "active" ? "danger" : ""}">${escapeHtml(journey.status ?? "active")}</span>
        <span>${escapeHtml(whatsappIntentLabel(journey.intent))}</span>
        <span>${Number(journey.steps?.length ?? 0)} etapa(s)</span>
        <span>Prioridade ${Number(journey.priority ?? 0)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(journey.description ?? "")}</span></div>
      <div class="list compact-list">
        ${(journey.steps ?? []).map((step, index) => `
          <div class="list-item">
            <strong>${index + 1}. ${escapeHtml(step.title)}</strong>
            <div class="meta-row">
              <span>${escapeHtml(whatsappJourneyActionLabel(step.action))}</span>
              ${step.requiresApproval ? `<span class="badge danger">Revisao humana</span>` : ""}
            </div>
            <div class="meta-row"><span>${escapeHtml(step.prompt ?? "")}</span></div>
          </div>
        `).join("")}
      </div>
    </article>
  `);
}

function renderWhatsappAvailability() {
  if (!els.whatsappAvailabilityList) return;
  const availability = state.whatsappAvailability;
  if (!availability) {
    els.whatsappAvailabilityList.innerHTML = `<div class="empty-state">Consulte um procedimento para ver horarios livres por sala.</div>`;
    return;
  }
  const slots = availability.slots ?? [];
  els.whatsappAvailabilityList.innerHTML = `
    <article class="list-item">
      <strong>${escapeHtml(availability.procedure?.name ?? "Procedimento")}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(availability.procedure?.modality ?? "OT")}</span>
        <span>${slots.length} horario(s) livre(s)</span>
        <span>${(availability.rooms ?? []).length} sala(s)</span>
      </div>
    </article>
    ${slots.length ? slots.map((slot) => `
      <article class="list-item">
        <strong>${escapeHtml(formatDate(slot.startsAt))}</strong>
        <div class="meta-row">
          <span>${escapeHtml(slot.roomName)}</span>
          <span>${escapeHtml(slot.unitName ?? slot.branchName ?? "")}</span>
          <span>${Number(slot.durationMinutes ?? 0)} min</span>
        </div>
      </article>
    `).join("") : `<div class="empty-state">Nenhum horario livre encontrado no periodo.</div>`}
  `;
}

function renderWhatsappInsuranceValidation() {
  if (!els.whatsappInsuranceValidationResult) return;
  const validation = state.whatsappInsuranceValidation;
  if (!validation) {
    els.whatsappInsuranceValidationResult.innerHTML = `<div class="empty-state">Valide um convenio para ver exigencia de guia e autorizacao.</div>`;
    return;
  }
  els.whatsappInsuranceValidationResult.innerHTML = `
    <article class="list-item">
      <strong>${escapeHtml(validation.normalizedData?.insuranceName ?? "Convenio")}</strong>
      <div class="meta-row">
        <span class="badge ${validation.ok ? "" : "danger"}">${validation.ok ? "Validado" : "Pendente"}</span>
        <span>${validation.requiresAuthorization ? "Exige autorizacao" : "Sem autorizacao"}</span>
        <span>${escapeHtml(validation.status ?? "")}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(validation.message ?? "")}</span></div>
      ${validation.normalizedData?.guideNumber ? `<div class="meta-row"><span>Guia ${escapeHtml(validation.normalizedData.guideNumber)}</span></div>` : ""}
    </article>
  `;
}

function renderWhatsappPrepRules() {
  if (!els.whatsappPrepRulesList) return;
  if (els.whatsappPrepRulesCount) els.whatsappPrepRulesCount.textContent = `${state.whatsappPrepRules.length} preparo(s)`;
  renderList(els.whatsappPrepRulesList, state.whatsappPrepRules, (rule) => `
    <article class="list-item">
      <strong>${escapeHtml(rule.name)}</strong>
      <div class="meta-row">
        <span class="badge ${rule.status !== "active" ? "danger" : ""}">${escapeHtml(rule.status ?? "active")}</span>
        <span>${escapeHtml(rule.modality ?? "OT")}</span>
        <span>${Number(rule.arrivalMinutes ?? 20)} min antes</span>
        ${rule.requiresCompanion ? `<span>Acompanhante</span>` : ""}
      </div>
      <div class="meta-row"><span>${escapeHtml(rule.procedureKeywords ?? "")}</span></div>
      <div class="meta-row"><span>${escapeHtml(rule.instructions ?? "")}</span></div>
      <div class="meta-row"><span>${escapeHtml(rule.documents ?? "")}</span></div>
    </article>
  `);
}

function renderUraTechnical() {
  if (!els.uraConfigForm) return;
  renderSelect(els.uraFallbackQueueSelect, state.relationshipQueues, "Selecione a fila", (queue) => queue.id, (queue) => `${queue.dtmf} - ${queue.name}`, false);
  renderSelect(els.uraFlowQueueSelect, state.relationshipQueues, "Fila destino", (queue) => queue.id, (queue) => `${queue.dtmf} - ${queue.name}`, false);
  renderSelect(els.uraLiveDtmfSelect, state.relationshipQueues, "Selecione a opcao", (queue) => queue.dtmf, (queue) => `${queue.dtmf} - ${queue.name}`);
  renderSelect(els.uraProviderEventDtmfSelect, state.relationshipQueues, "Opcional", (queue) => queue.dtmf, (queue) => `${queue.dtmf} - ${queue.name}`, false);
  renderSelect(els.uraCommandQueueSelect, state.relationshipQueues, "Fila destino", (queue) => queue.id, (queue) => `${queue.dtmf} - ${queue.name}`, false);
  renderSelect(els.uraCommandLiveCallSelect, state.uraLiveCalls, "Selecione a chamada", (call) => call.id, (call) => `${call.patientName} - ${call.channelId}`, false);

  const config = state.uraConfig ?? {};
  setFormValues(els.uraConfigForm, config);
  if (els.uraConfigStatus) {
    els.uraConfigStatus.textContent = uraStatusLabel(config.status ?? "homologation");
  }
  if (els.uraConfigForm.elements.ariPassword) {
    els.uraConfigForm.elements.ariPassword.value = "";
  }

  els.uraFlowsCount.textContent = `${state.uraFlows.length} fluxo(s)`;
  els.uraLiveCallsCount.textContent = `${state.uraLiveCalls.length} chamada(s)`;
  els.uraEventsCount.textContent = `${state.uraEvents.length} evento(s)`;
  els.uraCommandsCount.textContent = `${state.uraCommands.length} comando(s)`;
  els.uraAuditCount.textContent = `${state.uraAudit.length} evento(s)`;
  renderUraReadiness();
  renderUraConnector();

  renderList(els.uraFlowsList, state.uraFlows, (flow) => `
    <article class="list-item">
      <strong>${escapeHtml(flow.name)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(uraStatusLabel(flow.status ?? "active"))}</span>
        <span>${escapeHtml(flow.options?.length ?? 0)} opcao(oes)</span>
        <span>Timeout ${escapeHtml(flow.timeoutSeconds ?? 8)}s</span>
        <span>Tentativas ${escapeHtml(flow.maxRetries ?? 2)}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(flow.greetingText)}</span></div>
      <div class="meta-row">
        ${(flow.options ?? []).map((option) => `<span>${escapeHtml(option.dtmf)} - ${escapeHtml(option.label)} (${escapeHtml(option.transferTarget)})</span>`).join("")}
      </div>
    </article>
  `);

  renderList(els.uraLiveCallsList, state.uraLiveCalls, (call) => `
    <article class="list-item">
      <strong>${escapeHtml(call.patientName)} · ${escapeHtml(call.originPhone)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(uraLiveStatusLabel(call.status))}</span>
        <span>${escapeHtml(call.provider)}</span>
        <span>${escapeHtml(call.channelId)}</span>
        <span>${formatDate(call.lastEventAt)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(call.queueName)}</span>
        <span>${escapeHtml(call.transferTarget)}</span>
        <span>${escapeHtml(call.agentSuggestion)}</span>
      </div>
    </article>
  `);

  renderList(els.uraEventsList, state.uraEvents, (event) => `
    <article class="list-item">
      <strong>${escapeHtml(uraProviderEventLabel(event.eventType))}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(event.provider)}</span>
        <span>${escapeHtml(event.channelId)}</span>
        ${event.dtmf ? `<span>DTMF ${escapeHtml(event.dtmf)}</span>` : ""}
        <span>${formatDate(event.receivedAt)}</span>
      </div>
    </article>
  `);

  renderList(els.uraCommandsList, state.uraCommands, (command) => `
    <article class="list-item">
      <strong>${escapeHtml(uraCommandActionLabel(command.action))}</strong>
      <div class="meta-row">
        <span class="badge ${command.status === "failed" ? "danger" : ""}">${escapeHtml(uraCommandStatusLabel(command.status))}</span>
        <span>${escapeHtml(command.channelId)}</span>
        ${command.queueName ? `<span>${escapeHtml(command.queueName)}</span>` : ""}
        ${command.transferTarget ? `<span>${escapeHtml(command.transferTarget)}</span>` : ""}
        <span>${formatDate(command.createdAt)}</span>
      </div>
      ${command.error ? `<div class="meta-row"><span>${escapeHtml(command.error)}</span></div>` : ""}
    </article>
  `);

  renderList(els.uraAuditList, state.uraAudit, (event) => `
    <article class="list-item">
      <strong>${escapeHtml(event.action)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(event.userName)}</span>
        <span>${escapeHtml(event.resourceId)}</span>
        <span>${formatDate(event.createdAt)}</span>
      </div>
    </article>
  `);
}

function renderUraReadiness() {
  const readiness = state.uraReadiness;
  if (!els.uraReadinessSummary || !readiness) return;
  const checksOk = `${readiness.okCount ?? 0}/${readiness.totalChecks ?? 0}`;
  els.uraReadinessSummary.innerHTML = [
    summaryCard("Status", uraReadinessLabel(readiness.status)),
    summaryCard("Checks", checksOk),
    summaryCard("Fluxos ativos", readiness.activeFlows ?? 0),
    summaryCard("Chamadas 24h", readiness.recentLiveCalls ?? 0),
    ...(readiness.checks ?? []).map((check) => summaryCard(check.label, check.ok ? "OK" : check.detail))
  ].join("");
}

function renderUraConnector() {
  const connector = state.uraConnector ?? state.uraReadiness?.connector;
  if (!connector || !els.uraConnectorStatus) return;
  els.uraConnectorStatus.textContent = uraConnectorStatusLabel(connector.status);
  renderList(els.uraConnectorDetails, [
    ["Webhook", connector.webhookUrl],
    ["WebSocket", connector.url ?? "nao conectado"],
    ["Ultimo evento", connector.lastEventAt ? formatDate(connector.lastEventAt) : "sem evento"],
    ["Conectado em", connector.connectedAt ? formatDate(connector.connectedAt) : "nao conectado"],
    ["Erro", connector.lastError ?? "sem erro"]
  ], ([label, value]) => `
    <article class="list-item">
      <strong>${escapeHtml(label)}</strong>
      <div class="meta-row"><span>${escapeHtml(value)}</span></div>
    </article>
  `);
}

function renderFinanceOptions() {
  renderSelect(els.financeCategorySelect, registryRows("financial-categories"), "Categoria", (row) => row.name, (row) => `${row.name}${row.direction && row.direction !== "both" ? ` - ${financeDirectionLabel(row.direction)}` : ""}`, false);
  renderSelect(els.financeCostCenterSelect, registryRows("cost-centers"), "Centro de custo", (row) => row.name, (row) => row.name, false);
  renderSelect(els.financeAccountSelect, registryRows("accounts"), "Conta/caixa", (row) => row.name, (row) => `${row.name}${row.bank ? ` - ${row.bank}` : ""}`, false);
  renderSelect(els.financePaymentMethodSelect, registryRows("payment-methods"), "Forma de pagamento", (row) => row.name, (row) => row.name, false);
}

function filteredFinanceEntries() {
  const search = normalize(els.financeSearch.value);
  const direction = els.financeDirectionFilter.value;
  const status = els.financeStatusFilter.value;
  const reconciliation = els.financeReconciliationFilter.value;

  return state.finance.filter((entry) => {
    const haystack = normalize(`${entry.description} ${entry.category} ${entry.costCenter} ${entry.cashAccount} ${entry.paymentMethod} ${entry.source}`);
    return (!search || haystack.includes(search))
      && (!direction || entry.direction === direction)
      && (!status || entry.status === status)
      && (!reconciliation || (entry.reconciliationStatus ?? "pending") === reconciliation);
  });
}

function financeEntryItem(entry) {
  const isPaid = entry.status === "paid";
  const isReconciled = entry.reconciliationStatus === "reconciled";
  return `
    <article class="list-item">
      <strong>${escapeHtml(entry.description)}</strong>
      <div class="meta-row">
        <span class="badge">${financeDirectionLabel(entry.direction)}</span>
        <span>${currency.format(Number(entry.amountCents ?? 0) / 100)}</span>
        <span>${escapeHtml(financeStatusLabel(entry.status ?? "open"))}</span>
        <span>${escapeHtml(reconciliationLabel(entry.reconciliationStatus ?? "pending"))}</span>
        ${entry.dueDate ? `<span>Venc. ${escapeHtml(entry.dueDate)}</span>` : ""}
        ${entry.category ? `<span>${escapeHtml(entry.category)}</span>` : ""}
        ${entry.costCenter ? `<span>${escapeHtml(entry.costCenter)}</span>` : ""}
        ${entry.cashAccount ? `<span>${escapeHtml(entry.cashAccount)}</span>` : ""}
        ${entry.paymentMethod ? `<span>${escapeHtml(entry.paymentMethod)}</span>` : ""}
      </div>
      <div class="action-row">
        <button type="button" data-finance-status="${escapeHtml(entry.id)}" data-status="paid" ${isPaid ? "disabled" : ""}>Baixar</button>
        <button type="button" data-finance-reconcile="${escapeHtml(entry.id)}" data-permission="financial_reconciliation" ${isReconciled ? "disabled" : ""}>Conciliar</button>
      </div>
    </article>
  `;
}

function renderSecurity() {
  renderUserOptions();
  renderSecurityRisks();
  renderSystemState();
  renderSecurityPermissions();
  els.usersCount.textContent = `${state.users.length} usuario(s)`;
  renderList(els.usersList, state.users, (user) => `
    <article class="list-item">
      <strong>${escapeHtml(user.name)}</strong>
      <div class="meta-row">
        <span class="badge ${user.status === "inactive" ? "danger" : ""}">${escapeHtml(user.status === "inactive" ? "Inativo" : "Ativo")}</span>
        <span class="badge">${escapeHtml(roleLabel(user.role))}</span>
        <span>${escapeHtml(user.email)}</span>
        <span>${escapeHtml(user.userGroup ?? "Sem grupo")}</span>
        ${user.professionalName ? `<span>${escapeHtml(user.professionalName)}</span>` : ""}
      </div>
      <div class="meta-row">
        ${(user.permissions ?? []).slice(0, 8).map((permission) => `<span class="badge">${escapeHtml(permissionLabel(permission))}</span>`).join("") || "<span>Sem permissoes adicionais</span>"}
      </div>
      <form class="form-grid inline-form user-edit-form" data-user-edit-form data-user-id="${escapeHtml(user.id)}">
        <label>Nome <input name="name" value="${escapeHtml(user.name)}" required /></label>
        <label>E-mail <input name="email" type="email" value="${escapeHtml(user.email)}" required /></label>
        <label>Perfil
          <select name="role">${userRoleOptions(user.role)}</select>
        </label>
        <label>Status
          <select name="status">
            <option value="active" ${user.status !== "inactive" ? "selected" : ""}>Ativo</option>
            <option value="inactive" ${user.status === "inactive" ? "selected" : ""}>Inativo</option>
          </select>
        </label>
        <label>Grupo <input name="userGroup" value="${escapeHtml(user.userGroup ?? "")}" /></label>
        <label>Modulos <input name="modules" value="${escapeHtml((user.modules ?? []).join(","))}" /></label>
        <label>Permissoes <input name="permissions" value="${escapeHtml((user.permissions ?? []).join(","))}" /></label>
        <label>Nova senha <input name="password" type="password" minlength="6" placeholder="manter atual" /></label>
        <button type="submit">Salvar usuario</button>
      </form>
      <div class="action-row">
        <button class="secondary" type="button" data-user-status-id="${escapeHtml(user.id)}" data-user-status="${user.status === "inactive" ? "active" : "inactive"}">${user.status === "inactive" ? "Ativar" : "Inativar"}</button>
      </div>
    </article>
  `);
  renderSecurityAudit();
}

function renderSecurityPermissions() {
  if (!els.securityPermissionsList) return;
  const groups = registryRows("user-groups");
  renderList(els.securityPermissionsList, groups, (group) => `
    <article class="list-item">
      <strong>${escapeHtml(group.name)}</strong>
      <div class="meta-row">
        <span class="badge ${group.status !== "active" ? "danger" : ""}">${escapeHtml(group.status ?? "active")}</span>
        <span>${escapeHtml(group.branch ?? "Todas as unidades")}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(group.description ?? "Sem descricao")}</span></div>
      <div class="meta-row">
        <span>Modulos: ${escapeHtml(csv(group.modules).join(", ") || "sem modulos")}</span>
      </div>
      <div class="meta-row">
        ${csv(group.permissions).map((permission) => `<span class="badge">${escapeHtml(permissionLabel(permission))}</span>`).join("") || "<span>Sem permissoes operacionais</span>"}
      </div>
    </article>
  `);
}

function renderSecurityRisks() {
  if (!els.securityRiskSummary) return;
  const denied = state.securityAudit.filter((event) => event.action === "settings.navigation_access_denied").length;
  const admins = state.users.filter((user) => user.role === "admin").length;
  const inactive = state.users.filter((user) => user.status === "inactive").length;
  const criticalPermissions = state.users.reduce((sum, user) => sum + (user.permissions ?? []).filter((permission) => ["edit_privileges", "financial_reconciliation", "billing_batches", "denial_management"].includes(permission)).length, 0);
  els.securityRiskSummary.innerHTML = [
    summaryCard("Administradores", admins),
    summaryCard("Usuarios inativos", inactive),
    summaryCard("Permissoes criticas", criticalPermissions),
    summaryCard("Acessos negados", denied)
  ].join("");
}

function renderSecurityAudit() {
  if (!els.securityAuditList) return;
  const rows = state.securityAudit
    .filter((event) => /^(auth|security|settings\.navigation|lgpd)/.test(event.action))
    .slice(0, 80);
  if (els.securityAuditCount) els.securityAuditCount.textContent = `${rows.length} evento(s)`;
  renderList(els.securityAuditList, rows, (event) => `
    <article class="list-item">
      <strong>${escapeHtml(securityAuditLabel(event.action))}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(event.userName ?? "sistema")}</span>
        <span>${escapeHtml(event.resourceId ?? event.resource ?? "")}</span>
        <span>${formatDate(event.createdAt)}</span>
      </div>
      ${event.details ? `<div class="meta-row"><span>${escapeHtml(auditDetails(event.details))}</span></div>` : ""}
    </article>
  `);
}

function renderSystemState() {
  if (!els.systemStateSummary || !els.systemStateChecks) return;
  const { checks, adminCount, backupCheck, health, apiInfo } = buildSystemStateSnapshot();
  const checksOk = checks.filter((check) => check.ok).length;
  const latestSnapshot = latestSystemStateSnapshot();

  els.systemStateSummary.innerHTML = [
    summaryCard("Checks OK", `${checksOk}/${checks.length}`),
    summaryCard("Banco", health.database ? "Conectado" : "Indefinido"),
    summaryCard("Backup", backupCheck?.status === "ready" ? "Pronto" : "Atencao"),
    summaryCard("Admins", adminCount),
    summaryCard("Versao", apiInfo.version ?? "-")
  ].join("");

  renderList(els.systemStateChecks, checks, (check) => `
    <article class="list-item">
      <strong>${escapeHtml(check.label)}</strong>
      <div class="meta-row">
        <span class="badge ${check.ok ? "" : "danger"}">${check.ok ? "OK" : "Atencao"}</span>
        <span>${escapeHtml(String(check.detail ?? ""))}</span>
      </div>
    </article>
  `);
  renderSystemStateHistory();
  if (els.systemStateLastRun) {
    if (latestSnapshot) {
      const detailChecksOk = Number(latestSnapshot.details?.checksOk ?? 0);
      const detailTotalChecks = Number(latestSnapshot.details?.totalChecks ?? 0);
      const when = latestSnapshot.details?.generatedAt ?? latestSnapshot.createdAt;
      const by = latestSnapshot.userName ?? "sistema";
      els.systemStateLastRun.textContent = `Ultimo diagnostico: ${detailChecksOk}/${detailTotalChecks} em ${formatDate(when)} por ${by}`;
    } else {
      els.systemStateLastRun.textContent = "Sem diagnostico registrado";
    }
  }
}

function latestSystemStateSnapshot() {
  return (state.securityAudit ?? [])
    .filter((event) => event.action === "security.system_state_snapshot")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function renderSystemStateHistory() {
  if (!els.systemStateHistoryList) return;
  const rows = (state.securityAudit ?? [])
    .filter((event) => event.action === "security.system_state_snapshot")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
  renderList(els.systemStateHistoryList, rows, (event) => {
    const ok = Number(event.details?.checksOk ?? 0);
    const total = Number(event.details?.totalChecks ?? 0);
    const generatedAt = event.details?.generatedAt ?? event.createdAt;
    return `
      <article class="list-item">
        <strong>Diagnostico ${ok}/${total}</strong>
        <div class="meta-row">
          <span class="badge">${escapeHtml(event.userName ?? "sistema")}</span>
          <span>${formatDate(generatedAt)}</span>
          <span>${escapeHtml(event.details?.version ?? "-")}</span>
        </div>
      </article>
    `;
  });
}

function toggleSystemStateHistory() {
  if (!els.systemStateHistoryList || !els.systemStateHistoryButton) return;
  const willShow = els.systemStateHistoryList.hidden;
  els.systemStateHistoryList.hidden = !willShow;
  els.systemStateHistoryButton.textContent = willShow
    ? "Ocultar historico de diagnosticos"
    : "Ver historico de diagnosticos";
}

function buildSystemStateSnapshot() {
  const readiness = state.securityReadiness ?? {};
  const deployment = state.securityDeployment ?? {};
  const whatsappReadiness = state.whatsappReadiness ?? {};
  const uraReadiness = state.uraReadiness ?? {};
  const health = state.apiHealth ?? {};
  const apiInfo = state.apiInfo ?? {};
  const users = Array.isArray(state.users) ? state.users : [];
  const backupCheck = Array.isArray(readiness.checks) ? readiness.checks.find((check) => check.id === "backup") : null;
  const databaseCheck = Array.isArray(deployment.checks) ? deployment.checks.find((check) => check.id === "database-path") : null;
  const ocrCheck = Array.isArray(whatsappReadiness.checks) ? whatsappReadiness.checks.find((check) => check.id === "ocr") : null;
  const adminCount = users.filter((user) => user.role === "admin" && user.status !== "inactive").length;
  const checks = [
    { label: "Banco de dados", ok: Boolean(databaseCheck?.status === "ready" || health.database), detail: databaseCheck?.detail ?? health.database ?? "Nao identificado" },
    { label: "Backup local", ok: Boolean(backupCheck?.status === "ready"), detail: backupCheck?.detail ?? "Sem backup recente" },
    { label: "WhatsApp readiness", ok: Boolean(whatsappReadiness.status && whatsappReadiness.status !== "needs_configuration"), detail: whatsappReadiness.status ?? "Nao configurado" },
    { label: "URA readiness", ok: Boolean(uraReadiness.status && uraReadiness.status !== "needs_configuration"), detail: uraReadiness.status ?? "Nao configurado" },
    { label: "OCR", ok: Boolean(ocrCheck?.ok), detail: ocrCheck?.detail ?? "Nao validado" },
    { label: "Usuario admin", ok: adminCount > 0, detail: adminCount > 0 ? `${adminCount} ativo(s)` : "Nenhum admin ativo" },
    { label: "Versao do app", ok: Boolean(apiInfo.version), detail: apiInfo.version ?? "Nao informada" }
  ];
  return { checks, adminCount, backupCheck, health, apiInfo };
}

async function handleSystemStateRun() {
  if (!state.token) return;
  if (els.systemStateRunButton) {
    els.systemStateRunButton.disabled = true;
    els.systemStateRunButton.textContent = "Executando...";
  }
  try {
    await refreshAll();
    const { checks, apiInfo } = buildSystemStateSnapshot();
    const payload = {
      checksOk: checks.filter((check) => check.ok).length,
      totalChecks: checks.length,
      checks: checks.map((check) => ({ label: check.label, ok: check.ok, detail: check.detail })),
      version: apiInfo.version ?? "",
      generatedAt: new Date().toISOString()
    };
    await api("/v1/security/system-state/snapshot", { method: "POST", body: payload });
    if (els.systemStateLastRun) {
      els.systemStateLastRun.textContent = `Ultimo diagnostico registrado em ${formatDate(payload.generatedAt)}`;
    }
  } catch (error) {
    if (els.systemStateLastRun) els.systemStateLastRun.textContent = `Falha no diagnostico: ${error.message}`;
  } finally {
    if (els.systemStateRunButton) {
      els.systemStateRunButton.disabled = false;
      els.systemStateRunButton.textContent = "Executar diagnostico";
    }
  }
}

function renderHumanResources() {
  if (!els.hrTableBody || !els.hrTableMeta) return;
  const employees = (state.registryData?.employees ?? []).filter((row) => row.status !== "inactive");
  const search = normalize(state.hrSearch);
  const usersByEmployee = new Map();
  (state.users ?? [])
    .filter((user) => String(user.professionalType ?? "") === "employee" && user.professionalId)
    .forEach((user) => {
      const key = String(user.professionalId);
      if (!usersByEmployee.has(key)) usersByEmployee.set(key, []);
      usersByEmployee.get(key).push(user);
    });

  const filtered = employees.filter((row) => {
    const haystack = normalize(`${row.name ?? ""} ${row.phone ?? row.telephone ?? ""} ${row.mobile ?? row.cellphone ?? ""} ${row.gender ?? row.sex ?? ""}`);
    if (search && !haystack.includes(search)) return false;
    const linked = usersByEmployee.get(String(row.id ?? "")) ?? [];
    const hasLinked = linked.length > 0;
    const hasActive = linked.some((user) => user.status !== "inactive");
    if (state.hrAccessFilter === "active") return hasActive;
    if (state.hrAccessFilter === "inactive") return hasLinked && !hasActive;
    if (state.hrAccessFilter === "none") return !hasLinked;
    return true;
  });
  const sortMap = {
    id: (row) => String(row.id ?? ""),
    name: (row) => String(row.name ?? ""),
    phone: (row) => String(row.phone ?? row.telephone ?? ""),
    mobile: (row) => String(row.mobile ?? row.cellphone ?? ""),
    sex: (row) => String(row.gender ?? row.sex ?? "")
  };
  const sortValue = sortMap[state.hrSortKey] ?? sortMap.name;
  filtered.sort((a, b) => {
    const va = normalize(sortValue(a));
    const vb = normalize(sortValue(b));
    const result = va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" });
    return state.hrSortDir === "asc" ? result : -result;
  });

  document.querySelectorAll("[data-hr-sort]").forEach((button) => {
    const key = button.dataset.hrSort;
    const label = button.textContent?.replace(/[▲▼]/g, "").trim() ?? "";
    if (key === state.hrSortKey) {
      button.textContent = `${label} ${state.hrSortDir === "asc" ? "▲" : "▼"}`;
    } else {
      button.textContent = label;
    }
  });
  document.querySelectorAll("[data-hr-access-filter]").forEach((button) => {
    const active = button.dataset.hrAccessFilter === state.hrAccessFilter;
    button.classList.toggle("active", active);
  });

  const pageSize = Number(state.hrPageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.hrPage = Math.min(Math.max(1, Number(state.hrPage || 1)), totalPages);
  const start = (state.hrPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  els.hrTableBody.innerHTML = rows.length
    ? rows.map((row, index) => `
      <tr>
        <td>${escapeHtml(String(row.id ?? index + 1))}</td>
        <td>${escapeHtml(row.name ?? "Sem nome")}</td>
        <td>${escapeHtml(row.phone ?? row.telephone ?? "")}</td>
        <td>${escapeHtml(row.mobile ?? row.cellphone ?? "")}</td>
        <td>${escapeHtml(row.gender ?? row.sex ?? "")}</td>
        <td>
          <div class="table-actions">
            <button class="secondary icon-button" type="button" data-hr-edit-id="${escapeHtml(String(row.id ?? ""))}">Editar</button>
            <button class="secondary icon-button" type="button" data-hr-access-id="${escapeHtml(String(row.id ?? ""))}">Acesso</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">Nenhum colaborador encontrado.</div></td></tr>`;
  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + rows.length, filtered.length);
  els.hrTableMeta.textContent = `${filtered.length} registro(s) · ${from}-${to}`;
  if (els.hrPageSize) els.hrPageSize.value = String(pageSize);
  if (els.hrPageInfo) els.hrPageInfo.textContent = `Pagina ${state.hrPage} de ${totalPages}`;
  if (els.hrPrevPageButton) els.hrPrevPageButton.disabled = state.hrPage <= 1;
  if (els.hrNextPageButton) els.hrNextPageButton.disabled = state.hrPage >= totalPages;
}

function openEmployeeEditFromHr(employeeId) {
  if (!employeeId) return;
  state.hrPendingEditEmployeeId = String(employeeId);
  state.registryEditingId = String(employeeId);
  state.selectedRegistryType = "employees";
  location.hash = "#settings-registries";
  syncRoute();
  renderRegistries();
}

function openEmployeeAccessFromHr(employeeId) {
  if (!employeeId) return;
  state.hrPendingAccessEmployeeId = String(employeeId);
  const linkedUser = (state.users ?? []).find((user) =>
    String(user.professionalType ?? "") === "employee" && String(user.professionalId ?? "") === String(employeeId)
  );
  state.hrPendingAccessUserId = linkedUser ? String(linkedUser.id) : "";
  location.hash = "#security-users";
  syncRoute();
  renderSecurity();
}

function renderRegistries() {
  const search = normalize(els.registrySearch.value);
  const registries = state.registries.filter((registry) => normalize(`${registry.label} ${registry.group}`).includes(search));
  if (!state.registries.some((registry) => registry.type === state.selectedRegistryType)) {
    state.selectedRegistryType = state.registries[0]?.type ?? "branches";
  }

  els.registryTypeList.innerHTML = registries.map((registry) => `
    <button class="registry-type-button ${registry.type === state.selectedRegistryType ? "active" : ""}" type="button" data-registry-type="${escapeHtml(registry.type)}">
      <strong>${escapeHtml(registry.label)}</strong>
      <small>${escapeHtml(registry.group)} · ${registry.count ?? 0} registro(s)</small>
    </button>
  `).join("");

  els.registryTypeList.querySelectorAll("[data-registry-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedRegistryType = button.dataset.registryType;
      await refreshRegistryRecords();
    });
  });

  const definition = currentRegistryDefinition();
  els.registryTitle.textContent = definition?.label ?? "Cadastros";
  renderRegistryForm(definition);
  applyHrPendingEmployeeEdit();
  renderList(els.registryRecordsList, registryRows(state.selectedRegistryType), registryRecordItem);
}

function applyHrPendingEmployeeEdit() {
  if (state.selectedRegistryType !== "employees" || !state.hrPendingEditEmployeeId || !els.registryForm) return;
  const employee = registryRows("employees").find((row) => String(row.id) === String(state.hrPendingEditEmployeeId));
  state.hrPendingEditEmployeeId = "";
  if (!employee) return;
  state.registryEditingId = String(employee.id ?? "");
  setFormValues(els.registryForm, employee);
  els.registryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMenuAudit() {
  if (!els.menuAuditSummary || !els.menuAuditList || !els.menuAuditIssues) return;
  const rows = flattenNavigationItems(applyNavigationOverrides(navigationItems));
  const issues = validateNavigationItems(rows);
  const restricted = rows.filter((row) => row.permission).length;
  const parents = rows.filter((row) => row.level === 0).length;
  const children = rows.length - parents;

  if (els.menuAuditStatus) {
    els.menuAuditStatus.textContent = issues.length ? `${issues.length} ajuste(s)` : "OK";
    els.menuAuditStatus.classList.toggle("danger", issues.length > 0);
  }

  els.menuAuditSummary.innerHTML = [
    summaryCard("Menus", parents),
    summaryCard("Submenus", children),
    summaryCard("Restritos", restricted),
    summaryCard("Validacao", issues.length ? `${issues.length} ajuste(s)` : "OK")
  ].join("");

  renderList(els.menuAuditIssues, issues, (issue) => `
    <article class="list-item">
      <strong>${escapeHtml(issue.title)}</strong>
      <div class="meta-row">
        <span class="badge danger">${escapeHtml(issue.severity)}</span>
        <span>${escapeHtml(issue.route ?? "sem rota")}</span>
      </div>
      <div class="meta-row"><span>${escapeHtml(issue.detail)}</span></div>
    </article>
  `);

  renderList(els.menuAuditList, rows, (row) => `
    <article class="list-item">
      <strong>${escapeHtml(`${row.level ? "  ".repeat(row.level) : ""}${row.label}`)}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(row.level === 0 ? "Menu" : "Submenu")}</span>
        <span>Rota: #${escapeHtml(row.route)}</span>
        <span>Secao: ${escapeHtml(row.section ?? "sem secao")}</span>
        <span>Ordem: ${Number(row.order ?? 0)}</span>
      </div>
      <div class="meta-row">
        <span>Icone: ${escapeHtml(row.icon ?? "herdado")}</span>
        <span>Permissao: ${escapeHtml(row.permission ? permissionLabel(row.permission) : "Livre")}</span>
        <span>Status: ${escapeHtml(row.status ?? "active")}</span>
      </div>
      <form class="form-grid inline-form menu-override-form" data-navigation-override-form data-route="${escapeHtml(row.route)}">
        <label>Status
          <select name="status">
            <option value="active" ${row.status !== "inactive" ? "selected" : ""}>Ativo</option>
            <option value="inactive" ${row.status === "inactive" ? "selected" : ""}>Inativo</option>
          </select>
        </label>
        <label>Ordem
          <input name="order" type="number" min="0" step="1" value="${Number(row.order ?? 0)}" />
        </label>
        <label>Permissao
          <select name="permission">
            ${navigationPermissionOptions(row.permission)}
          </select>
        </label>
        <button type="submit" data-permission="edit_privileges">Salvar menu</button>
      </form>
    </article>
  `);
}

function renderAccessDenied() {
  if (!els.accessDeniedMessage || !els.accessDeniedSummary) return;
  const denied = state.deniedAccess;
  if (!denied) {
    els.accessDeniedMessage.textContent = "Este menu exige permissao operacional ou esta inativo.";
    els.accessDeniedSummary.innerHTML = "";
    return;
  }
  if (els.accessDeniedBadge) {
    els.accessDeniedBadge.textContent = denied.reason === "inactive" ? "Inativo" : "Restrito";
  }
  els.accessDeniedMessage.textContent = denied.reason === "inactive"
    ? "Este menu está inativo nas configurações do sistema."
    : "Seu usuario nao possui permissao para acessar este menu.";
  els.accessDeniedSummary.innerHTML = [
    summaryCard("Rota", `#${denied.route}`),
    summaryCard("Menu", denied.title ?? denied.route),
    summaryCard("Motivo", denied.reason === "inactive" ? "Menu inativo" : "Permissao insuficiente"),
    summaryCard("Permissao", denied.permission ? permissionLabel(denied.permission) : "Nao aplicavel")
  ].join("");
}

function navigationPermissionOptions(current) {
  return [
    `<option value="" ${!current ? "selected" : ""}>Livre</option>`,
    ...permissionCatalog.map(([id, label]) => `<option value="${escapeHtml(id)}" ${current === id ? "selected" : ""}>${escapeHtml(label)}</option>`)
  ].join("");
}

function flattenNavigationItems(items, level = 0, inheritedParent = "") {
  return [...items]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .flatMap((item) => {
      const config = routeMap[item.route] ?? {};
      const row = {
        ...item,
        level,
        parentRoute: inheritedParent,
        parent: item.parent ?? config.parent,
        section: config.section,
        subview: config.subview,
        title: config.title
      };
      return [row, ...flattenNavigationItems(item.children ?? [], level + 1, item.route)];
    });
}

function validateNavigationItems(rows) {
  const issues = [];
  const routeCounts = new Map();
  const knownPermissions = new Set(permissionCatalog.map(([permission]) => permission));
  const knownSections = new Set(Array.from(document.querySelectorAll(".section")).map((section) => section.id));

  for (const row of rows) {
    routeCounts.set(row.route, (routeCounts.get(row.route) ?? 0) + 1);
    const config = routeMap[row.route];
    if (!config) {
      issues.push({ severity: "alta", title: "Rota sem configuracao", route: row.route, detail: "O item existe no menu, mas nao existe no routeMap." });
      continue;
    }
    if (!knownSections.has(config.section)) {
      issues.push({ severity: "alta", title: "Secao inexistente", route: row.route, detail: `A rota aponta para a secao ${config.section}, mas ela nao existe no HTML.` });
    }
    if (row.level > 0 && !row.parentRoute) {
      issues.push({ severity: "media", title: "Submenu sem menu pai", route: row.route, detail: "O submenu precisa estar vinculado a um menu superior." });
    }
    if (row.permission && !knownPermissions.has(row.permission)) {
      issues.push({ severity: "media", title: "Permissao desconhecida", route: row.route, detail: `A permissao ${row.permission} nao esta no catalogo de permissoes.` });
    }
  }

  for (const [route, count] of routeCounts.entries()) {
    if (count > 1) {
      issues.push({ severity: "media", title: "Rota duplicada", route, detail: `A rota aparece ${count} vezes no mapa de navegacao.` });
    }
  }
  return issues;
}

function renderRegistryForm(definition) {
  if (!definition) {
    els.registryForm.innerHTML = "";
    return;
  }
  const isEditing = Boolean(state.registryEditingId);
  els.registryForm.innerHTML = definition.fields.map((field) => {
    const required = field.required ? "required" : "";
    if (field.type === "select" && field.options) {
      return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}" ${required}>${field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
    }
    const inputType = ["date", "email", "tel", "number", "month"].includes(field.type) ? field.type : "text";
    return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${inputType}" ${required} /></label>`;
  }).join("") + `
    <div class="action-row span-2">
      <button type="submit">${isEditing ? "Salvar alteracoes" : "Salvar cadastro"}</button>
      ${isEditing ? `<button class="secondary" type="button" data-registry-edit-cancel>Cancelar edicao</button>` : ""}
    </div>
  `;
}

function renderUserOptions() {
  renderUserPermissionGrid();
  renderSelect(els.userGroupSelect, registryRows("user-groups"), "Selecione o grupo", (row) => row.name, (row) => row.name, false);
  renderUserProfessionalOptions();
  applyHrPendingEmployeeAccess();
}

function applyHrPendingEmployeeAccess() {
  if (!state.hrPendingAccessEmployeeId || !els.userForm) return;
  const employee = registryRows("employees").find((row) => String(row.id) === String(state.hrPendingAccessEmployeeId));
  const linkedUserId = state.hrPendingAccessUserId;
  state.hrPendingAccessEmployeeId = "";
  state.hrPendingAccessUserId = "";
  if (!employee) return;

  if (linkedUserId) {
    focusSecurityUser(linkedUserId);
    return;
  }

  els.userProfessionalTypeSelect.value = "employee";
  renderUserProfessionalOptions();
  els.userProfessionalSelect.value = String(employee.id ?? "");
  if (!els.userForm.elements.name.value) els.userForm.elements.name.value = employee.name ?? "";
  if (!els.userForm.elements.email.value && employee.email) els.userForm.elements.email.value = employee.email;
  els.userForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusSecurityUser(userId) {
  const safeUserId = String(userId).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const targetForm = els.usersList?.querySelector(`[data-user-edit-form][data-user-id="${safeUserId}"]`);
  const card = targetForm?.closest(".list-item");
  if (!targetForm || !card) return;
  card.classList.add("focus-target");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  const firstInput = targetForm.querySelector("input, select, textarea, button");
  if (firstInput && typeof firstInput.focus === "function") firstInput.focus({ preventScroll: true });
  setTimeout(() => card.classList.remove("focus-target"), 2200);
}

function renderUserProfessionalOptions() {
  const type = els.userProfessionalTypeSelect.value;
  const rows = type === "doctor" ? registryRows("doctors") : type === "employee" ? registryRows("employees") : [];
  els.userProfessionalSelect.disabled = !rows.length;
  renderSelect(els.userProfessionalSelect, rows, rows.length ? "Selecione" : "Sem vinculo", (row) => row.id, (row) => type === "doctor" ? doctorLabel(row) : `${row.name}${row.role ? ` - ${row.role}` : ""}`, false);
}

function renderUserPermissionGrid() {
  if (els.userPermissionGrid.dataset.ready === "true") return;
  els.userPermissionGrid.innerHTML = permissionCatalog.map(([id, label]) => `
    <label class="permission-item"><input type="checkbox" value="${escapeHtml(id)}" data-user-permission /><span>${escapeHtml(label)}</span></label>
  `).join("");
  els.userPermissionGrid.dataset.ready = "true";
}

function applyUserGroupDefaults() {
  const group = registryRows("user-groups").find((row) => row.name === els.userGroupSelect.value);
  if (!group) return;
  els.userForm.elements.modules.value = csv(group.modules).join(",");
  const permissions = new Set(csv(group.permissions));
  els.userPermissionGrid.querySelectorAll("[data-user-permission]").forEach((input) => {
    input.checked = permissions.has(input.value);
  });
}

async function handlePatientSubmit(event) {
  event.preventDefault();
  await api("/v1/patients", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.procedureName = payload.procedureName || "Consulta";
  await api("/v1/appointments", { method: "POST", body: payload });
  event.currentTarget.reset();
  setDefaultAppointmentTimes();
  await refreshAll();
}

async function handleWalkinAdd(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  const procedure = selectedRegistryRow("procedures", payload.procedureName);
  const room = selectedRegistryRow("rooms", payload.roomName);
  const start = new Date(`${payload.date}T${payload.time || "00:00"}`);
  const duration = procedureDurationMinutes(procedure);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  state.walkinItems.push({
    ...payload,
    modality: procedure?.modality ?? room?.modality,
    durationMinutes: duration,
    startsAt: toLocalDateTime(start),
    endsAt: toLocalDateTime(end),
    preparation: procedure?.preparation,
    equipment: room?.equipment,
    attendanceType: "walk_in"
  });
  renderWalkinItems();
}

async function handleWalkinSave() {
  if (!state.walkinItems.length) return;
  for (const item of state.walkinItems) {
    await api("/v1/appointments", {
      method: "POST",
      body: {
        patientId: item.patientId,
        professionalId: item.professionalId,
        branchName: item.branchName,
        procedureName: item.procedureName,
        insuranceName: item.insuranceName,
        planName: item.planName,
        memberId: item.memberId,
        guideNumber: item.guideNumber,
        requesterCrm: item.requesterCrm,
        requesterDoctor: item.requesterDoctor,
        roomName: item.roomName,
        orderSummary: item.orderSummary,
        attendanceType: "walk_in",
        startsAt: item.startsAt,
        endsAt: item.endsAt
      }
    });
  }
  state.walkinItems = [];
  els.walkinForm.reset();
  await refreshAll();
  location.hash = "attendance-frontdesk";
}

async function handleEmergencySubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  const procedure = selectedRegistryRow("procedures", payload.procedureName);
  const room = selectedRegistryRow("rooms", payload.roomName);
  const start = new Date();
  const duration = procedureDurationMinutes(procedure);
  const body = {
    ...payload,
    modality: procedure?.modality ?? room?.modality,
    preparation: procedure?.preparation,
    attendanceType: "urgent_care",
    emergencyStage: "triage_waiting",
    requestSource: payload.requestSource || "reception",
    orderSummary: payload.chiefComplaint,
    startsAt: toLocalDateTime(start),
    endsAt: toLocalDateTime(new Date(start.getTime() + duration * 60 * 1000))
  };
  const result = await api("/v1/appointments", { method: "POST", body });
  event.currentTarget.reset();
  await refreshAll();
  state.selectedAppointmentId = result?.data?.id ?? state.selectedAppointmentId;
  renderEmergency();
}

async function handleEmergencyStageClick(button) {
  const appointmentId = button.dataset.appointmentId;
  const nextStage = button.dataset.emergencyStage;
  if (!appointmentId || !nextStage) return;
  const patch = emergencyStagePatch(nextStage);
  const { status, ...appointmentPatch } = patch;
  await api(`/v1/appointments/${appointmentId}`, { method: "PATCH", body: appointmentPatch });
  if (status) {
    await api(`/v1/appointments/${appointmentId}/status`, { method: "PATCH", body: { status } });
  }
  await refreshAll();
  renderEmergency();
}

async function handleEmergencyTicketClick(button) {
  const appointmentId = button.dataset.appointmentId;
  if (!appointmentId) return;
  await api(`/v1/appointments/${appointmentId}/totem-ticket`, { method: "POST", body: {} });
  await refreshAll();
  renderEmergency();
}

async function handleEmergencyCallClick(button) {
  const appointmentId = button.dataset.appointmentId;
  if (!appointmentId) return;
  await api(`/v1/appointments/${appointmentId}/call-display`, {
    method: "POST",
    body: { counterId: els.emergencyCounterSelect?.value }
  });
  await refreshAll();
  renderEmergency();
}

async function handleEmergencyWorklistClick(button) {
  const appointmentId = button.dataset.appointmentId;
  if (!appointmentId) return;
  await api(`/v1/worklist/${appointmentId}/publish`, { method: "POST", body: {} });
  await refreshAll();
  renderEmergency();
}

async function handleEmergencyLabClick(button) {
  const appointmentId = button.dataset.appointmentId;
  if (!appointmentId) return;
  await api(`/v1/appointments/${appointmentId}/laboratory-order`, { method: "POST", body: {} });
  await refreshAll();
  renderEmergency();
}

async function handleLaboratoryOrderClick(event) {
  const button = event.target.closest("[data-lab-status]");
  if (!button) return;
  await api(`/v1/laboratory/orders/${button.dataset.labOrderId}/status`, {
    method: "PATCH",
    body: { status: button.dataset.labStatus }
  });
  await refreshAll();
}

async function handleAppointmentDetailSubmit(event) {
  const editForm = event.target.closest("[data-appointment-edit]");
  const noteForm = event.target.closest("[data-appointment-note]");
  if (!editForm && !noteForm) return;
  event.preventDefault();
  if (editForm) {
    const appointmentId = editForm.dataset.appointmentEdit;
    await api(`/v1/appointments/${appointmentId}`, { method: "PATCH", body: formPayload(editForm) });
    state.selectedAppointmentId = appointmentId;
  } else if (noteForm) {
    const appointmentId = noteForm.dataset.appointmentNote;
    await api(`/v1/appointments/${appointmentId}/notes`, { method: "POST", body: formPayload(noteForm) });
    noteForm.reset();
    state.selectedAppointmentId = appointmentId;
  }
  await refreshAll();
  await loadAppointmentAudit();
  renderAppointmentDetail();
}

async function handleAppointmentDetailClick(event) {
  const statusButton = event.target.closest("[data-appointment-status]");
  const authorizationButton = event.target.closest("[data-authorization-status]");
  const worklistButton = event.target.closest("[data-publish-worklist]");
  if (!statusButton && !authorizationButton && !worklistButton) return;
  event.preventDefault();
  event.stopPropagation();
  if (statusButton) {
    await api(`/v1/appointments/${statusButton.dataset.appointmentId}/status`, {
      method: "PATCH",
      body: { status: statusButton.dataset.appointmentStatus }
    });
    state.selectedAppointmentId = statusButton.dataset.appointmentId;
  } else if (authorizationButton) {
    await api(`/v1/appointments/${authorizationButton.dataset.appointmentId}/authorization`, {
      method: "PATCH",
      body: { authorizationStatus: authorizationButton.dataset.authorizationStatus }
    });
    state.selectedAppointmentId = authorizationButton.dataset.appointmentId;
  } else if (worklistButton) {
    await api(`/v1/worklist/${worklistButton.dataset.publishWorklist}/publish`, { method: "POST", body: {} });
    state.selectedAppointmentId = worklistButton.dataset.publishWorklist;
  }
  await refreshAll();
  await loadAppointmentAudit();
  renderAppointmentDetail();
}

async function handleTotemTicketSubmit(event) {
  event.preventDefault();
  await api("/v1/totem/tickets", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleTotemCallSubmit(event) {
  event.preventDefault();
  await api("/v1/totem/call-next", { method: "POST", body: formPayload(event.currentTarget) });
  await refreshAll();
}

async function handleTotemDisplayConfigSubmit(event) {
  event.preventDefault();
  await api("/v1/totem/display-config", { method: "PATCH", body: formPayload(event.currentTarget) });
  await refreshAll();
}

async function handleLisSubmit(event) {
  event.preventDefault();
  await api("/v1/laboratory/interfaces", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleSupportLabSubmit(event) {
  event.preventDefault();
  await api("/v1/laboratory/support-exams", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleInvoiceSubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.totalAmountCents = Math.round(Number(payload.amount || 0) * 100);
  delete payload.amount;
  await api("/v1/billing/invoices", { method: "POST", body: payload });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleBillingBatchSubmit(event) {
  event.preventDefault();
  await api("/v1/billing/batches", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleFinanceSubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.amountCents = Math.round(Number(payload.amount || 0) * 100);
  delete payload.amount;
  await api("/v1/finance/entries", { method: "POST", body: payload });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleRelationshipCallSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/calls/simulate", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappConfigSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/config", { method: "PATCH", body: formPayload(event.currentTarget) });
  await refreshAll();
}

async function handleWhatsappSimulationSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/messages/simulate", { method: "POST", body: formPayload(event.currentTarget) });
  await refreshAll();
}

async function handleWhatsappEvolutionRefresh() {
  const response = await api("/v1/relationship/whatsapp/evolution/status");
  state.whatsappEvolution = response.data;
  renderWhatsapp();
}

async function handleWhatsappEvolutionCreate() {
  const response = await api("/v1/relationship/whatsapp/evolution/instance", { method: "POST", body: {} });
  state.whatsappEvolutionConnect = response.data;
  await handleWhatsappEvolutionRefresh();
  renderWhatsapp();
}

async function handleWhatsappEvolutionConnect() {
  const response = await api("/v1/relationship/whatsapp/evolution/connect", {
    method: "POST",
    body: { number: els.whatsappEvolutionNumberInput?.value ?? "" }
  });
  state.whatsappEvolutionConnect = response.data;
  renderWhatsapp();
}

function handleWhatsappInboxClick(event) {
  const button = event.target.closest("[data-inbox-conversation-id]");
  if (!button) return;
  state.selectedWhatsappConversationId = button.dataset.inboxConversationId;
  renderWhatsappInbox();
}

async function handleWhatsappInboxReply(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  if (!payload.conversationId || !String(payload.text ?? "").trim()) return;
  await api("/v1/relationship/whatsapp/messages/manual", { method: "POST", body: payload });
  if (els.whatsappInboxReplyText) els.whatsappInboxReplyText.value = "";
  await refreshAll();
}

async function handleWhatsappSupervisionClick(event) {
  const reviewForm = event.target.closest("[data-whatsapp-review-form]");
  if (reviewForm && event.type === "submit") event.preventDefault();
  const approveButton = event.target.closest("[data-whatsapp-approve-id]");
  const autonomyApproveButton = event.target.closest("[data-whatsapp-autonomy-approve-id]");
  const autonomyRejectButton = event.target.closest("[data-whatsapp-autonomy-reject-id]");
  const assumeButton = event.target.closest("[data-whatsapp-assume-id]");
  const releaseButton = event.target.closest("[data-whatsapp-release-id]");
  const resolveButton = event.target.closest("[data-whatsapp-resolve-id]");
  if (reviewForm) {
    await approveReviewedWhatsappMessage(reviewForm);
  } else if (approveButton) {
    await api("/v1/relationship/whatsapp/outbox/approve", { method: "POST", body: { messageId: approveButton.dataset.whatsappApproveId } });
  } else if (autonomyApproveButton) {
    await api("/v1/relationship/whatsapp/autonomy-reviews/approve", { method: "POST", body: { taskId: autonomyApproveButton.dataset.whatsappAutonomyApproveId } });
  } else if (autonomyRejectButton) {
    await api("/v1/relationship/whatsapp/autonomy-reviews/reject", { method: "POST", body: { taskId: autonomyRejectButton.dataset.whatsappAutonomyRejectId } });
  } else if (assumeButton) {
    await api("/v1/relationship/whatsapp/conversations/assume", { method: "POST", body: { conversationId: assumeButton.dataset.whatsappAssumeId } });
  } else if (releaseButton) {
    await api("/v1/relationship/whatsapp/conversations/release", { method: "POST", body: { conversationId: releaseButton.dataset.whatsappReleaseId } });
  } else if (resolveButton) {
    await api("/v1/relationship/whatsapp/conversations/resolve", { method: "POST", body: { conversationId: resolveButton.dataset.whatsappResolveId } });
  } else {
    return;
  }
  await refreshAll();
}

async function approveReviewedWhatsappMessage(form) {
  const messageId = form.dataset.messageId;
  const text = form.elements.text?.value ?? "";
  if (!messageId || !String(text).trim()) return;
  await api("/v1/relationship/whatsapp/outbox/approve", { method: "POST", body: { messageId, text } });
}

async function handleWhatsappProfileUpdateClick(event) {
  const button = event.target.closest("[data-profile-update-status]");
  if (!button) return;
  await api("/v1/relationship/whatsapp/profile-updates/resolve", {
    method: "POST",
    body: { updateId: button.dataset.profileUpdateId, status: button.dataset.profileUpdateStatus }
  });
  await refreshAll();
}

async function handleWhatsappProfileUpdateSubmit(event) {
  const form = event.target.closest("[data-profile-phone-form]");
  if (!form) return;
  event.preventDefault();
  const correctedValue = form.elements.correctedValue?.value ?? "";
  if (!String(correctedValue).trim()) return;
  await api("/v1/relationship/whatsapp/profile-updates/resolve", {
    method: "POST",
    body: {
      updateId: form.dataset.profileUpdateId,
      status: "reviewed",
      correctedValue,
      reprocess: Boolean(form.elements.reprocess?.checked)
    }
  });
  await refreshAll();
}

async function handleWhatsappManualReply(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/messages/manual", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappFlowSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/flows", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappTemplateSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/templates", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappAutonomyRuleSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/autonomy-rules", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappAutonomyProfileSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/autonomy-profiles", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappJourneySubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/journeys", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappAvailabilitySubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  const params = new URLSearchParams(payload);
  const response = await api(`/v1/appointments/availability?${params.toString()}`);
  state.whatsappAvailability = response.data;
  renderWhatsapp();
}

async function handleWhatsappInsuranceValidationSubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  const params = new URLSearchParams(payload);
  const response = await api(`/v1/relationship/whatsapp/insurance-validation?${params.toString()}`);
  state.whatsappInsuranceValidation = response.data;
  renderWhatsapp();
}

async function handleWhatsappPrepRuleSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/whatsapp/prep-rules", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleWhatsappOutboxClick(event) {
  const reviewForm = event.target.closest("[data-whatsapp-review-form]");
  const sendButton = event.target.closest("[data-whatsapp-send-id]");
  const retryButton = event.target.closest("[data-whatsapp-retry-id]");
  const resolveFailureButton = event.target.closest("[data-whatsapp-resolve-failure-id]");
  if (reviewForm && event.type === "submit") event.preventDefault();
  if (reviewForm) {
    await approveReviewedWhatsappMessage(reviewForm);
    await refreshAll();
    return;
  }
  if (!sendButton && !retryButton && !resolveFailureButton) return;
  const endpoint = sendButton
    ? "/v1/relationship/whatsapp/outbox/send"
    : retryButton
      ? "/v1/relationship/whatsapp/outbox/retry"
      : "/v1/relationship/whatsapp/outbox/resolve-failure";
  const messageId = sendButton?.dataset.whatsappSendId ?? retryButton?.dataset.whatsappRetryId ?? resolveFailureButton?.dataset.whatsappResolveFailureId;
  await api(endpoint, { method: "POST", body: { messageId } });
  await refreshAll();
}

async function handleWhatsappSendPending() {
  await api("/v1/relationship/whatsapp/outbox/send-pending", { method: "POST", body: {} });
  await refreshAll();
}

async function handleUraConfigSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/ura/config", { method: "PATCH", body: formPayload(event.currentTarget) });
  await refreshAll();
}

async function handleUraFlowSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/ura/flows", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleUraLiveCallSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/ura/live/simulate", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleUraProviderEventSubmit(event) {
  event.preventDefault();
  await api("/v1/relationship/ura/events", { method: "POST", body: formPayload(event.currentTarget) });
  event.currentTarget.reset();
  await refreshAll();
}

async function handleUraConnectorAction(action) {
  const endpoint = {
    test: "/v1/relationship/ura/connector/test",
    connect: "/v1/relationship/ura/connector/connect",
    disconnect: "/v1/relationship/ura/connector/disconnect"
  }[action];
  if (!endpoint) return;
  try {
    await api(endpoint, { method: "POST", body: {} });
  } catch (error) {
    console.warn(error.message);
  }
  await refreshAll();
}

async function handleUraCommandSubmit(event) {
  event.preventDefault();
  try {
    await api("/v1/relationship/ura/commands", { method: "POST", body: formPayload(event.currentTarget) });
  } catch (error) {
    console.warn(error.message);
  }
  await refreshAll();
}

async function handleUserSubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.permissions = Array.from(els.userPermissionGrid.querySelectorAll("[data-user-permission]:checked")).map((input) => input.value);
  payload.professionalName = els.userProfessionalSelect.value ? els.userProfessionalSelect.selectedOptions[0]?.textContent : "";
  await api("/v1/security/users", { method: "POST", body: payload });
  event.currentTarget.reset();
  renderUserOptions();
  await refreshAll();
}

async function handleUserEditSubmit(event) {
  const form = event.target.closest("[data-user-edit-form]");
  if (!form) return;
  event.preventDefault();
  const userId = form.dataset.userId;
  const payload = formPayload(form);
  if (!payload.password) delete payload.password;
  await api(`/v1/security/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: payload });
  await refreshAll();
}

async function handleUserStatusClick(event) {
  const button = event.target.closest("[data-user-status-id]");
  if (!button) return;
  await api(`/v1/security/users/${encodeURIComponent(button.dataset.userStatusId)}/status`, {
    method: "PATCH",
    body: { status: button.dataset.userStatus }
  });
  await refreshAll();
}

async function handleRegistrySubmit(event) {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  if (state.registryEditingId) {
    await api(`/v1/registries/${state.selectedRegistryType}/${encodeURIComponent(state.registryEditingId)}`, {
      method: "PATCH",
      body: payload
    });
  } else {
    await api(`/v1/registries/${state.selectedRegistryType}`, { method: "POST", body: payload });
  }
  event.currentTarget.reset();
  state.registryEditingId = "";
  await refreshAll();
}

async function handleNavigationOverrideSubmit(event) {
  const form = event.target.closest("[data-navigation-override-form]");
  if (!form) return;
  event.preventDefault();
  const route = form.dataset.route;
  if (!route) return;
  await api(`/v1/settings/navigation/${encodeURIComponent(route)}`, {
    method: "PATCH",
    body: formPayload(form)
  });
  const response = await getOptional("/v1/settings/navigation");
  state.navigationOverrides = response?.data ?? [];
  renderNavigation();
  renderMenuAudit();
  syncRoute();
}

async function refreshRegistryRecords() {
  const response = await getOptional(`/v1/registries/${state.selectedRegistryType}`);
  state.registryData[state.selectedRegistryType] = response?.data ?? [];
  renderRegistries();
}

async function logout() {
  try {
    if (state.token) await api("/v1/auth/logout", { method: "POST", body: {} });
  } finally {
    state.token = null;
    state.user = null;
    localStorage.removeItem(tokenKey);
    els.loginOverlay.classList.remove("hidden");
    renderNavigation();
    renderSession();
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.auth !== false && state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      state.token = null;
      localStorage.removeItem(tokenKey);
      els.loginOverlay.classList.remove("hidden");
    }
    throw new Error(data.error?.message ?? "Falha na requisicao");
  }
  return data;
}

async function getOptional(path, auth = true) {
  try {
    return await api(path, { auth });
  } catch {
    return { data: [] };
  }
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setFormValues(form, values) {
  Array.from(form.elements).forEach((field) => {
    if (!field.name || values[field.name] === undefined || values[field.name] === null) return;
    field.value = String(values[field.name]);
  });
}

function syncRoute() {
  const route = (location.hash || "#dashboard").replace("#", "");
  const requestedRoute = routeMap[route] ? route : "dashboard";
  const access = routeAccessStatus(requestedRoute);
  if (!access.allowed) {
    state.deniedAccess = access;
    auditDeniedRouteAccess(access);
  } else if (requestedRoute !== "access-denied") {
    state.deniedAccess = null;
  }
  const activeRoute = access.allowed ? requestedRoute : "access-denied";
  const config = routeMap[activeRoute] ?? routeMap.dashboard;
  state.activeRoute = activeRoute;
  const section = config.section;
  document.querySelectorAll(".section").forEach((item) => item.classList.toggle("active-section", item.id === section));
  document.querySelectorAll("[data-route]").forEach((item) => item.classList.toggle("active", access.allowed && item.dataset.route === requestedRoute));
  document.querySelectorAll("[data-nav-parent]").forEach((item) => item.classList.toggle("active-parent", access.allowed && item.dataset.navParent === config.parent));
  els.pageTitle.textContent = config.title;
  applySubview(section, config.subview);
  renderAccessDenied();
  applyRouteDefaults(activeRoute, config);
  applyRouteFocus(activeRoute);
}

function applyRouteFocus(activeRoute) {
  const targetRoute = state.pendingRouteFocus;
  if (!targetRoute || targetRoute !== activeRoute) return;
  state.pendingRouteFocus = "";
  const selectorsByRoute = {
    "settings-registries": "#registrySearch",
    "imaging-worklist": "#worklistList",
    "imaging-pacs": "#pacsStudiesList",
    "laboratory-lis": "#lisInterfaceForm input, #lisInterfaceForm select, #lisInterfaceForm textarea, #lisInterfaceForm button",
    "relationship-ura": "#uraConfigForm input, #uraConfigForm select, #uraConfigForm textarea, #uraConfigForm button",
    "relationship-whatsapp": "#whatsappConfigForm input, #whatsappConfigForm select, #whatsappConfigForm textarea, #whatsappConfigForm button",
    "security-users": "#userForm input, #userForm select, #userForm textarea, #userForm button",
    "security-system-state": "#systemStateRunButton",
    "human-resources": "#human-resources .panel"
  };
  const selector = selectorsByRoute[activeRoute];
  if (!selector) return;
  requestAnimationFrame(() => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof element.focus === "function") {
      element.focus({ preventScroll: true });
    }
  });
}

function routeAccessStatus(route) {
  if (route === "access-denied") return { allowed: true, route };
  if (!state.user) return { allowed: true, route };
  const path = findNavigationPath(route, applyNavigationOverrides(navigationItems));
  if (!path.length) return { allowed: true, route };
  const inactive = path.find((item) => item.status === "inactive");
  if (inactive) {
    return {
      allowed: false,
      route,
      title: routeMap[route]?.title ?? route,
      reason: "inactive",
      status: "inactive",
      blockedBy: inactive.route
    };
  }
  const restricted = path.find((item) => item.permission && !hasPermission(item.permission));
  if (restricted) {
    return {
      allowed: false,
      route,
      title: routeMap[route]?.title ?? route,
      reason: "permission",
      permission: restricted.permission,
      blockedBy: restricted.route
    };
  }
  return { allowed: true, route };
}

function findNavigationPath(route, items, path = []) {
  for (const item of items) {
    const nextPath = [...path, item];
    if (item.route === route) return nextPath;
    const childPath = findNavigationPath(route, item.children ?? [], nextPath);
    if (childPath.length) return childPath;
  }
  return [];
}

async function auditDeniedRouteAccess(access) {
  if (!state.token || !access?.route) return;
  const key = `${access.route}:${access.reason}:${access.permission ?? ""}:${access.status ?? ""}`;
  if (state.lastDeniedAuditKey === key) return;
  state.lastDeniedAuditKey = key;
  try {
    await api("/v1/settings/navigation/access-denied", {
      method: "POST",
      body: {
        route: access.route,
        title: access.title,
        reason: access.reason,
        permission: access.permission,
        status: access.status
      }
    });
  } catch (error) {
    console.warn(error.message);
  }
}

function applySubview(sectionId, subview) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  inferSubviewTargets();
  section.querySelectorAll("[data-subview]").forEach((element) => {
    const allowed = String(element.dataset.subview ?? "").split(/\s+/).filter(Boolean);
    element.hidden = Boolean(subview) && !allowed.includes(subview);
  });
}

function inferSubviewTargets() {
  els.financeReconciliationList?.closest(".panel")?.setAttribute("data-subview", "reconciliation");
}

function applyRouteDefaults(route, config) {
  if (config.section !== "finance" || !els.financeDirectionFilter) return;
  els.financeDirectionFilter.value = config.financeDirection ?? "";
  els.financeReconciliationFilter.value = config.reconciliation ?? "";
  if (route === "finance-cash" || route === "finance") {
    els.financeStatusFilter.value = "";
    els.financeSearch.value = "";
  }
  renderFinance();
}

function applyPermissionState() {
  document.querySelectorAll("[data-permission]").forEach((element) => {
    const permission = element.dataset.permission;
    element.disabled = !hasPermission(permission);
    element.title = element.disabled ? `Permissao necessaria: ${permission}` : "";
  });
}

function hasPermission(permission) {
  if (!permission) return true;
  if (!state.user) return false;
  if (state.user.role === "admin" || (state.user.modules ?? []).includes("all")) return true;
  return (state.user.permissions ?? []).includes(permission);
}

function renderList(element, rows, toHtml) {
  element.innerHTML = rows.length ? rows.map(toHtml).join("") : `<div class="empty-state">Nenhum registro encontrado.</div>`;
}

function renderSelect(select, rows, placeholder, valueFn, labelFn, pickFirst = true) {
  const current = select.value;
  select.innerHTML = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...rows.map((row) => `<option value="${escapeHtml(valueFn(row))}">${escapeHtml(labelFn(row))}</option>`)
  ].join("");
  if (rows.some((row) => String(valueFn(row)) === current)) {
    select.value = current;
  } else if (pickFirst && rows.length) {
    select.value = valueFn(rows[0]);
  }
}

function selectedAppointment() {
  if (!state.selectedAppointmentId && state.appointments.length) {
    state.selectedAppointmentId = state.appointments[0].id;
  }
  return state.appointments.find((appointment) => appointment.id === state.selectedAppointmentId);
}

function patientById(patientId) {
  return state.patients.find((patient) => patient.id === patientId);
}

async function openAppointmentDetail(appointmentId) {
  state.selectedAppointmentId = appointmentId;
  state.selectedAppointmentDetailTab = "attendance";
  await loadAppointmentAudit(appointmentId);
  if (location.hash !== "#attendance-detail") {
    location.hash = "attendance-detail";
  } else {
    syncRoute();
    renderAppointmentDetail();
  }
}

async function loadAppointmentAudit(appointmentId = state.selectedAppointmentId) {
  if (!appointmentId) return;
  const response = await getOptional(`/v1/appointments/${appointmentId}/audit`);
  state.appointmentAudit = response?.data ?? [];
}

function detailInput(label, name, value = "", type = "text") {
  return `<label>${escapeHtml(label)} <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value ?? "")}" /></label>`;
}

function selectField(name, current, options) {
  return `<select name="${escapeHtml(name)}">${options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(current ?? "") === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
}

function detailGenericForm(appointment, title, fields) {
  return `
    <form class="panel form-grid detail-form" data-appointment-edit="${escapeHtml(appointment.id)}">
      <div class="panel-heading"><h2>${escapeHtml(title)}</h2><span class="badge">${escapeHtml(patientName(appointment.patientId))}</span></div>
      ${fields.map(([label, name]) => detailInput(label, name, appointment[name])).join("")}
      <button type="submit">Salvar ${escapeHtml(title.toLowerCase())}</button>
    </form>
  `;
}

function kv(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "Nao informado")}</strong></div>`;
}

function simpleRows(rows, toText) {
  return rows.length
    ? `<div class="list">${rows.map((row) => `<article class="list-item"><span>${escapeHtml(toText(row))}</span></article>`).join("")}</div>`
    : `<div class="empty-state">Nenhum registro vinculado.</div>`;
}

function appointmentTimeline(appointment) {
  const baseEvents = [
    { label: "Atendimento criado", at: appointment.createdAt },
    appointment.updatedAt ? { label: "Ultima atualizacao", at: appointment.updatedAt } : null,
    appointment.authorizedAt ? { label: "Autorizacao registrada", at: appointment.authorizedAt } : null,
    appointment.status ? { label: `Status atual: ${statusLabel(appointment.status)}`, at: appointment.updatedAt ?? appointment.createdAt } : null
  ].filter(Boolean);
  const auditEvents = (state.appointmentAudit ?? []).map((event) => ({
    label: appointmentAuditLabel(event.action),
    at: event.createdAt,
    meta: event.userName ?? event.userEmail ?? "Sistema"
  }));
  const rows = [...auditEvents, ...baseEvents]
    .filter((event) => event.at || event.label)
    .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
    .slice(0, 12);
  return `
    <div class="panel">
      <div class="panel-heading"><h2>Linha do tempo</h2><span class="badge">${rows.length}</span></div>
      ${simpleRows(rows, (event) => `${event.label}${event.meta ? ` - ${event.meta}` : ""} - ${formatDate(event.at)}`)}
    </div>
  `;
}

function appointmentAuditLabel(action) {
  const labels = {
    "appointments.created": "Criado",
    "appointments.updated": "Dados editados",
    "appointments.status_updated": "Status alterado",
    "appointments.authorization_updated": "Autorizacao alterada",
    "appointments.note_created": "Observacao adicionada",
    "appointments.totem_ticket_issued": "Senha emitida",
    "appointments.display_called": "Chamado no display",
    "appointments.worklist_published": "Worklist publicada",
    "appointments.laboratory_order_created": "Pedido laboratorial criado",
    "laboratory.order_status_updated": "Status laboratório"
  };
  return labels[action] ?? action;
}

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return toLocalDateTime(date);
}

function appointmentItem(appointment) {
  return `
    <article class="list-item">
      <strong>${escapeHtml(patientName(appointment.patientId))}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(statusLabel(appointment.status))}</span>
        <span>${formatDate(appointment.startsAt)}</span>
        <span>${escapeHtml(appointment.procedureName ?? "Consulta")}</span>
        <span>${escapeHtml(appointment.accessionNumber ?? "sem accession")}</span>
      </div>
      <div class="action-row">
        <button class="secondary" type="button" data-appointment-detail="${escapeHtml(appointment.id)}">Detalhe</button>
        <button type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="checked_in">Check-in</button>
        <button type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="completed">Concluir</button>
        <button class="danger" type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="cancelled" data-permission="${appointment.status === "completed" ? "cancel_executed_attendance" : "cancel_attendance"}">Cancelar</button>
      </div>
    </article>
  `;
}

function frontdeskStage(title, rows, hint) {
  return `
    <article class="journey-stage">
      <div class="journey-stage-heading">
        <strong>${escapeHtml(title)}</strong>
        <span>${rows.length}</span>
      </div>
      <small>${escapeHtml(hint)}</small>
      <div class="journey-stage-list">
        ${rows.length ? rows.slice(0, 5).map((appointment) => `
          <div class="journey-chip">
            <strong>${escapeHtml(patientName(appointment.patientId))}</strong>
            <span>${escapeHtml(appointment.procedureName ?? "Atendimento")} · ${formatDate(appointment.startsAt)}</span>
          </div>
        `).join("") : `<div class="empty-state compact-empty">Sem pacientes nesta etapa.</div>`}
      </div>
    </article>
  `;
}

function frontdeskQueueItem(appointment) {
  const pendencies = appointmentPendencies(appointment);
  const snapshot = frontdeskSnapshotRow(appointment);
  return `
    <article class="list-item">
      <strong>${escapeHtml(patientName(appointment.patientId))}</strong>
      <div class="meta-row">
        <span class="badge">${escapeHtml(statusLabel(appointment.status))}</span>
        <span>${escapeHtml(appointment.procedureName ?? "Atendimento")}</span>
        <span>${formatDate(appointment.startsAt)}</span>
        <span>${escapeHtml(appointment.roomName ?? "Sala pendente")}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(appointment.insuranceName ?? "Particular")}</span>
        <span>${escapeHtml(appointment.accessionNumber ?? "sem accession")}</span>
        <span class="badge ${pendencies.length ? "warn" : ""}">${pendencies.length ? `${pendencies.length} pendencia(s)` : "pronto"}</span>
      </div>
      <div class="frontdesk-next-action">
        <span>${escapeHtml(snapshot?.nextAction ?? frontdeskNextAction(appointment))}</span>
        <small>${escapeHtml(stageTimeLabel(appointment))}</small>
      </div>
      <div class="action-row">${frontdeskActions(appointment)}</div>
    </article>
  `;
}

function frontdeskDetailItem(appointment) {
  const patient = state.patients.find((item) => item.id === appointment.patientId);
  const pendencies = appointmentPendencies(appointment);
  const snapshot = frontdeskSnapshotRow(appointment);
  return `
    <article class="list-item operational-card">
      <div class="operational-card-header">
        <strong>${escapeHtml(patient?.fullName ?? appointment.patientName ?? appointment.patientId)}</strong>
        <span class="badge">${escapeHtml(statusLabel(appointment.status))}</span>
      </div>
      <div class="operational-checklist">
        ${checkItem("Ficha", patient?.documentNumber || patient?.phone, patient?.documentNumber ? `Documento ${patient.documentNumber}` : "Completar documento/telefone")}
        ${checkItem("Convênio", appointment.insuranceName, `${appointment.insuranceName ?? "Particular"}${appointment.planName ? ` · ${appointment.planName}` : ""}`)}
        ${checkItem("Guia", appointment.guideNumber || !appointment.guideRequired, appointment.guideNumber ?? (appointment.guideRequired ? "Informar guia obrigatoria" : "Guia nao obrigatoria"))}
        ${checkItem("Autorização", appointment.authorizationStatus !== "pending" && appointment.authorizationStatus !== "denied", authorizationLabel(appointment.authorizationStatus))}
        ${checkItem("Pedido/anexos", appointment.orderSummary, appointment.orderSummary ?? "Conferir pedido médico/anexos")}
        ${checkItem("Sala", appointment.roomName, appointment.roomName ?? "Definir sala")}
      </div>
      <div class="meta-row">
        <span>${escapeHtml(appointment.accessionNumber ?? "sem accession")}</span>
        <span>${escapeHtml(appointment.memberId ? `Carteirinha ${appointment.memberId}` : "sem carteirinha")}</span>
        <span>${escapeHtml(appointment.attendanceType ?? "scheduled")}</span>
      </div>
      <div class="frontdesk-next-action">
        <span>${escapeHtml(snapshot?.nextAction ?? frontdeskNextAction(appointment))}</span>
        <small>${escapeHtml(stageTimeLabel(appointment))}</small>
      </div>
      ${pendencies.length ? `<div class="meta-row">${pendencies.map((item) => `<span class="badge warn">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      <div class="action-row">${frontdeskActions(appointment, true)}</div>
    </article>
  `;
}

function frontdeskActions(appointment, includeWorklist = false) {
  const buttons = [];
  buttons.push(`<button class="secondary" type="button" data-appointment-detail="${escapeHtml(appointment.id)}">Detalhe</button>`);
  if (["scheduled", "confirmed"].includes(appointment.status)) {
    buttons.push(`<button type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="checked_in">Registrar chegada</button>`);
    buttons.push(`<button class="secondary" type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="no_show">Ausente</button>`);
  }
  if (appointment.status === "checked_in") {
    buttons.push(`<button type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="in_attendance">Encaminhar sala</button>`);
  }
  if (["checked_in", "in_attendance"].includes(appointment.status)) {
    buttons.push(`<button class="secondary" type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="completed">Concluir</button>`);
  }
  if (appointment.authorizationStatus === "pending") {
    buttons.push(`<button class="secondary" type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-authorization-status="authorized">Autorizar</button>`);
  }
  if (includeWorklist && !["cancelled", "no_show"].includes(appointment.status)) {
    buttons.push(`<button class="secondary" type="button" data-publish-worklist="${escapeHtml(appointment.id)}" data-permission="restricted_hours_schedule">Publicar worklist</button>`);
  }
  buttons.push(`<button class="danger" type="button" data-appointment-id="${escapeHtml(appointment.id)}" data-appointment-status="cancelled" data-permission="${appointment.status === "completed" ? "cancel_executed_attendance" : "cancel_attendance"}">Cancelar</button>`);
  return buttons.join("");
}

function frontdeskSnapshotRow(appointment) {
  return state.frontdeskSnapshot?.rows?.find((row) => row.id === appointment.id);
}

function frontdeskNextAction(appointment) {
  const pendencies = appointmentPendencies(appointment);
  if (appointment.authorizationStatus === "denied") return "Revisar autorizacao negada";
  if (pendencies.includes("guia")) return "Solicitar guia";
  if (pendencies.includes("autorizacao")) return "Autorizar convenio";
  if (pendencies.includes("pedido")) return "Conferir pedido medico";
  if (["scheduled", "confirmed"].includes(appointment.status)) return "Registrar chegada";
  if (appointment.status === "checked_in") return "Encaminhar sala";
  if (appointment.status === "in_attendance") return "Concluir atendimento";
  if (appointment.status === "completed") return "Faturamento/laudo";
  if (appointment.status === "no_show") return "Reagendar ou encerrar ausencia";
  if (appointment.status === "cancelled") return "Cancelado";
  return "Acompanhar atendimento";
}

function stageTimeLabel(appointment) {
  const events = [
    ["Chegada", appointment.checkedInAt ?? appointment.arrivedAt],
    ["Sala", appointment.inAttendanceAt ?? appointment.careStartedAt],
    ["Concluido", appointment.completedAt],
    ["Cancelado", appointment.cancelledAt],
    ["Ausente", appointment.noShowAt]
  ].filter(([, at]) => at);
  const current = events[events.length - 1];
  if (current) return `${current[0]} ${formatDate(current[1])}`;
  return appointment.startsAt ? `Agenda ${formatDate(appointment.startsAt)}` : "Sem horario";
}

function appointmentPendencies(appointment) {
  const patient = state.patients.find((item) => item.id === appointment.patientId);
  const items = [];
  if (!patient?.documentNumber && !patient?.phone) items.push("ficha");
  if (appointment.insuranceName && appointment.insuranceName !== "Particular" && !appointment.memberId) items.push("carteirinha");
  if (appointment.guideRequired && !appointment.guideNumber) items.push("guia");
  if (appointment.authorizationStatus === "pending") items.push("autorizacao");
  if (appointment.authorizationStatus === "denied") items.push("autorizacao negada");
  if (!appointment.orderSummary) items.push("pedido");
  if (!appointment.roomName) items.push("sala");
  return items;
}

function checkItem(label, ok, detail) {
  return `
    <div class="check-item ${ok ? "ok" : "pending"}">
      <span>${ok ? "OK" : "!"}</span>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    </div>
  `;
}

function registryRecordItem(row) {
  const title = row.name ?? row.description ?? row.model ?? row.ruleName ?? row.id;
  const details = Object.entries(row)
    .filter(([key]) => !["id", "type", "clinicId", "createdAt"].includes(key))
    .slice(0, 6)
    .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
    .join("");
  return `
    <article class="list-item">
      <strong>${escapeHtml(title)}</strong>
      <div class="meta-row">${details}</div>
      <div class="action-row">
        <button class="secondary" type="button" data-registry-edit-id="${escapeHtml(String(row.id ?? ""))}">Editar</button>
        <button class="danger" type="button" data-registry-delete-id="${escapeHtml(String(row.id ?? ""))}">Excluir</button>
      </div>
    </article>
  `;
}

function startRegistryEdit(recordId) {
  if (!recordId || !els.registryForm) return;
  const row = registryRows(state.selectedRegistryType).find((item) => String(item.id) === String(recordId));
  if (!row) return;
  state.registryEditingId = String(recordId);
  renderRegistryForm(currentRegistryDefinition());
  setFormValues(els.registryForm, row);
  els.registryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleRegistryDelete(recordId) {
  if (!recordId) return;
  const confirmed = await openRegistryDeleteModal(recordId);
  if (!confirmed) return;
  try {
    await api(`/v1/registries/${state.selectedRegistryType}/${encodeURIComponent(recordId)}`, { method: "DELETE" });
    if (state.registryEditingId === String(recordId)) {
      state.registryEditingId = "";
      els.registryForm?.reset();
    }
    await refreshAll();
  } catch (error) {
    showRegistryDeleteError(error.message || "Nao foi possivel excluir este cadastro.");
  }
}

function openRegistryDeleteModal(recordId) {
  if (!els.registryDeleteModal) return Promise.resolve(false);
  state.pendingRegistryDeleteId = String(recordId ?? "");
  if (els.registryDeleteError) els.registryDeleteError.textContent = "";
  if (els.registryDeleteConfirmInput) els.registryDeleteConfirmInput.value = "";
  if (els.registryDeleteConfirmButton) els.registryDeleteConfirmButton.disabled = true;
  els.registryDeleteModal.classList.remove("hidden");
  els.registryDeleteModal.setAttribute("aria-hidden", "false");
  setTimeout(() => els.registryDeleteConfirmInput?.focus(), 0);
  return new Promise((resolve) => {
    state.registryDeleteResolver = resolve;
  });
}

function closeRegistryDeleteModal(confirmed) {
  if (!els.registryDeleteModal) return;
  els.registryDeleteModal.classList.add("hidden");
  els.registryDeleteModal.setAttribute("aria-hidden", "true");
  const resolver = state.registryDeleteResolver;
  state.registryDeleteResolver = null;
  if (resolver) resolver(Boolean(confirmed));
}

function showRegistryDeleteError(message) {
  if (!els.registryDeleteModal || !els.registryDeleteError) return;
  els.registryDeleteModal.classList.remove("hidden");
  els.registryDeleteModal.setAttribute("aria-hidden", "false");
  els.registryDeleteError.textContent = message;
  if (els.registryDeleteConfirmInput) {
    els.registryDeleteConfirmInput.value = "";
    els.registryDeleteConfirmInput.focus();
  }
  if (els.registryDeleteConfirmButton) els.registryDeleteConfirmButton.disabled = true;
}

function summaryCard(label, value) {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function currentRegistryDefinition() {
  return state.registries.find((registry) => registry.type === state.selectedRegistryType);
}

function registryRows(type) {
  return state.registryData[type] ?? [];
}

function activeRegistryRows(type) {
  return registryRows(type).filter((row) => row.status !== "inactive");
}

function selectedRegistryRow(type, value) {
  const normalized = normalize(value);
  return activeRegistryRows(type).find((row) => normalize(row.name ?? row.description ?? row.id) === normalized);
}

function registryValue(row) {
  return row.name ?? row.description ?? row.id;
}

function compatibleAppointmentRooms(procedure, branchName = "", unitName = "") {
  const modality = procedure?.modality;
  const rooms = activeRegistryRows("rooms").filter((room) => {
    const modalityOk = !modality || modality === "OT" || !room.modality || room.modality === modality;
    const branchOk = !branchName || normalize(room.branch) === normalize(branchName);
    const unitOk = !unitName || !room.unit || normalize(room.unit) === normalize(unitName) || normalize(room.unitName) === normalize(unitName);
    return modalityOk && branchOk && unitOk;
  });
  if (rooms.length) return rooms;
  return activeRegistryRows("rooms").filter((room) => !modality || modality === "OT" || !room.modality || room.modality === modality);
}

function isGuideRequired(insurance) {
  return normalize(insurance?.guideRequired).startsWith("sim");
}

function procedureDurationMinutes(procedure = {}) {
  const match = String(procedure?.duration ?? "").match(/(\d+)/);
  return Math.max(15, Math.min(180, Number(match?.[1] ?? 30)));
}

function applyProcedureDuration(procedure) {
  if (!els.appointmentStartsAtInput?.value || !els.appointmentEndsAtInput) return;
  const start = new Date(els.appointmentStartsAtInput.value);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + procedureDurationMinutes(procedure) * 60 * 1000);
  els.appointmentEndsAtInput.value = toLocalDateTime(end);
}

function patientName(patientId) {
  return state.patients.find((patient) => patient.id === patientId)?.fullName ?? patientId ?? "Paciente";
}

function doctorLabel(row) {
  return `${row.name}${row.councilNumber ? ` - ${row.councilNumber}` : ""}`;
}

function permissionLabel(id) {
  return permissionCatalog.find(([permission]) => permission === id)?.[1] ?? id;
}

function userRoleOptions(current) {
  const roles = [
    ["frontdesk", "Recepção"],
    ["billing", "Faturamento"],
    ["doctor", "Medico"],
    ["manager", "Gestor"],
    ["admin", "Administrador"],
    ["viewer", "Leitura"]
  ];
  return roles.map(([value, label]) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function roleLabel(role) {
  const labels = { admin: "admin", manager: "gestor", doctor: "medico", billing: "faturamento", frontdesk: "recepção", viewer: "leitura" };
  return labels[role] ?? role;
}

function securityAuditLabel(action) {
  const labels = {
    "auth.login": "Login",
    "auth.logout": "Logout",
    "auth.login_failed": "Falha de login",
    "security.user_created": "Usuario criado",
    "security.user_updated": "Usuario atualizado",
    "security.user_status_changed": "Status de usuario alterado",
    "security.system_state_snapshot": "Diagnostico do sistema",
    "settings.navigation_access_denied": "Acesso negado",
    "settings.navigation_override_updated": "Menu atualizado",
    "lgpd.consent_registered": "Consentimento LGPD",
    "lgpd.export_requested": "Exportacao LGPD",
    "lgpd.anonymization_requested": "Anonimizacao LGPD"
  };
  return labels[action] ?? action;
}

function auditDetails(details) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(",") : value}`)
    .join(" | ");
}

function billingSubviewTitle(subview) {
  const labels = { invoices: "Faturas", batches: "Lotes", denials: "Glosas", payouts: "Repasses" };
  return labels[subview] ?? "Faturamento";
}

function financeDirectionLabel(direction) {
  return direction === "payable" ? "A pagar" : "A receber";
}

function financeStatusLabel(status) {
  const labels = { open: "Aberto", paid: "Pago", cancelled: "Cancelado" };
  return labels[status] ?? status;
}

function reconciliationLabel(status) {
  const labels = { pending: "Pendente", reconciled: "Conciliado", divergent: "Divergente" };
  return labels[status] ?? status;
}

function relationshipStatusLabel(status) {
  const labels = { needs_human_review: "Revisao humana", agent_suggested: "Agente sugeriu", resolved: "Resolvido" };
  return labels[status] ?? status;
}

function uraStatusLabel(status) {
  const labels = { active: "Ativo", homologation: "Homologacao", production: "Producao", inactive: "Inativo" };
  return labels[status] ?? status;
}

function uraLiveStatusLabel(status) {
  const labels = { transferred: "Transferida", needs_human_review: "Revisao humana", ringing: "Tocando", in_progress: "Em atendimento", completed: "Finalizada" };
  return labels[status] ?? status;
}

function uraReadinessLabel(status) {
  const labels = { production_ready: "Pronta para producao", ready_for_homologation: "Pronta para homologacao", needs_configuration: "Configurar" };
  return labels[status] ?? status;
}

function uraProviderEventLabel(type) {
  const labels = {
    channel_started: "Inicio canal",
    call_answered: "Atendida",
    dtmf_received: "DTMF recebido",
    bridge_entered: "Entrou na ponte",
    transfer_completed: "Transferida",
    hangup: "Desligada"
  };
  return labels[type] ?? type;
}

function uraConnectorStatusLabel(status) {
  const labels = { disconnected: "Desconectado", connecting: "Conectando", connected: "Conectado", error: "Erro", unsupported: "Indisponivel" };
  return labels[status] ?? status;
}

function uraCommandActionLabel(action) {
  const labels = { answer: "Atender", play: "Tocar audio", transfer: "Transferir", record: "Gravar", hangup: "Desligar" };
  return labels[action] ?? action;
}

function uraCommandStatusLabel(status) {
  const labels = { pending: "Pendente", executed: "Executado", failed: "Falhou" };
  return labels[status] ?? status;
}

function whatsappIntentLabel(intent) {
  const labels = { schedule: "Agendamento", cancel: "Cancelamento", order_photo: "Pedido por foto", triage: "Triagem", greeting: "Saudacao", exam_prep: "Preparo", human: "Atendente", location: "Endereco", manual: "Manual", lgpd: "LGPD" };
  return labels[intent] ?? intent;
}

function whatsappActionLabel(action) {
  const labels = { appointment_scheduled: "Agendou", appointment_cancelled: "Cancelou", human_review: "Revisao humana", autonomy_review: "Regra de autonomia", insurance_pending: "Aguardando guia", insurance_review: "Revisao convenio", consent_request: "Pediu consentimento", consent_rejected: "Consentimento recusado", ask_clarification: "Pediu dados", journey_step: "Etapa da cascata", not_found: "Nao encontrou", waiting_human: "Aguardando equipe", manual_reply: "Resposta manual", info_reply: "Informou" };
  return labels[action] ?? action;
}

function whatsappFlowActionLabel(action) {
  const labels = { schedule: "Agendar", cancel: "Cancelar", order: "Pedido/OCR", clarify: "Pedir dados", info: "Informar", human: "Atendente" };
  return labels[action] ?? action;
}

function whatsappTemplateCategoryLabel(category) {
  const labels = { agendamento: "Agendamento", preparo: "Preparo", lgpd: "LGPD", convenio: "Convenio", cancelamento: "Cancelamento", humano: "Humano", lembrete: "Lembrete", geral: "Geral" };
  return labels[category] ?? category;
}

function whatsappAutonomyConditionLabel(condition) {
  const labels = {
    lgpd_rejected: "LGPD recusado",
    identity_unconfirmed: "Identidade nao confirmada",
    low_ocr_confidence: "OCR baixa confianca",
    sensitive_words: "Termos sensiveis",
    authorization_required: "Autorizacao pendente",
    same_day_cancel: "Cancelamento no dia",
    private_schedule: "Particular"
  };
  return labels[condition] ?? condition;
}

function whatsappAutonomyActionLabel(action) {
  const labels = { allow: "Permitir", human_review: "Revisao humana", require_approval: "Exigir aprovacao", block: "Bloquear" };
  return labels[action] ?? action;
}

function whatsappAutonomyModeLabel(mode) {
  const labels = { automatic: "Automatico", supervised: "Supervisionado", human: "Humano" };
  return labels[mode] ?? mode;
}

function whatsappAutonomyInsuranceTypeLabel(type) {
  const labels = { all: "Todos", private: "Particular", insurance: "Convenio", unknown: "Nao informado" };
  return labels[type] ?? type;
}

function whatsappAutonomyRequestedActionLabel(action) {
  const labels = { message: "Mensagem", schedule: "Agendamento", cancel: "Cancelamento", order_photo: "Pedido por foto" };
  return labels[action] ?? action;
}

function whatsappAutonomyReviewStatusLabel(status) {
  const labels = { needs_review: "Aguardando aprovacao", approved: "Aprovada", rejected: "Mantida no humano", completed: "Concluida" };
  return labels[status] ?? status;
}

function whatsappSafetyEventLabel(action) {
  const labels = {
    "whatsapp.autonomy_rule_applied": "Regra aplicada",
    "whatsapp.autonomy_rule_approved": "Regra aprovada",
    "whatsapp.autonomy_rule_rejected": "Mantido no humano",
    "whatsapp.outbound_reviewed": "Saida revisada",
    "whatsapp.outbound_failure_resolved": "Falha revisada",
    "whatsapp.outbound_blocked_profile_issue": "Bloqueio cadastral",
    "whatsapp.outbound_reprocessed_after_phone_correction": "Reenvio pos-correcao",
    "whatsapp.profile_update_applied": "Cadastro corrigido",
    "whatsapp.conversation_assumed": "Conversa assumida",
    "whatsapp.message_waiting_human": "Aguardando equipe"
  };
  return labels[action] ?? action;
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
  return labels[category] ?? category ?? "Falha nao classificada";
}

function whatsappJourneyActionLabel(action) {
  const labels = { collect_patient: "Coletar paciente", collect_order: "Coletar pedido", collect_insurance: "Validar convenio", collect_slot: "Preferencia de horario", schedule: "Agendar", cancel: "Cancelar", human_review: "Revisao humana", clarify: "Pedir dados" };
  return labels[action] ?? action;
}

function whatsappOcrStatusLabel(status) {
  const labels = { completed: "Concluido", failed: "Falhou", pending_media: "Aguardando midia", provided: "Texto recebido" };
  return labels[status] ?? status;
}

function whatsappOutboundStatusLabel(status) {
  const labels = {
    queued: "Na fila",
    sending: "Enviando",
    sent: "Enviado",
    failed: "Falhou",
    resolved_failure: "Falha revisada",
    delivered: "Entregue",
    read: "Lido",
    blocked_profile: "Bloqueio cadastral",
    blocked_review: "Revisao humana",
    pending_approval: "Aguardando aprovacao",
    draft: "Rascunho"
  };
  return labels[status] ?? status;
}

function whatsappExecutiveStatusLabel(status) {
  const labels = {
    ready: "Producao",
    homologation: "Homologacao",
    attention: "Atencao",
    blocked: "Bloqueado"
  };
  return labels[status] ?? status ?? "Sem status";
}

function whatsappRiskLabel(risk) {
  const labels = { normal: "Normal", review: "Revisao", delivery: "Entrega", manual: "Manual" };
  return labels[risk] ?? risk ?? "Normal";
}

function latestWhatsappMessage(conversationId) {
  return state.whatsappMessages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
}

function latestWhatsappTask(conversationId) {
  return state.whatsappTasks
    .filter((task) => task.conversationId === conversationId)
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
}

function latestWhatsappConsentForConversation(conversation) {
  return state.whatsappConsents
    .filter((consent) => consent.conversationId === conversation.id || (conversation.patientId && consent.patientId === conversation.patientId))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())[0];
}

function whatsappConversationStatusLabel(conversation) {
  const status = typeof conversation === "string" ? conversation : conversation?.status;
  const labels = {
    open: "Aberta",
    resolved: "Resolvida",
    human_assigned: "Assumida",
    identity_review: "Revisar identidade",
    consent_rejected: "LGPD recusado"
  };
  return labels[status] ?? status ?? "Aberta";
}

function whatsappExceptionTypeLabel(type) {
  const labels = { review: "Revisao", identity: "Identidade", lgpd: "LGPD", delivery: "Envio", insurance: "Convenio", ocr: "OCR", profile: "Cadastro" };
  return labels[type] ?? type;
}

function whatsappExceptionSeverityLabel(severity) {
  const labels = { high: "Urgente", medium: "Atencao", low: "Baixa" };
  return labels[severity] ?? severity;
}

function patientMatchLabel(match) {
  const labels = { phone: "Telefone pendente", cpf: "Reconhecido por CPF", phone_duplicate: "Telefone duplicado", cpf_duplicate: "CPF duplicado", cpf_not_found: "CPF nao localizado", none: "Nao reconhecido" };
  return labels[match] ?? "Paciente";
}

function profileUpdateStatusLabel(status) {
  const labels = { pending: "Pendente", reviewed: "Revisado", rejected: "Rejeitado" };
  return labels[status] ?? status;
}

function whatsappConsentStatusLabel(status) {
  const labels = { accepted: "Consentido", rejected: "Recusado", requested: "Solicitado" };
  return labels[status] ?? status;
}

function profileUpdateFieldLabel(field) {
  const labels = { phone: "Telefone/WhatsApp", documentNumber: "CPF/documento", birthDate: "Nascimento" };
  return labels[field] ?? field;
}

function maskProfileValue(field, value) {
  const raw = String(value ?? "");
  const digits = raw.replace(/\D/g, "");
  if (field === "documentNumber" && digits.length >= 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (field === "phone" && digits.length >= 8) return `${digits.slice(0, 2)} *****-${digits.slice(-4)}`;
  return raw;
}

function statusLabel(status) {
  const labels = { scheduled: "Agendado", confirmed: "Confirmado", checked_in: "Check-in", in_attendance: "Em atendimento", completed: "Concluido", cancelled: "Cancelado", no_show: "Faltou" };
  return labels[status] ?? status;
}

function authorizationLabel(status) {
  const labels = { not_required: "Nao exige autorizacao", pending: "Autorizacao pendente", authorized: "Autorizado", denied: "Autorizacao negada" };
  return labels[status] ?? "Nao informado";
}

function emergencyPriorityLabel(priority) {
  const labels = { routine: "Rotina", priority: "Prioritario", urgent: "Urgente", emergency: "Emergencia" };
  return labels[priority] ?? priority ?? "Rotina";
}

function emergencyPriorityWeight(priority) {
  const weights = { routine: 1, priority: 2, urgent: 3, emergency: 4 };
  return weights[priority] ?? 1;
}

function emergencyPriorityClass(priority) {
  return ["urgent", "emergency"].includes(priority) ? "warn" : "";
}

function emergencyTriageLabel(color) {
  const labels = { blue: "Azul", green: "Verde", yellow: "Amarelo", orange: "Laranja", red: "Vermelho" };
  return labels[color] ?? color ?? "Sem risco";
}

function emergencyTicketLabel(appointment) {
  const number = appointment.totemTicketNumber ? `Senha ${appointment.totemTicketNumber}` : "Sem senha";
  const counter = appointment.totemCounterName ? ` · ${appointment.totemCounterName}` : "";
  return `${number}${counter}`;
}

function emergencyDisplayActions(appointment) {
  if (!appointment.totemTicketNumber) {
    return `<button class="secondary icon-button" type="button" data-emergency-ticket="issue" data-appointment-id="${escapeHtml(appointment.id)}">Senha</button>`;
  }
  const label = appointment.totemCalledAt ? "Rechamar" : "Chamar";
  return `<button class="secondary icon-button" type="button" data-emergency-call="call" data-appointment-id="${escapeHtml(appointment.id)}">${label}</button>`;
}

function emergencyWorklistActions(appointment) {
  if (!isImagingAppointment(appointment)) return "";
  const order = state.worklist.find((item) => item.appointmentId === appointment.id);
  const published = appointment.worklistStatus === "published" || order?.mwlStatus === "published";
  if (published) return `<span class="badge">MWL publicada</span>`;
  return `<button class="secondary icon-button" type="button" data-emergency-worklist="publish" data-appointment-id="${escapeHtml(appointment.id)}">Worklist</button>`;
}

function emergencyLabActions(appointment) {
  if (!isLaboratoryAppointment(appointment)) return "";
  const order = state.laboratoryOrders.find((item) => item.appointmentId === appointment.id || item.id === appointment.labOrderId);
  if (order) return `<span class="badge">Lab ${escapeHtml(laboratoryStatusLabel(order.status))}</span>`;
  return `<button class="secondary icon-button" type="button" data-emergency-lab="order" data-appointment-id="${escapeHtml(appointment.id)}">Laboratório</button>`;
}

function isImagingAppointment(appointment) {
  const modality = normalize(appointment.modality);
  const text = normalize(`${appointment.procedureName ?? ""} ${appointment.roomName ?? ""}`);
  const modalityMatches = ["ct", "mr", "dx", "rx", "us", "mg", "cr", "nm", "pt"].includes(modality);
  const textMatches = ["tomografia", "tc", "ressonancia", "rm", "raio x", "raiox", "rx", "ultrassom", "us", "mamografia", "densitometria"].some((term) => text.includes(term));
  return modalityMatches || textMatches;
}

function isLaboratoryAppointment(appointment) {
  const modality = normalize(appointment.modality);
  const text = normalize(`${appointment.procedureName ?? ""} ${appointment.roomName ?? ""}`);
  const modalityMatches = ["lab", "laboratorio", "lis"].includes(modality);
  const textMatches = ["hemograma", "sangue", "urina", "glicemia", "creatinina", "colesterol", "laboratorio", "laboratorial", "vitamina", "tsh", "hcg", "exame laboratorial"].some((term) => text.includes(term));
  return modalityMatches || textMatches;
}

function laboratoryStatusLabel(status) {
  const labels = { ordered: "Aguardando coleta", collected: "Coletado", processing: "Em analise", validated: "Validado", released: "Liberado" };
  return labels[status] ?? status ?? "Aguardando coleta";
}

function laboratoryStatusActions(order) {
  if (order.status === "ordered") return [{ status: "collected", label: "Registrar coleta" }];
  if (order.status === "collected") return [{ status: "processing", label: "Processar" }];
  if (order.status === "processing") return [{ status: "validated", label: "Validar" }];
  if (order.status === "validated") return [{ status: "released", label: "Liberar" }];
  return [];
}

function emergencyStageValue(appointment) {
  return appointment.emergencyStage ?? "triage_waiting";
}

function emergencyStageLabel(stage) {
  const labels = {
    triage_waiting: "Aguardando triagem",
    triage_started: "Em triagem",
    triaged: "Triado",
    in_care: "Em atendimento",
    referred_exam: "Encaminhado para exame",
    referred_lab: "Encaminhado para laboratório",
    completed: "Finalizado"
  };
  return labels[stage] ?? labels.triage_waiting;
}

function emergencyStageWeight(stage) {
  const weights = { triage_waiting: 1, triage_started: 2, triaged: 3, in_care: 4, referred_exam: 5, referred_lab: 5, completed: 6 };
  return weights[stage] ?? 1;
}

function emergencyStageActions(appointment) {
  const stage = emergencyStageValue(appointment);
  if (stage === "triage_waiting") return [{ stage: "triage_started", label: "Triagem" }];
  if (stage === "triage_started") return [{ stage: "triaged", label: "Triado" }];
  if (stage === "triaged") return [{ stage: "in_care", label: "Atender" }];
  if (stage === "in_care") return [{ stage: "referred_exam", label: "Exame" }, { stage: "completed", label: "Finalizar" }];
  if (stage === "referred_exam" || stage === "referred_lab") return [{ stage: "in_care", label: "Retornar" }, { stage: "completed", label: "Finalizar" }];
  return [];
}

function emergencyStagePatch(stage) {
  const now = new Date().toISOString();
  const patch = { emergencyStage: stage };
  if (stage === "triage_started") return { ...patch, status: "checked_in", triageStartedAt: now };
  if (stage === "triaged") return { ...patch, status: "checked_in", triagedAt: now };
  if (stage === "in_care") return { ...patch, status: "in_attendance", careStartedAt: now };
  if (stage === "referred_exam") return { ...patch, status: "in_attendance", referredAt: now };
  if (stage === "referred_lab") return { ...patch, status: "in_attendance", referredAt: now };
  if (stage === "completed") return { ...patch, status: "completed", completedAt: now };
  return patch;
}

function totemPriorityLabel(priority) {
  const labels = { normal: "Normal", preferential: "Preferencial", elderly: "Idoso", emergency: "Emergencia" };
  return labels[priority] ?? priority;
}

function totemStatusLabel(status) {
  const labels = { waiting: "Aguardando", called: "Chamado", completed: "Finalizado", no_show: "Ausente", cancelled: "Cancelado" };
  return labels[status] ?? status;
}

function totemAuditLabel(action) {
  const labels = {
    "totem.ticket_issued": "senha emitida",
    "totem.ticket_called": "senha chamada",
    "totem.ticket_completed": "atendimento finalizado",
    "totem.ticket_no_show": "paciente ausente",
    "totem.ticket_cancelled": "senha cancelada",
    "totem.display_config_updated": "display atualizado"
  };
  return labels[action] ?? action;
}

function renderTotemDisplayMedia(config) {
  if ((config.contentType ?? "online") === "none" || !config.contentUrl) {
    return `<div class="display-media-placeholder">
      <strong>${escapeHtml(config.contentTitle ?? "Conteúdo do display")}</strong>
      <span>Sem mídia configurada</span>
    </div>`;
  }

  const embedUrl = toEmbedUrl(config.contentUrl);
  return `
    <div class="display-media-header">${escapeHtml(config.contentTitle ?? "Conteúdo online")}</div>
    <iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(config.contentTitle ?? "Conteúdo online")}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
  `;
}

function toEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}`;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}`;
    }
    return parsed.toString();
  } catch {
    return "about:blank";
  }
}

function sortTotemTicketsClient(a, b) {
  const priorityDiff = Number(b.priorityWeight ?? 0) - Number(a.priorityWeight ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

function csv(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

// normalize() importada de @clinic/shared \u2014 ver packages/shared/src/index.ts

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setDefaultAppointmentTimes() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  els.appointmentForm.elements.startsAt.value = toLocalDateTime(start);
  els.appointmentForm.elements.endsAt.value = toLocalDateTime(end);
}

function toLocalDateTime(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

setDefaultAppointmentTimes();
