import { canOfferPasswordSave, offerPasswordSave } from './browserPasswordManager';

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
  expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).toBe(false);
});

test('offers only a nonempty credential to the browser password manager', async () => {
  const store = jest.fn().mockResolvedValue(undefined);
  const PasswordCredential = jest.fn().mockImplementation(data => data);
  Object.defineProperty(window, 'PasswordCredential', { configurable: true, value: PasswordCredential });
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { store } });

  expect(canOfferPasswordSave()).toBe(true);
  expect(offerPasswordSave({ email: 'qa@example.invalid', password: '' })).toBe(false);
  expect(store).not.toHaveBeenCalled();
  expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).toBe(true);
  expect(PasswordCredential).toHaveBeenCalledWith({ id: 'qa@example.invalid', password: 'ExamplePass1' });
  expect(store).toHaveBeenCalledWith({ id: 'qa@example.invalid', password: 'ExamplePass1' });
  await Promise.resolve();
});

test('browser refusal cannot turn a valid login into an error', async () => {
  const store = jest.fn().mockRejectedValue(new Error('User declined'));
  Object.defineProperty(window, 'PasswordCredential', { configurable: true, value: jest.fn().mockImplementation(data => data) });
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { store } });
  expect(offerPasswordSave({ email: 'qa@example.invalid', password: 'ExamplePass1' })).toBe(true);
  await Promise.resolve();
});
