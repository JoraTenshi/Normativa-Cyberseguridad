// Passwords belong to the browser's credential manager, never to app storage.
// Browsers without PasswordCredential may still offer their native form autofill.
export const canOfferPasswordSave = () =>
  typeof window !== 'undefined' &&
  typeof window.PasswordCredential === 'function' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.credentials?.store === 'function';

export const offerPasswordSave = ({ email, password }) => {
  if (!canOfferPasswordSave() || !email || !password) return false;
  try {
    const credential = new window.PasswordCredential({ id: email, password });
    // Browser prompt/denial is optional; authentication must never depend on it.
    Promise.resolve(navigator.credentials.store(credential)).catch(() => {});
    return true;
  } catch {
    return false;
  }
};
