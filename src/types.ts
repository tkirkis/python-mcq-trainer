export type ChapterId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

export interface Option {
  id: string;
  text: string;
  mono?: boolean;
}

export interface Question {
  id: string;
  chapter: ChapterId;
  topic: string;
  tags: string[];
  type: 'single' | 'multi';
  difficulty: 1 | 2 | 3;
  source: 'past_exam' | 'generated';
  stem: string;
  code: string | null;
  options: Option[];
  correct: string[];
  explanation: string;
  notes: Record<string, string>;
  slides: number[];
  verified: 'exec' | 'review' | 'no';
  quirk?: boolean;
  quirkNote?: string;
  reconstructed?: boolean;
  pastExam?: { page: number; ticked: string[]; tickedCorrect: boolean | null };
}

export interface Topic {
  id: string;
  title: string;
  desc: string;
}

export interface Chapter {
  id: ChapterId;
  title: string;
  slides: [number, number];
  topics: Topic[];
}

export interface Bank {
  version: string;
  generatedAt: string;
  chapters: Chapter[];
  questions: Question[];
}

export interface LessonSection {
  id: string;
  title: string;
  html: string;
}

export interface ChapterLesson {
  title: string;
  intro: string;
  sections: LessonSection[];
}

export type Lessons = Partial<Record<ChapterId, ChapterLesson>>;

// ------------------------------------------------------------------ events (append-only log)
export type Mode = 'learn' | 'practice' | 'review' | 'mock' | 'smart';
export type Confidence = 1 | 2 | 3; // guessed / unsure / sure
export type MockVariant = 'last_year' | 'full' | 'reference' | 'hard';

export interface ScoringSettings {
  correct: number;
  wrong: number;
  idk: number;
  multi: 'all' | 'partial';
}

interface EvBase {
  id: string;
  ts: number;
  dev: string;
}

export interface AnswerEv extends EvBase {
  t: 'ans';
  q: string;
  ch: string[];
  ok: boolean;
  idk?: boolean;
  ms: number;
  mode: Mode;
  conf?: Confidence;
  sid?: string;
}

export interface MockItem {
  q: string;
  ch: string[];
  ok: boolean;
  idk?: boolean;
  pts: number;
}

export interface MockEv extends EvBase {
  t: 'mock';
  mid: string;
  variant: MockVariant;
  score: number;
  max: number;
  ms: number;
  limit: number;
  started: number;
  items: MockItem[];
  scoring: ScoringSettings;
}

export interface SetEv extends EvBase {
  t: 'set';
  k: string;
  v: unknown;
}

export interface ViewEv extends EvBase {
  t: 'view';
  ch: string;
  topic?: string;
}

/** Progress reset marker: derived state ignores answers/mocks older than the latest reset. */
export interface ResetEv extends EvBase {
  t: 'reset';
}

export type Ev = AnswerEv | MockEv | SetEv | ViewEv | ResetEv;
export type EvInput =
  | Omit<AnswerEv, 'id' | 'ts' | 'dev'>
  | Omit<MockEv, 'id' | 'ts' | 'dev'>
  | Omit<SetEv, 'id' | 'ts' | 'dev'>
  | Omit<ViewEv, 'id' | 'ts' | 'dev'>
  | Omit<ResetEv, 'id' | 'ts' | 'dev'>;

export interface Settings {
  scoring: ScoringSettings;
  theme: 'system' | 'light' | 'dark';
  dailyGoal: number;
  confidence: boolean;
  mockMinutes: number;
  hardMinutes: number;
}
