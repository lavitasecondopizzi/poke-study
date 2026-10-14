import { callAcademyService } from "./community";

export interface AcademyLesson {
  lesson_code: string;
  grade_number: number;
  subject_code: string;
  order_index: number;
  title: string;
  summary: string;
  objectives: string[];
  content?: Array<{ title: string; body: string }>;
  version: number;
  subject?: { subject_code: string; title: string; description: string } | null;
}

export interface AcademyAttemptSummary {
  id: string;
  lesson_code: string | null;
  attempt_kind: "lesson" | "grade_exam";
  grade_number?: number;
  status: "started" | "submitted";
  score: number | null;
  passed: boolean | null;
  correct_count: number | null;
  question_count: number;
  created_at: string;
  submitted_at: string | null;
}

export interface AcademyQuestion {
  questionId: string;
  version: number;
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: Array<{ id: string; label: string }>;
  difficulty: "facile" | "media" | "difficile";
}

export interface AcademyQuestionReview extends AcademyQuestion {
  selectedAnswer: string | boolean | null;
  correctAnswer: string | boolean;
  isCorrect: boolean;
  explanation: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface AcademyAttemptResult {
  attemptId: string;
  score: number;
  correctCount: number;
  questionCount: number;
  passed: boolean;
  submittedAt: string;
  review: AcademyQuestionReview[];
}

export async function loadAcademyCurriculum() {
  return callAcademyService<{ lessons: AcademyLesson[]; attempts: AcademyAttemptSummary[] }>("get_curriculum");
}

export async function loadAcademyLesson(lessonCode: string) {
  return callAcademyService<{ lesson: AcademyLesson; attempts: AcademyAttemptSummary[] }>("get_lesson", { lessonCode });
}

export async function startAcademyAttempt(lessonCode: string, clientAttemptKey: string) {
  return callAcademyService<{ attemptId: string; questions: AcademyQuestion[]; questionCount: number }>(
    "start_attempt",
    { lessonCode, clientAttemptKey },
  );
}

export async function startAcademyGradeExam(clientAttemptKey: string) {
  return callAcademyService<{ attemptId: string; questions: AcademyQuestion[]; questionCount: number }>(
    "start_grade_exam",
    { clientAttemptKey },
  );
}

export async function submitAcademyAttempt(attemptId: string, answers: Array<{ questionId: string; answer: string }>) {
  return callAcademyService<AcademyAttemptResult>("submit_attempt", { attemptId, answers });
}
