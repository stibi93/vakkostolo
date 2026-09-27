export interface Question { id: string; prompt: string; options: { id: string; label: string }[] }
export interface HostQuestion extends Question { correctOptionId: string }
export interface QuestionResult extends Omit<HostQuestion, 'options'> {
  options: { id: string; label: string; count: number }[];
  ownOptionId: string | null;
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && Array.from(v).length <= max;
export function parseQuestions(value: unknown, host: true): HostQuestion[];
export function parseQuestions(value: unknown, host?: false): Question[];
export function parseQuestions(value: unknown, host = false): (Question | HostQuestion)[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) throw new Error('Érvénytelen kérdéslista.');
  const questions = value.map(q => {
    if (!q || !id(q.id) || !text(q.prompt,200) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error('Kérdésenként adj meg egy címet és 2–6 választ.');
    const options = q.options.map((o: {id:unknown;label:unknown}) => {
      if (!o || !id(o.id) || !text(o.label,100)) throw new Error('Minden válaszlehetőséget tölts ki (legfeljebb 100 karakter).');
      return {id:o.id,label:o.label};
    });
    if (new Set(options.map((o: {id:string})=>o.id)).size !== options.length || new Set(options.map((o: {label:string})=>o.label.trim().toLocaleLowerCase('hu'))).size !== options.length) throw new Error('A válaszlehetőségek különbözzenek.');
    if (host && !options.some((o: {id:string})=>o.id === q.correctOptionId)) throw new Error('Jelöld ki a helyes választ minden kérdésnél.');
    return {id:q.id,prompt:q.prompt,options,...(host?{correctOptionId:q.correctOptionId}:{})};
  });
  if (new Set(questions.map(q=>q.id)).size !== questions.length) throw new Error('Ismétlődő kérdésazonosító.');
  return questions;
}
export function parseAnswers(value: unknown): Record<string,string> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).length > 5 || Object.entries(value).some(([k,v])=>!id(k)||!id(v))) throw new Error('Érvénytelen egyedi válaszok.');
  return Object.fromEntries(Object.entries(value)) as Record<string,string>;
}
export function parseQuestionResults(value: unknown, role: 'player'|'host'): QuestionResult[] {
  const qs = parseQuestions(value,true);
  if (!Array.isArray(value)) throw new Error('Érvénytelen kérdéslista.');
  return qs.map((q,i)=>{
    const raw = value[i] as { ownOptionId?: unknown; options?: { count?: unknown }[] };
    const own = raw.ownOptionId ?? null;
    if (own !== null && (role !== 'player' || !q.options.some(o=>o.id===own))) throw new Error('Érvénytelen egyedi eredmény.');
    const options = q.options.map((option, j) => {
      const count = raw.options?.[j]?.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 50) throw new Error('Érvénytelen egyedi eredmény.');
      return { ...option, count };
    });
    return {...q, options, ownOptionId: own as string|null};
  });
}
