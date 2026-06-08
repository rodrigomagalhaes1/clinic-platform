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
export declare const initialAgents: AgentDefinition[];
