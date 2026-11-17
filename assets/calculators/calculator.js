(() => {
  'use strict';
  const {estimate, bakery, money, InputError} = globalThis.ProCalculators;
  const isBid = document.body.dataset.kind === 'bid';
  const field = id => document.getElementById(id);
  const ingredients = field('ingredients');
  const originalIngredients = ingredients ? ingredients.cloneNode(true) : null;
  const initialFields = Array.from(document.querySelectorAll('.calc-fields input'), input => [input.id,input.value]);
  const ingredientRows = () => [...document.querySelectorAll('[data-ingredient]')];
  const selectedCurrency = () => document.querySelector('input[name="currency"]:checked').value;

  function renumber() {
    const rows = ingredientRows();
    rows.forEach((row,index) => {
      row.querySelector('legend').textContent = 'Ingredient ' + (index+1);
      const remove = row.querySelector('[data-remove]');
      remove.disabled = rows.length === 1;
      remove.setAttribute('aria-label','Remove ingredient ' + (index+1));
      row.querySelector('[data-unit]').setAttribute('aria-label','Unit for ingredient ' + (index+1));
      row.querySelectorAll('[data-value]').forEach((input,i) => {
        input.id = `ingredient-${index}-${['price','size','used'][i]}`;
        const label = input.closest('label');
        label.htmlFor = input.id;
        label.firstElementChild.id = input.id+'-label';
        input.setAttribute('aria-labelledby', label.firstElementChild.id);
      });
    });
    field('add-ingredient').disabled = rows.length >= 25;
  }

  function display() {
    const currency = selectedCurrency();
    const format = value => money(value,currency);
    const enteredMoney = value => format(BigInt(Math.round(Number(value)*100)));
    document.querySelectorAll('[data-currency]').forEach(node => { node.textContent = currency; });
    document.querySelectorAll('[aria-invalid="true"]').forEach(input => {
      input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    });
    const problem = field('calc-error');
    const breakdown = document.querySelector('.calc-formula');
    const entries = Object.fromEntries(Array.from(document.querySelectorAll('.calc-fields input'),
      input => [input.id,input.value]));
    const rows = ingredientRows();
    entries.ingredients = rows.map(row => {
      const [price,size,used] = Array.from(row.querySelectorAll('[data-value]'),node => node.value);
      const unit = row.querySelector('[data-unit]').value;
      row.querySelectorAll('[data-unit-copy]').forEach(span => { span.textContent = unit; });
      return {name:row.querySelector('[data-name]').value,price,size,used,unit};
    });
    try {
      const result = isBid ? estimate(entries) : bakery(entries);
      document.querySelectorAll('[data-result]').forEach(node => {
        node.textContent = format(result[node.dataset.result]);
      });
      if (isBid) {
        field('formula').textContent = `${entries.hours} hours × ${enteredMoney(entries.rate)} + ${format(result.materials)} = ${format(result.subtotal)} before tax. At ${entries.tax || '0'}%, tax adds ${format(result.tax)}.`;
      } else {
        field('formula').textContent = `${format(result.batch)} ÷ ${entries.yield} pieces ÷ (1 − ${entries.margin}%) gives an asking price of ${format(result.price)}, rounded up to a whole cent.`;
        const details = entries.ingredients.map((row,index) => [
          `${row.name.trim() || 'Ingredient '+(index+1)} · ${enteredMoney(row.price)} × ${row.used} ÷ ${row.size} ${row.unit}`,
          result.rows[index]
        ]);
        details.push([`${entries.minutes} min ÷ 60 × ${enteredMoney(entries.rate)} per hour`, result.labor]);
        details.push([`${entries.yield} pieces × ${enteredMoney(entries.packaging)} packaging`, result.packagingTotal]);
        const lines = details.map(([description,value]) => {
          const line = document.createElement('div');
          const label = document.createElement('dt');
          const amount = document.createElement('dd');
          label.textContent = description; amount.textContent = format(value);
          line.append(label,amount); return line;
        });
        field('ingredient-costs').replaceChildren(...lines);
      }
      problem.hidden = true; problem.textContent = ''; breakdown.hidden = false;
    } catch (exception) {
      if (!(exception instanceof InputError)) throw exception;
      document.querySelectorAll('[data-result]').forEach(node => { node.textContent = '—'; });
      breakdown.hidden = true;
      problem.hidden = false; problem.textContent = exception.message;
      const invalid = field(exception.field);
      invalid.setAttribute('aria-invalid','true');
      invalid.setAttribute('aria-describedby', 'calc-error');
    }
  }

  const inputs = field('inputs');
  inputs.addEventListener('input',display);
  inputs.addEventListener('change',display);
  if (ingredients) {
    renumber();
    field('add-ingredient').addEventListener('click',() => {
      if (ingredientRows().length >= 25) return;
      ingredients.append(field('ingredient-template').content.cloneNode(true));
      renumber(); display(); ingredientRows().at(-1).querySelector('[data-name]').focus();
    });
    ingredients.addEventListener('click',event => {
      const remove = event.target.closest('[data-remove]');
      if (!remove || ingredientRows().length===1) return;
      const row = remove.closest('[data-ingredient]');
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); renumber(); display(); next.querySelector('[data-name]').focus();
    });
  }
  field('reset-example').addEventListener('click',() => {
    initialFields.forEach(([id,value]) => { field(id).value = value; });
    if (originalIngredients) {
      ingredients.replaceChildren(...Array.from(originalIngredients.children, row => row.cloneNode(true)));
      renumber();
    }
    display();
  });
  display();
})();
