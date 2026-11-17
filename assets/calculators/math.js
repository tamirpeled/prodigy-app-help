/* Standalone arithmetic for the two public tools. All money outputs are integer cents. */
(() => {
  'use strict';
  class InputError extends Error {
    constructor(field, message) {
      super(message);
      this.field = field;
    }
  }
  function fixed(value, places, field, label, optional = false) {
    const text = String(value ?? '').trim();
    if (!text && optional) return 0n;
    const match = /^(\d{0,9})(?:\.(\d*))?$/.exec(text);
    if (!match || !(match[1] || match[2]) || (match[2] || '').length > places) {
      const precision = places ? `up to ${places} decimal places` : 'a whole number';
      throw new InputError(field, `Check ${label.toLowerCase()}. Enter a nonnegative value using ${precision}.`);
    }
    return BigInt(match[1] || '0') * 10n ** BigInt(places) + BigInt((match[2] || '').padEnd(places, '0') || '0');
  }
  const round = (numerator, denominator) => (numerator * 2n + denominator) / (2n * denominator);
  const ceiling = (numerator, denominator) => (numerator + denominator - 1n) / denominator;

  function estimate(inputs) {
    const hours = fixed(inputs.hours, 3, 'hours', 'Labor hours');
    const rate = fixed(inputs.rate, 2, 'rate', 'Hourly rate');
    const materials = fixed(inputs.materials, 2, 'materials', 'Materials');
    const taxRate = fixed(inputs.tax, 3, 'tax', 'Tax rate', true);
    if (taxRate > 100000n) throw new InputError('tax', 'Tax rate must be between 0% and 100%.');
    const labor = round(hours * rate, 1000n);
    const subtotal = labor + materials;
    const tax = round(subtotal * taxRate, 100000n);
    return { labor, materials, subtotal, tax, total: subtotal + tax };
  }

  function bakery(inputs) {
    const rows = inputs.ingredients.map((row, index) => {
      const field = (key) => 'ingredient-' + index + '-' + key;
      const packPrice = fixed(row.price, 2, field('price'), 'Pack price');
      const packSize = fixed(row.size, 3, field('size'), 'Pack size');
      const used = fixed(row.used, 3, field('used'), 'Amount used');
      if (!packSize) throw new InputError(field('size'), 'Pack size must be greater than zero.');
      return round(packPrice * used, packSize);
    });
    const minutes = fixed(inputs.minutes, 2, 'minutes', 'Hands-on minutes');
    const rate = fixed(inputs.rate, 2, 'rate', 'Hourly labor rate');
    const packaging = fixed(inputs.packaging, 2, 'packaging', 'Packaging per piece');
    const yieldCount = fixed(inputs.yield, 0, 'yield', 'Saleable pieces');
    if (!yieldCount) throw new InputError('yield', 'Enter at least one saleable piece.');
    const margin = fixed(inputs.margin, 2, 'margin', 'Target margin');
    if (margin >= 10000n) throw new InputError('margin', 'Target margin must be below 100%.');
    const ingredients = rows.reduce((sum, amount) => sum + amount, 0n);
    const labor = round(minutes * rate, 6000n);
    const packagingTotal = packaging * yieldCount;
    const batch = ingredients + labor + packagingTotal;
    const price = ceiling(batch * 10000n, yieldCount * (10000n - margin));
    return { rows, ingredients, labor, packagingTotal, batch, perPiece: round(batch, yieldCount), price };
  }

  function money(cents, currency) {
    const formatter = new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-US', {style:'currency', currency});
    return formatter.formatToParts(cents / 100n).map(part => part.type === 'fraction'
      ? (cents % 100n).toString().padStart(2, '0') : part.value).join('');
  }

  const api = { estimate, bakery, money, InputError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.ProCalculators = api;
})();
