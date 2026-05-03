export interface PulseContextResult {
  schema_version: 'pulse.context.v1';
  query: string;
  mode_used: string;
  scope: string;
  facts: Array<{ id: number; text: string; provenance?: string }>;
  emotional_anchors: Array<{ event_id: number; summary: string }>;
  events: unknown[];
  entities: unknown[];
  relations: unknown[];
  forbidden: unknown[];
  private: unknown[];
  uncertainty: unknown[];
  importance_questions: Array<{ id: number; question_text: string; state: string }>;
  trace?: unknown;
}
