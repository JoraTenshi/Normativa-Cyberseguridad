// Passwords belong to the browser's credential manager, never to app storage.
// Browsers without PasswordCredential may still offer their native form autofill.
export const canOfferPasswordSave = () =>
  typeof window !== 'undefined' &&
  typeof window.PasswordCredential === 'function' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.credentials?.store === 'function';

export const canChooseSavedPassword = () =>
  typeof window !== 'undefined' &&
  typeof window.PasswordCredential === 'function' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.credentials?.get === 'function';

export const chooseSavedPassword = async () => {
  if (!canChooseSavedPassword()) return null;
  try {
    // A user gesture opens the browser's account chooser; never sign in silently.
    const credential = await navigator.credentials.get({ password: true, mediation: 'required' });
    if (credential?.type !== 'password' || !credential.id || !credential.password) return null;
    return { email: credential.id, password: credential.password };
  } catch {
    return null;
  }
};

export const offerPasswordSave = async ({ email, password }) => {
  if (!canOfferPasswordSave() || !email || !password) return false;
  try {
    const credential = new window.PasswordCredential({ id: email, password });
    // A browser refusal must not invalidate an otherwise successful login.
    await navigator.credentials.store(credential);
    return true;
  } catch {
    return false;
  }
};
