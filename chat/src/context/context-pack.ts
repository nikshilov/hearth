export interface ContextPack {
  name: string;
  visibility: 'visible_to_model' | 'hidden_steering' | 'debug_only';
  budgetTokens: number;
  content: string;
  sources: string[];
}
