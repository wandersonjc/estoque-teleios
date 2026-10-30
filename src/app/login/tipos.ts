// ============================================================
// Módulo 1 - Login: constantes e tipos
// Arquivo sem "use server": guarda tipos usados pelo formulário
// (cliente) e pela ação (servidor).
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

export type ValoresFormularioLogin = {
  email: string;
};

export type EstadoLogin = {
  erroGeral?: string;
  // O e-mail volta preenchido quando houver erro, para não redigitar
  valores: ValoresFormularioLogin;
};

export const VALORES_LOGIN_VAZIOS: ValoresFormularioLogin = {
  email: "",
};
