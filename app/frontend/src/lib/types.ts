/** Shared data contract for the InterviewPrep workflow. */

export type Priority = 'P0' | 'P1' | 'P2';

export interface KnowledgeTag {
  id: number;
  name: string;
  category: string;
  definition: string;
  key_points: string[];
  common_exam_points: string[];
  related_technologies: string[];
  is_new: boolean;
  feedback_count?: number;
  version?: number;
  mark?: Mark | null;
}

export interface Ability {
  id: string;
  name: string;
  category: string;
  exam_method: string;
  priority: Priority | string;
  jd_reference: string;
  technologies: string[];
  knowledge_refs: number[];
}

export interface Gap {
  ability_id: string;
  ability_name?: string;
  category?: string;
  priority?: string;
  status: 'gap' | 'partial' | 'covered' | string;
  resume_evidence: string;
  coverage_score: number;
  suggestion: string;
}

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface Feedback {
  good: string;
  weak: string;
  improvement: string;
}

export interface DialogueMessage {
  role: 'interviewer' | 'user';
  type?: 'question' | 'answer' | 'feedback' | 'system';
  ability_id?: string;
  content?: string;
  focus?: string;
  feedback?: Feedback;
  score?: number;
  decision?: string;
  end_reason?: string;
  tool_calls?: ToolCall[];
}

export interface QuestionReview {
  ability_name: string;
  score: number;
  good: string;
  weak: string;
  improvement: string;
}

export interface TopGap {
  ability_name: string;
  reason: string;
  advice: string;
}

export interface Report {
  overall_score: number;
  summary: string;
  highlights: string[];
  question_reviews: QuestionReview[];
  top_gaps: TopGap[];
  dimension_scores: Record<string, number>;
  questions_answered: number;
  radar: { dimension: string; score: number }[];
}

export interface InterviewSession {
  id: number;
  jd_id: number;
  gap_id?: number | null;
  company: string;
  position: string;
  abilities: Ability[];
  gaps: Gap[];
  abilities_examined: string[];
  abilities_remaining: string[];
  current_ability_id?: string | null;
  dialogue: DialogueMessage[];
  round_count: number;
  status: string;
  report?: Report | null;
}

export interface JdResult {
  jd_id: number;
  company: string;
  position: string;
  summary: string;
  abilities: Ability[];
  knowledge_tags: KnowledgeTag[];
}

export interface GapResult {
  gap_id: number;
  jd_id: number;
  gaps: Gap[];
  summary: string;
}

export interface Mark {
  id: number;
  tech_id: number;
  tech_name: string;
  mastery: string;
  favorited: boolean;
  personal_notes: string;
}

export interface KnowledgePointView extends KnowledgeTag {
  feedback_count: number;
  version: number;
  mark?: Mark | null;
}

export interface SessionSummary {
  id: number;
  company: string;
  position: string;
  round_count: number;
  status: string;
  overall_score: number | null;
  created_at: string | null;
}

export interface StageKey {
  key: 'jd' | 'gap' | 'interview' | 'report';
}
