// ============================================================
// Módulo 1 - Usuários: constantes e tipos
// Arquivo sem "use server": guarda tipos e constantes usados
// pelo formulário (cliente) e pelas ações (servidor).
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

export const LIMITE_NOME_USUARIO = 150;
export const LIMITE_EMAIL = 150;
export const SENHA_MINIMA = 6;

// Perfis do sistema (seção 2 das regras)
export const PERFIS = ["ESTOQUISTA", "COMPRADOR"] as const;

export type Perfil = (typeof PERFIS)[number];

export const ROTULO_PERFIL: Record<Perfil, string> = {
  ESTOQUISTA: "Estoquista",
  COMPRADOR: "Comprador",
};

// O que o formulário envia (tudo chega como texto)
export type ValoresFormularioUsuario = {
  nome: string;
  email: string;
  perfil: string;
  senha: string;
};

export type ErrosFormularioUsuario = {
  nome?: string;
  email?: string;
  perfil?: string;
  senha?: string;
};

export type EstadoFormularioUsuario = {
  erroGeral?: string;
  erros?: ErrosFormularioUsuario;
  valores: ValoresFormularioUsuario;
};

export const VALORES_FORMULARIO_USUARIO_VAZIOS: ValoresFormularioUsuario = {
  nome: "",
  email: "",
  perfil: "ESTOQUISTA",
  senha: "",
};
