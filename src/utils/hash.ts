// src/utils/hash.ts
// Wrapper de bcrypt. Centraliza los salt rounds y el tipado.
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Genera el hash de una contrasena en texto plano.
 * Nunca se debe guardar la contrasena plana en la base de datos.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara una contrasena plana contra un hash de bcrypt.
 * Devuelve `true` si coinciden, `false` en caso contrario.
 */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}