// ============================================================
// Módulo 1 - Senhas: hash para guardar no banco
// Usa o módulo crypto do próprio Node (scrypt), sem instalar
// dependência externa. A senha pura NUNCA é gravada.
// Formato guardado: scrypt$<salt em hex>$<hash em hex>
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { randomBytes, scryptSync } from "node:crypto";

const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;

// Gera o hash da senha, com um "sal" novo a cada chamada.
// Duas senhas iguais geram hashes diferentes (o sal muda).
export function gerarHashSenha(senha: string): string {
  const salt = randomBytes(TAMANHO_SALT);
  const hash = scryptSync(senha, salt, TAMANHO_HASH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
