const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

// Types
export interface InterviewData {
  id: string;
  role: string;
  status: string;
  topics: { id: string; topic_name: string; order_index: number }[];
}

export interface BriefData {
  id: string;
  role: string;
  topics: string[];
  total_questions: number;
  estimated_duration: string;
  focus_areas: string[];
}

export interface QuestionData {
  id: string;
  question_text: string;
  topic: string;
  expected_points: string[];
  follow_ups: string[];
  hints: string[];
  order_index: number;
  time_estimate_seconds: number;
}

export interface InterviewQuestionsData {
  interview_id: string;
  role: string;
  topics: string[];
  questions: QuestionData[];
}

export interface ChatResponse {
  response: string;
  question_index: number;
  topic: string;
}

export interface TopicBreakdown {
  name: string;
  score: number;
  max_score: number;
  strengths: string[];
  improvements: string[];
}

export interface ReviewData {
  id: string;
  interview_id: string;
  overall_score: number;
  duration: string | null;
  role: string | null;
  topic_breakdown: TopicBreakdown[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  verdict: string;
  created_at: string;
}
