export type Category =
  | 'trafikregler'
  | 'trafiksakerhet'
  | 'fordon'
  | 'miljo'
  | 'personliga'
  | 'vagmarken';

export const CATEGORIES: Category[] = [
  'vagmarken',
  'trafikregler',
  'trafiksakerhet',
  'fordon',
  'miljo',
  'personliga',
];

export const CATEGORY_LABEL: Record<Category | 'blandat', string> = {
  vagmarken: 'Vägmärken',
  trafikregler: 'Trafikregler',
  trafiksakerhet: 'Trafiksäkerhet',
  fordon: 'Fordon & manövrering',
  miljo: 'Miljö',
  personliga: 'Personliga förutsättningar',
  blandat: 'Blandat',
};

export type Difficulty = 1 | 2 | 3;

export interface Question {
  id: string;
  category: Category;
  subtopic: string;
  difficulty: Difficulty;
  question: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
  signRefs?: string[];
  legalRef?: string;
  reviewed?: boolean;
}

export type SignCategory =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'M' | 'P' | 'S' | 'T' | 'X';

export const SIGN_CATEGORY_LABEL: Record<SignCategory, string> = {
  A: 'Varningsmärken',
  B: 'Väjningspliktsmärken',
  C: 'Förbudsmärken',
  D: 'Påbudsmärken',
  E: 'Anvisningsmärken',
  F: 'Lokaliseringsmärken',
  G: 'Lokaliseringsmärken',
  H: 'Serviceanläggningar',
  I: 'Turistmål',
  J: 'Upplysningsmärken',
  M: 'Vägmarkeringar',
  P: 'Polismans tecken',
  S: 'Symboler',
  T: 'Tilläggstavlor',
  X: 'Andra anordningar',
};

export interface Sign {
  code: string;
  name: string;
  category: SignCategory;
  explanation: string;
  files: string[];
  commons?: string[];
  group?: string;
  quizzable: boolean;
  aliases?: string[];
}

export type StreakVariant = 'name2img' | 'img2name' | 'text';
export type StreakCategory = Category | 'blandat';

export interface PromptOption {
  label: string;
  image?: string;
}

/** A fully prepared question shown in the streak game. */
export interface Prompt {
  qid: string;
  kind: 'sign' | 'text';
  variant: StreakVariant;
  title: string;
  image?: string;
  options: PromptOption[];
  correctIndex: number;
  durationMs: number;
  explanation?: string;
}

export interface AnswerLog {
  qid: string;
  ms: number;
  correct: boolean;
  points: number;
}

export interface GameRun {
  id: string;
  mode: 'streak';
  category: StreakCategory;
  variant: StreakVariant | 'mixed';
  startedAt: number;
  endedAt: number;
  score: number;
  bonus: number;
  correct: number;
  endedBy: 'wrong' | 'timeout' | 'quit';
  answers: AnswerLog[];
}

export interface ExamAnswer {
  qid: string;
  chosen: number | null;
  correct: boolean;
  flagged: boolean;
}

export interface ExamResult {
  id: string;
  startedAt: number;
  endedAt: number;
  passed: boolean;
  correct: number;
  total: number;
  perArea: Record<Category, { correct: number; total: number }>;
  answers: ExamAnswer[];
}

export interface QuestionStat {
  seen: number;
  correct: number;
  wrong: number;
  lastSeen: number;
  lastWrong?: number;
  box: 0 | 1 | 2 | 3 | 4;
}

export interface Settings {
  haptics: boolean;
  reducedMotion: 'auto' | 'on' | 'off';
  textTimerSec: number;
}

export interface Stats {
  version: 1;
  runs: GameRun[];
  exams: ExamResult[];
  questions: Record<string, QuestionStat>;
  daily: { current: number; longest: number; lastDay: string; days: string[] };
  recent: Partial<Record<string, string[]>>;
  settings: Settings;
}
