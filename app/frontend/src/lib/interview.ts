/** Typed wrappers over the InterviewPrep backend APIs (via metagptx/web-sdk). */

import { client } from './api';
import type {
  Ability,
  GapResult,
  InterviewSession,
  JdResult,
  KnowledgeDoc,
  KnowledgePointView,
  Mark,
  SessionSummary,
} from './types';

// Chained AI steps run behind these endpoints, so allow a long request budget.
const AI_TIMEOUT = 600_000;

export function getErrorDetail(error: unknown): string {
  const anyError = error as {
    data?: { detail?: string };
    response?: { data?: { detail?: string } };
    message?: string;
  };
  return (
    anyError?.data?.detail ||
    anyError?.response?.data?.detail ||
    anyError?.message ||
    '请求失败，请稍后重试'
  );
}

export async function analyzeJd(data: {
  jd_text: string;
  company?: string;
  position?: string;
}): Promise<JdResult> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/analyze_jd',
    method: 'POST',
    data,
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as JdResult;
}

export async function analyzeGap(data: {
  jd_id: number;
  resume_text: string;
}): Promise<GapResult> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/analyze_gap',
    method: 'POST',
    data,
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as GapResult;
}

export async function startSession(data: {
  jd_id: number;
  gap_id?: number;
}): Promise<{ session_id: number; session: InterviewSession }> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/start_session',
    method: 'POST',
    data,
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as { session_id: number; session: InterviewSession };
}

export async function submitAnswer(data: {
  session_id: number;
  answer: string;
  user_ended?: boolean;
}): Promise<{ session: InterviewSession }> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/answer',
    method: 'POST',
    data,
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as { session: InterviewSession };
}

export async function generateReport(data: {
  session_id: number;
}): Promise<{ session: InterviewSession }> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/generate_report',
    method: 'POST',
    data,
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as { session: InterviewSession };
}

export async function listSessions(): Promise<{ items: SessionSummary[] }> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/sessions',
    method: 'GET',
    data: {},
  });
  return res.data as { items: SessionSummary[] };
}

export async function getSession(id: number): Promise<{ session: InterviewSession }> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/interview/session/${id}`,
    method: 'GET',
    data: {},
  });
  return res.data as { session: InterviewSession };
}

export async function deleteSession(id: number): Promise<void> {
  await client.apiCall.invoke({
    url: `/api/v1/interview/session/${id}`,
    method: 'DELETE',
    data: {},
  });
}

export async function updateJdAbilities(jdId: number, abilities: Ability[]): Promise<void> {
  await client.apiCall.invoke({
    url: '/api/v1/interview/update_abilities',
    method: 'POST',
    data: { jd_id: jdId, abilities },
  });
}

export async function listKnowledgePoints(keyword = ''): Promise<{
  items: KnowledgePointView[];
  total: number;
}> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/knowledge/points',
    method: 'GET',
    data: { keyword, limit: 200 },
  });
  return res.data as { items: KnowledgePointView[]; total: number };
}

export async function getKnowledgePoint(techId: number): Promise<{
  point: KnowledgePointView;
  related: { id: number; name: string; category: string }[];
  mark: Mark | null;
}> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/knowledge/point/${techId}`,
    method: 'GET',
    data: {},
  });
  return res.data as {
    point: KnowledgePointView;
    related: { id: number; name: string; category: string }[];
    mark: Mark | null;
  };
}

export async function generateKnowledgeDoc(
  techId: number,
  regenerate = false,
): Promise<{ tech_id: number; doc: KnowledgeDoc; version: number }> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/knowledge/point/${techId}/doc${regenerate ? '?regenerate=true' : ''}`,
    method: 'POST',
    data: {},
    options: { timeout: AI_TIMEOUT },
  });
  return res.data as { tech_id: number; doc: KnowledgeDoc; version: number };
}

export async function upsertKnowledgeMark(data: {
  tech_id: number;
  tech_name?: string;
  mastery?: string;
  favorited?: boolean;
  personal_notes?: string;
}): Promise<{ mark: Mark }> {
  const res = await client.apiCall.invoke({
    url: '/api/v1/knowledge/mark',
    method: 'POST',
    data,
  });
  return res.data as { mark: Mark };
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromFile(file: File, kind: 'jd' | 'resume'): Promise<string> {
  const dataUri = await fileToDataUri(file);
  const res = await client.apiCall.invoke({
    url: '/api/v1/interview/extract_text',
    method: 'POST',
    data: { file: dataUri, kind },
    options: { timeout: 600_000 },
  });
  return (res.data as { text: string }).text;
}
