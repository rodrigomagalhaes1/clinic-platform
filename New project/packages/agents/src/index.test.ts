import { describe, it, expect } from "vitest";
import { initialAgents } from "./index.js";
import type { AgentDefinition, AgentRiskLevel } from "./index.js";

describe("initialAgents", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(initialAgents)).toBe(true);
    expect(initialAgents.length).toBeGreaterThan(0);
  });

  it("every agent has required fields", () => {
    for (const agent of initialAgents) {
      expect(typeof agent.id).toBe("string");
      expect(agent.id.length).toBeGreaterThan(0);
      expect(typeof agent.name).toBe("string");
      expect(agent.name.length).toBeGreaterThan(0);
      expect(typeof agent.purpose).toBe("string");
      expect(agent.purpose.length).toBeGreaterThan(0);
      expect(Array.isArray(agent.tools)).toBe(true);
    }
  });

  it("agent ids are unique", () => {
    const ids = initialAgents.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every tool has a valid risk level", () => {
    const validLevels: AgentRiskLevel[] = ["low", "medium", "high"];
    for (const agent of initialAgents) {
      for (const tool of agent.tools) {
        expect(validLevels).toContain(tool.riskLevel);
      }
    }
  });

  it("every tool has non-empty name and description", () => {
    for (const agent of initialAgents) {
      for (const tool of agent.tools) {
        expect(typeof tool.name).toBe("string");
        expect(tool.name.length).toBeGreaterThan(0);
        expect(typeof tool.description).toBe("string");
        expect(tool.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("tools with high risk level require human approval", () => {
    for (const agent of initialAgents) {
      for (const tool of agent.tools) {
        if (tool.riskLevel === "high") {
          expect(tool.requiresHumanApproval).toBe(true);
        }
      }
    }
  });

  it("tools with low risk level do not require human approval", () => {
    for (const agent of initialAgents) {
      for (const tool of agent.tools) {
        if (tool.riskLevel === "low") {
          expect(tool.requiresHumanApproval).toBe(false);
        }
      }
    }
  });

  it("every tool declares at least one read scope", () => {
    for (const agent of initialAgents) {
      for (const tool of agent.tools) {
        expect(Array.isArray(tool.allowedReadScopes)).toBe(true);
        expect(tool.allowedReadScopes.length).toBeGreaterThan(0);
      }
    }
  });

  describe("appointment-confirmation agent", () => {
    const agent = initialAgents.find((a) => a.id === "appointment-confirmation") as AgentDefinition;

    it("exists", () => {
      expect(agent).toBeDefined();
    });

    it("has medium-risk confirmation tool that does not require approval", () => {
      const tool = agent.tools.find((t) => t.name === "sendAppointmentConfirmation");
      expect(tool).toBeDefined();
      expect(tool?.riskLevel).toBe("medium");
      expect(tool?.requiresHumanApproval).toBe(false);
    });
  });

  describe("collections-assistant agent", () => {
    const agent = initialAgents.find((a) => a.id === "collections-assistant") as AgentDefinition;

    it("exists", () => {
      expect(agent).toBeDefined();
    });

    it("collection tool is high risk and requires human approval", () => {
      const tool = agent.tools.find((t) => t.name === "sendCollectionMessage");
      expect(tool).toBeDefined();
      expect(tool?.riskLevel).toBe("high");
      expect(tool?.requiresHumanApproval).toBe(true);
    });
  });

  describe("pre-billing-review agent", () => {
    const agent = initialAgents.find((a) => a.id === "pre-billing-review") as AgentDefinition;

    it("exists", () => {
      expect(agent).toBeDefined();
    });

    it("billing review tool is low risk and does not require approval", () => {
      const tool = agent.tools.find((t) => t.name === "createBillingReviewTask");
      expect(tool).toBeDefined();
      expect(tool?.riskLevel).toBe("low");
      expect(tool?.requiresHumanApproval).toBe(false);
    });
  });
});
