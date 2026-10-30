// ============================================================
// Módulo 1 - Senhas: hash e verificação
// Usa o módulo crypto do próprio Node (scrypt), sem instalar
// dependência externa. A senha pura NUNCA é gravada.
// Formato guardado: scrypt$<salt em hex>$<hash em hex>
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;

// Gera o hash da senha, com um "sal" novo a cada chamada.
// Duas senhas iguais geram hashes diferentes (o sal muda).
export function gerarHashSenha(senha: string): string {
  const salt = randomBytes(TAMANHO_SALT);
  const hash = scryptSync(senha, salt, TAMANHO_HASH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Confere se a senha digitada corresponde ao hash guardado.
// A comparação é feita em tempo constante (timingSafeEqual) para
// não vazar informação pelo tempo de resposta. Qualquer hash
// fora do formato esperado é tratado como senha incorreta.
export function verificarSenha(senha: string, hashGuardado: string): boolean {
  const partes = hashGuardado.split("$");
  if (partes.length !== 3) return false;

  const [algoritmo, saltHex, hashHex] = partes;
  if (algoritmo !== "scrypt") return false;

  const salt = Buffer.from(saltHex, "hex");
  const hashEsperado = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || hashEsperado.length === 0) return false;

  const hashCalculado = scryptSync(senha, salt, hashEsperado.length);
  if (hashCalculado.length !== hashEsperado.length) return false;

  return timingSafeEqual(hashCalculado, hashEsperado);
}
