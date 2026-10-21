// Separate schema: v1 declarations must never become evidence of practice.
export const PRACTICE_IDS = ['company', 'services', 'documents', 'task', 'document-detail', 'activity'];
const fields = ['seen', 'practiced', 'empty', 'understood', 'skipped'];
export const practiceKey = id => typeof id === 'string' && id.length > 0 && id.length <= 200
  ? 'normativacheck-first-steps-v2:' + encodeURIComponent(id) : null;
export const emptyPractice = () => ({ version:2, steps:{}, lastStep:null });
export function parsePractice(raw) {
  if (typeof raw !== 'string' || raw.length > 5000) throw Error('invalid practice');
  const value = JSON.parse(raw);
  if (!value || value.version !== 2 || !value.steps || Array.isArray(value.steps) || typeof value.steps !== 'object' ||
      Object.keys(value).some(k => !['version','steps','lastStep'].includes(k)) ||
      (value.lastStep !== null && !PRACTICE_IDS.includes(value.lastStep)) ||
      Object.entries(value.steps).some(([id, flags]) => !PRACTICE_IDS.includes(id) || !flags || Array.isArray(flags) || typeof flags !== 'object' ||
        Object.entries(flags).some(([key, val]) => !fields.includes(key) || val !== true))) throw Error('invalid practice');
  return value;
}
export function readPractice(id) {
  try { const key = practiceKey(id); if (!key) throw Error(); const raw = localStorage.getItem(key);
    return {value:raw === null ? emptyPractice() : parsePractice(raw), persistent:true};
  } catch { return {value:emptyPractice(), persistent:false}; }
}
export function savePractice(id, value) {
  try { const key = practiceKey(id); if (!key) return false;
    localStorage.setItem(key, JSON.stringify(parsePractice(JSON.stringify(value)))); return true;
  } catch { return false; }
}
