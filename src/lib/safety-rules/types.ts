export type AlertSeverity = "HIGH" | "CRITICAL";

export interface SafetyAlert {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  sourceIds: string[];
  rationale?: string;
  programme?: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  condition: string;
  threshold: string;
  rationale: string;
  reference: string;
  programme: string;
  status: "DRAFT" | "ACTIVE";
}

