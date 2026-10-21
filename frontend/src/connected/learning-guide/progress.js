import { GUIDE_VERSION, STEP_IDS } from './catalog';

const PREFIX = 'normativacheck-learning-v1:';
const STATES = new Set(['visited', 'understood', 'skipped']);
export const emptyProgress = () => ({ version:GUIDE_VERSION, steps:{}, lastStep:null });
export function storageKey(userId) {
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 200
    ? PREFIX + encodeURIComponent(userId) : null;
}
export function parseProgress(raw) {
  if (typeof raw !== 'string' || raw.length > 12000) throw new Error('invalid progress');
  const value = JSON.parse(raw);
  if (!value || value.version !== GUIDE_VERSION || !value.steps || typeof value.steps !== 'object' || Array.isArray(value.steps) ||
    Object.keys(value).some(key => !['version','steps','lastStep'].includes(key)) ||
    Object.keys(value.steps).length > STEP_IDS.size ||
    Object.entries(value.steps).some(([id, status]) => !STEP_IDS.has(id) || !STATES.has(status)) ||
    (value.lastStep !== null && !STEP_IDS.has(value.lastStep))) throw new Error('invalid progress');
  return { version:GUIDE_VERSION, steps:{...value.steps}, lastStep:value.lastStep };
}
export function readProgress(userId, storage) {
  const key = storageKey(userId);
  if (!key) return { value:emptyProgress(), persistent:false };
  try {
    const raw = (storage || window.localStorage).getItem(key);
    return { value:raw === null ? emptyProgress() : parseProgress(raw), persistent:true };
  } catch { return { value:emptyProgress(), persistent:false }; }
}
export function writeProgress(userId, value, storage) {
  const key = storageKey(userId);
  if (!key) return false;
  try {
    const safe = parseProgress(JSON.stringify(value));
    (storage || window.localStorage).setItem(key, JSON.stringify(safe));
    return true;
  } catch { return false; }
}
export function setStep(progress, id, status) {
  if (!STEP_IDS.has(id) || !STATES.has(status)) return progress;
  // Revisiting an understood step must not silently erase the declaration.
  const existing = progress.steps[id];
  return { version:GUIDE_VERSION, lastStep:id, steps:{ ...progress.steps,
    [id]:status === 'visited' && existing ? existing : status } };
}
