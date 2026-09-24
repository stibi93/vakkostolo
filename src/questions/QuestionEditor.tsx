import { newRequestId } from '../schedule/model';
import type { HostQuestion } from './model';
export function QuestionEditor({ questions, onChange }: {questions: HostQuestion[]; onChange: (questions: HostQuestion[])=>void}) {
  const patch = (id:string, update: Partial<HostQuestion>) => onChange(questions.map(q=>q.id===id?{...q,...update}:q));
  function add(prompt: string, labels: string[]) {
    onChange([...questions,{id:newRequestId(),prompt,options:labels.map(label=>({id:newRequestId(),label})),correctOptionId:''}]);
  }
  return <section className="question-editor" aria-label="Egyedi kérdések">
    <h4>Egyedi kérdések <span className="small-note">{questions.length}/5</span></h4>
    <p className="small-note">Választható kiegészítés. Kérdésenként egy helyes válasz; a találat a felfedésnél látszik, versenypontot nem ad.</p>
    {questions.map((q,i)=><fieldset className="custom-question" key={q.id}>
      <legend>{i+1}. kérdés</legend>
      <div className="question-fields">
      <label>Kérdés szövege<input required maxLength={200} value={q.prompt} onChange={e=>patch(q.id,{prompt:e.target.value})} /></label>
      {q.options.map((o,j)=><div className="question-option" key={o.id}>
        <label>{j+1}. válaszlehetőség<input required maxLength={100} value={o.label} onChange={e=>patch(q.id,{options:q.options.map(x=>x.id===o.id?{...x,label:e.target.value}:x)})}/></label>
        <button type="button" className="button-secondary" disabled={q.options.length<=2} aria-label={`${j+1}. válaszlehetőség törlése`} onClick={()=>patch(q.id,{options:q.options.filter(x=>x.id!==o.id),correctOptionId:q.correctOptionId===o.id?'':q.correctOptionId})}>Törlés</button>
      </div>)}
      <button type="button" className="button-secondary" disabled={q.options.length>=6} onClick={()=>patch(q.id,{options:[...q.options,{id:newRequestId(),label:''}]})}>Válaszlehetőség hozzáadása</button>
      <label>Helyes válasz (felfedésig titkos)<select required value={q.correctOptionId} onChange={e=>patch(q.id,{correctOptionId:e.target.value})}>
        <option value="">Válaszd ki a helyes választ</option>{q.options.map((o,j)=><option key={o.id} value={o.id}>{o.label || `${j+1}. válaszlehetőség`}</option>)}
      </select></label>
      <button type="button" className="button-secondary" onClick={()=>onChange(questions.filter(x=>x.id!==q.id))}>Kérdés törlése</button>
      </div>
    </fieldset>)}
    <div className="schedule-actions">
      <button type="button" className="button-secondary" disabled={questions.length>=5} onClick={()=>add('Melyik szőlőfajtából készült a bor?',['Furmint','Olaszrizling','Chardonnay'])}>Szőlőfajta-kérdés</button>
      <button type="button" className="button-secondary" disabled={questions.length>=5} onClick={()=>add('Melyik országból származik a bor?',['Magyarország','Olaszország','Franciaország'])}>Országkérdés</button>
      <button type="button" className="button-secondary" disabled={questions.length>=5} onClick={()=>add('',['',''])}>Saját kérdés</button>
    </div>
  </section>;
}
