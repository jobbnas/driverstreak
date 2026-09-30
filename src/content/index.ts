import type { Category, Question, Sign } from '@/types';
import rawSigns from '../../content/signs/signs.json';

export const signs: Sign[] = rawSigns as Sign[];
export const quizzableSigns: Sign[] = signs.filter((s) => s.quizzable && s.files.length > 0);
export const signByCode: ReadonlyMap<string, Sign> = new Map(signs.map((s) => [s.code, s]));

export function signUrl(file: string): string {
  return `${import.meta.env.BASE_URL}signs/${file}`;
}

const questionModules = import.meta.glob<{ default: Question[] }>('../../content/questions/*.json');

let allQuestions: Question[] | undefined;
let loading: Promise<Question[]> | undefined;

/** Loads every question file once (lazy, cached). */
export function loadAllQuestions(): Promise<Question[]> {
  if (allQuestions) return Promise.resolve(allQuestions);
  if (!loading) {
    loading = Promise.all(Object.values(questionModules).map((load) => load())).then((mods) => {
      allQuestions = mods.flatMap((m) => m.default);
      return allQuestions;
    });
  }
  return loading;
}

export async function loadQuestions(category: Category): Promise<Question[]> {
  const all = await loadAllQuestions();
  return all.filter((q) => q.category === category);
}

export function questionById(id: string): Question | undefined {
  return allQuestions?.find((q) => q.id === id);
}

export function categoryOf(qid: string): Category | undefined {
  return questionById(qid)?.category;
}
