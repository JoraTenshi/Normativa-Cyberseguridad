const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// "Descargar PDF" (docs/decisiones-alcance.md): imprimir desde el navegador. El PDF real se generó y
// revisó con Chromium; estas comprobaciones evitan que una refactorización lo rompa sin avisar.
const leer = rel => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

test('el botón abre el diálogo de impresión y la nota impresa avisa de que no es una certificación', () => {
  const comp = leer('components/ImprimirPdf.jsx');
  assert.match(comp, /onClick=\{\(\) => window\.print\(\)\}/);
  assert.match(comp, />\s*Descargar PDF\s*</);
  assert.match(comp, /className="solo-impresion nota-impresion"/);
  assert.match(comp, /no es una certificación/);
});

for (const pagina of ['pages/Resultado.jsx', 'pages/PlanDirector.jsx']) {
  test(`${pagina} muestra el botón "Descargar PDF" y la nota de impresión`, () => {
    const src = leer(pagina);
    assert.match(src, /import \{ BotonDescargarPdf, NotaImpresion \} from '\.\.\/components\/ImprimirPdf';/);
    assert.match(src, /<BotonDescargarPdf \/>/);
    assert.match(src, /<NotaImpresion \/>/);
  });
}

test('el Plan Director despliega todas las fases antes de imprimir (también con Ctrl+P)', () => {
  const src = leer('pages/PlanDirector.jsx');
  assert.match(src, /import \{ flushSync \} from 'react-dom';/);
  assert.match(src, /flushSync\(\(\) => setExpandida\(true\)\)/);
  assert.match(src, /window\.addEventListener\('beforeprint', desplegar\)/);
  assert.match(src, /window\.removeEventListener\('beforeprint', desplegar\)/);
});

test('estilos de impresión: fondo claro, sin navegación ni botones, nota visible solo en papel', () => {
  const css = leer('App.css');
  assert.match(css, /^\.solo-impresion \{ display: none; \}$/m);
  const print = css.slice(css.indexOf('@media print {'));
  assert.ok(print.length > 20, 'falta @media print');
  for (const sel of ['.navbar', '.site-footer', '.cookie-banner', '.resultado-acciones', '.pds-back-row']) {
    assert.ok(print.includes(sel), `no se oculta ${sel}`);
  }
  assert.match(print, /body::before \{ display: none !important; \}/);
  assert.match(print, /--bg:\s+#FFFFFF;/);
  assert.match(print, /\.solo-impresion \{ display: block; \}/);
  assert.match(print, /break-inside: avoid;/);
});
