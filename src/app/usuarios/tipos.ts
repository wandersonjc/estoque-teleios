// ============================================================
// Módulo 1 - Usuários: constantes e tipos
// Arquivo sem "use server": guarda tipos e constantes usados
// pelo formulário (cliente) e pelas ações (servidor).
// O acesso NÃO vem mais de um "perfil": cada usuário recebe
// permissões individuais na tela /permissoes.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

export const LIMITE_NOME_USUARIO = 150;
export const LIMITE_EMAIL = 150;
export const SENHA_MINIMA = 6;

// O que o formulário envia (tudo chega como texto)
export type ValoresFormularioUsuario = {
  nome: string;
  email: string;
  senha: string;
};

export type ErrosFormularioUsuario = {
  nome?: string;
  email?: string;
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
  senha: "",
};
