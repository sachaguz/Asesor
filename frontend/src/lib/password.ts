export const REGLAS_PASSWORD = 'Mínimo 8 caracteres, una mayúscula y un número';

export function passwordValida(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
