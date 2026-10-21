import { CHAPTERS, WORKSPACE_SECTIONS, STEP_IDS, canLearnSection, chaptersFor, hasArrived } from './catalog';

test('all thirteen real sections have exactly one chapter and stable unique objectives', () => {
  expect(Object.keys(WORKSPACE_SECTIONS)).toHaveLength(13);
  expect(CHAPTERS.filter(ch => ch.section).map(ch => ch.section)).toEqual(Object.keys(WORKSPACE_SECTIONS));
  const ids = CHAPTERS.flatMap(ch => ch.steps.map(s => s.id));
  expect(STEP_IDS.size).toBe(ids.length);
  expect(new Set(CHAPTERS.map(ch => ch.id)).size).toBe(CHAPTERS.length);
  CHAPTERS.forEach(ch => ch.steps.forEach(step => {
    expect(step.text.length).toBeGreaterThan(40);
    expect(step.goal.length).toBeGreaterThan(30);
    expect(['heading','content']).toContain(step.target);
  }));
});
test.each(['colaborador','consulta'])('%s has exactly four workspace chapters, not administrator permissions', role => {
  const chapters = chaptersFor({ kind:'workspace', ready:true, role });
  expect(chapters.filter(ch => ch.section).map(ch => ch.id)).toEqual(['overview','documents','activity','spaces']);
  expect(chapters.map(ch => ch.id)).not.toContain('review');
});
test('administrator has thirteen sections but is not a platform reviewer', () => {
  const chapters = chaptersFor({ kind:'workspace', ready:true, role:'administrador' });
  expect(chapters.filter(ch => ch.section)).toHaveLength(13);
  expect(chapters.find(ch => ch.id === 'review')).toBeUndefined();
});
test.each(['unknown', undefined, 'ADMIN', '__proto__'])('unknown role %s grants no workspace chapters', role => {
  expect(chaptersFor({ kind:'workspace', ready:true, role }).filter(ch => ch.section)).toHaveLength(0);
  expect(canLearnSection('__proto__', role)).toBe(false);
});
test('unverified surface offers no chapters, ready account offers entry and auxiliary routes', () => {
  expect(chaptersFor({ ready:false })).toEqual([]);
  expect(chaptersFor(null)).toEqual([]);
  expect(chaptersFor({ ready:true, kind:'route', chapter:'account' }).map(ch => ch.id)).toEqual(['entry','account','requests','history']);
});
test.each(['review','result','plan'])('contextual %s chapter requires a currently allowed surface', chapter => {
  expect(chaptersFor({ ready:true, chapter, allowed:false }).some(ch => ch.id === chapter)).toBe(false);
  expect(chaptersFor({ ready:true, chapter, allowed:true }).some(ch => ch.id === chapter)).toBe(true);
});
test('arrival requires exact permitted section, not just route or title', () => {
  const task = CHAPTERS.find(ch => ch.id === 'tasks');
  expect(hasArrived(task, {ready:true,kind:'workspace',section:'tasks',role:'consulta'})).toBe(false);
  expect(hasArrived(task, {ready:true,kind:'workspace',section:'overview',role:'administrador'})).toBe(false);
  expect(hasArrived(task, {ready:false,kind:'workspace',section:'tasks',role:'administrador'})).toBe(false);
  expect(hasArrived(task, {ready:true,kind:'workspace',section:'tasks',role:'administrador'})).toBe(true);
  expect(hasArrived(undefined, {ready:true})).toBe(false);
});
