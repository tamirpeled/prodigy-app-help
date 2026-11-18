(() => {
  'use strict';
  const {market,lesson,turnover} = globalThis.ProPlanners;
  const {InputError} = globalThis.ProCalculators;
  const calculate={booth:market,tutor:lesson,turn:turnover}[document.body.dataset.kind];
  const inputs=[...document.querySelectorAll('[data-plan-input]')];
  const initial=new Map(inputs.map(input=>[input.id,input.value]));
  const panel=document.getElementById('result'), message=document.getElementById('calc-error');
  const resultFields=[...document.querySelectorAll('[data-result]')];
  function update() {
    const currency=document.querySelector('input[name=currency]:checked')?.value || 'USD';
    const entries=Object.fromEntries(inputs.map(input=>[input.id,input.value]));
    document.querySelectorAll('[data-currency]').forEach(node=>{node.textContent=currency;});
    for (const input of inputs) {input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}
    const formula=document.querySelector('.calc-formula');
    try {
      const result=calculate(entries,currency);
      for(const node of resultFields)node.textContent=node.dataset.result==='primary' ? result.primary : result.rows[node.dataset.result];
      document.getElementById('formula').textContent=result.formula;
      panel.dataset.state=result.state;
      formula.hidden=false;message.textContent='';message.hidden=true;
    } catch(error) {
      if(!(error instanceof InputError))throw error;
      for(const node of resultFields)node.textContent='—';
      const field=document.getElementById(error.field);
      field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','calc-error');
      panel.dataset.state='invalid';formula.hidden=true;message.hidden=false;message.textContent=error.message;
    }
  }
  const form=document.getElementById('inputs');
  form.addEventListener('input',update);form.addEventListener('change',update);
  document.getElementById('reset-example').addEventListener('click',()=>{
    for(const input of inputs)input.value=initial.get(input.id);
    update();
  });
  update();
})();
