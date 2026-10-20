import { canOfferPasswordSave, canChooseSavedPassword, chooseSavedPassword, offerPasswordSave } from './browserPasswordManager';

const originalConstructor = Object.getOwnPropertyDescriptor(window, 'PasswordCredential');
const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');

afterEach(() => {
  if (originalConstructor) Object.defineProperty(window, 'PasswordCredential', originalConstructor);
  else delete window.PasswordCredential;
  if (originalCredentials) Object.defineProperty(navigator, 'credentials', originalCredentials);
  else delete navigator.credentials;
});

test('never stores a password in app storage or calls an unsupported browser API', () => {
  delete window.PasswordCredential;
  expect(canOfferPasswordSave()).toBe(false);
  expect(canChooseSavedPassword()).toBe(false);
  return Promise.all([
    expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).resolves.toBe(false),
    expect(chooseSavedPassword()).resolves.toBeNull(),
  ]);
});

test('offers only a nonempty credential to the browser password manager', async () => {
  const store = jest.fn().mockResolvedValue(undefined);
  const PasswordCredential = jest.fn().mockImplementation(data => data);
  Object.defineProperty(window, 'PasswordCredential', { configurable: true, value: PasswordCredential });
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { store } });

  expect(canOfferPasswordSave()).toBe(true);
  await expect(offerPasswordSave({ email: 'qa@example.invalid', password: '' })).resolves.toBe(false);
  expect(store).not.toHaveBeenCalled();
  await expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).resolves.toBe(true);
  expect(PasswordCredential).toHaveBeenCalledWith({ id: 'qa@example.invalid', password: 'ExamplePass1' });
  expect(store).toHaveBeenCalledWith({ id: 'qa@example.invalid', password: 'ExamplePass1' });
});

test('browser refusal cannot turn a valid login into an error', async () => {
  const store = jest.fn().mockRejectedValue(new Error('User declined'));
  Object.defineProperty(window, 'PasswordCredential', { configurable: true, value: jest.fn().mockImplementation(data => data) });
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { store } });
  await expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).resolves.toBe(false);
});

test('a browser account chooser returns only password credentials, without signing in', async () => {
  const get = jest.fn().mockResolvedValue({ type: 'password', id: 'qa@example.invalid', password: 'ExamplePass1' });
  Object.defineProperty(window, 'PasswordCredential', { configurable: true, value: jest.fn() });
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get } });
  expect(canChooseSavedPassword()).toBe(true);
  await expect(chooseSavedPassword()).resolves.toEqual({ email: 'qa@example.invalid', password: 'ExamplePass1' });
  expect(get).toHaveBeenCalledWith({ password: true, mediation: 'required' });
  get.mockResolvedValueOnce({ type: 'public-key', id: 'other' }).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Denied'));
  await expect(chooseSavedPassword()).resolves.toBeNull();
  await expect(chooseSavedPassword()).resolves.toBeNull();
  await expect(chooseSavedPassword()).resolves.toBeNull();
});
