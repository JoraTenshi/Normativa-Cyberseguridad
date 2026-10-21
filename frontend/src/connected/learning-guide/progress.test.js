import { emptyProgress, parseProgress, readProgress, setStep, storageKey, writeProgress } from './progress';
const storage = () => { const values = new Map(); return {getItem:jest.fn(k => values.get(k) ?? null), setItem:jest.fn((k,v) => values.set(k,v))}; };
test('only static IDs and declared learning states are persisted, not account or organization data', () => {
  const mem = storage(), progress = setStep(emptyProgress(), 'documents.locate', 'understood');
  expect(writeProgress('account-A', progress, mem)).toBe(true);
  expect(readProgress('account-A', mem).value).toEqual(progress);
  expect(mem.setItem.mock.calls[0][1]).not.toMatch(/account-A|organizacion|email|token|borrador/);
  expect(readProgress('account-B', mem).value).toEqual(emptyProgress());
});
test.each([null, '', undefined, 123, 'x'.repeat(201)])('identity %s cannot read or persist progress', identity => {
  const mem = storage();
  expect(storageKey(identity)).toBeNull();
  expect(readProgress(identity, mem).persistent).toBe(false);
  expect(writeProgress(identity, emptyProgress(), mem)).toBe(false);
  expect(mem.getItem).not.toHaveBeenCalled(); expect(mem.setItem).not.toHaveBeenCalled();
});
test.each([
  'not-json', 'null', '[]', '{"version":99,"steps":{},"lastStep":null}',
  '{"version":1,"steps":{"unknown":"understood"},"lastStep":null}',
  '{"version":1,"steps":{"documents.locate":"certified"},"lastStep":null}',
  '{"version":1,"steps":{},"lastStep":"unknown"}',
  '{"version":1,"steps":{},"lastStep":null,"token":"secret"}',
  '{"version":1,"steps":{"__proto__":"understood"},"lastStep":null}',
  '{"version":1,"steps":[],"lastStep":null}', 'x'.repeat(12001)
])('invalid/oversize record is discarded safely: %#', raw => {
  expect(() => parseProgress(raw)).toThrow();
  expect(readProgress('a', {getItem:() => raw})).toEqual({value:emptyProgress(),persistent:false});
});
test('storage denied or quota exceeded preserves in-memory progress capability', () => {
  const denied = {getItem:() => {throw Error('denied');}, setItem:() => {throw Error('quota');}};
  const read = readProgress('a', denied);
  const changed = setStep(read.value, 'overview.locate', 'understood');
  expect(writeProgress('a', changed, denied)).toBe(false);
  expect(changed.steps['overview.locate']).toBe('understood');
});
test('visiting never completes an objective; skipping and declaring remain distinct', () => {
  let progress = setStep(emptyProgress(), 'overview.locate', 'visited');
  expect(progress.steps['overview.locate']).toBe('visited');
  progress = setStep(progress, 'overview.locate', 'understood');
  expect(setStep(progress, 'overview.locate', 'visited').steps['overview.locate']).toBe('understood');
  expect(setStep(progress, 'overview.locate', 'skipped').steps['overview.locate']).toBe('skipped');
  expect(setStep(progress, 'business-id', 'understood')).toBe(progress);
});
