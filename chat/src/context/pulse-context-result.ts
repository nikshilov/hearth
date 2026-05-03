export interface PulseContextItemBase {
  id?: number;
  kind?: string;
  score?: number;
  confidence?: number;
  provenance?: string;
  evidence_ids?: number[];
  source_scope?: string;
  privacy_floor?: string;
  do_not_probe?: boolean;
}

export interface PulseContextFact extends PulseContextItemBase {
  id: number;
  text: string;
}

export interface PulseContextEvent extends PulseContextItemBase {
  id: number;
  title: string;
  summary: string;
}

export interface PulseContextEntity extends PulseContextItemBase {
  id: number;
  canonical_name: string;
  summary: string;
}

export interface PulseContextRelation extends PulseContextItemBase {
  id: number;
  from_entity_id: number;
  to_entity_id: number;
  summary: string;
}

export interface PulseContextEmotionalAnchor extends PulseContextItemBase {
  event_id: number;
  summary: string;
}

export interface PulseContextRedaction {
  subject_kind: string;
  subject_id: number;
  reason: string;
  policy: string;
}

export interface PulseContextUncertainty {
  subject_kind: string;
  subject_id: number;
  question: string;
  confidence: number;
}

export interface PulseContextImportanceQuestion {
  id: number;
  question_text: string;
  state: string;
}

export interface PulseContextResult {
  schema_version: 'pulse.context.v1';
  query: string;
  mode_used: string;
  scope: string;
  facts: PulseContextFact[];
  emotional_anchors: PulseContextEmotionalAnchor[];
  events: PulseContextEvent[];
  entities: PulseContextEntity[];
  relations: PulseContextRelation[];
  forbidden: PulseContextRedaction[];
  private: PulseContextRedaction[];
  uncertainty: PulseContextUncertainty[];
  importance_questions: PulseContextImportanceQuestion[];
  trace?: unknown;
}
