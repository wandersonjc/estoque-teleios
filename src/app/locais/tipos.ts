// ============================================================
// Módulo 1 - Locais de estoque: constantes e tipos
// Arquivo sem "use server": guarda tipos e constantes usados
// pelo formulário (cliente) e pelas ações (servidor).
// Regras: docs/regras-de-negocio.md (seção 3)
// ============================================================

export const LIMITE_NOME_LOCAL = 100;

export type ValoresFormularioLocal = {
  nome: string;
};

export type EstadoFormularioLocal = {
  erroGeral?: string;
  erroNome?: string;
  valores: ValoresFormularioLocal;
};

export const VALORES_FORMULARIO_LOCAL_VAZIOS: ValoresFormularioLocal = {
  nome: "",
};
