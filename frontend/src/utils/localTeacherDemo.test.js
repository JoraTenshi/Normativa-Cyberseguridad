import { isLocalTeacherDemo } from './localTeacherDemo';

test('la interfaz docente se activa solo en el origen local fijado por el perfil', () => {
  expect(isLocalTeacherDemo('https://127.0.0.2:9445')).toBe(true);
  expect(isLocalTeacherDemo('https://10.77.77.1:8443')).toBe(false);
  expect(isLocalTeacherDemo('https://localhost:9445')).toBe(false);
});
