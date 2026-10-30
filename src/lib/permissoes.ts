// ============================================================
// Módulo 1 - Catálogo de permissões (fonte de verdade)
//
// Este arquivo é o ÚNICO lugar onde se registra uma permissão.
// A matriz da tela /permissoes é montada a partir do que estiver
// aqui: nada de listas fixas no frontend.
//
// Como registrar uma permissão nova:
//   1. Acrescente um item em CATALOGO_DE_PERMISSOES com um
//      "codigo" único e estável (modulo.funcionalidade.operacao).
//   2. Use esse código no backend (exigirPermissao / verificarPermissao)
//      e no frontend (usuario.permissoes.has(...) ou MENU_PRINCIPAL).
//   3. Rode `npm run db:seed` OU apenas abra a tela /permissoes:
//      o sincronizador grava o item no banco automaticamente.
// Novas permissões nascem NEGADAS: ninguém as recebe até que um
// administrador marque a caixa e salve.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

// Uma linha do catálogo (a definição de uma permissão)
export type PermissaoCatalogo = {
  // Identificador único e estável usado no código (nunca muda de valor)
  codigo: string;
  // Agrupamentos que montam a matriz na tela
  modulo: string;
  funcionalidade: string;
  operacao: string;
  // Texto legível mostrado ao usuário
  descricao: string;
  // Ordem de exibição (módulos na ordem dos blocos de 100)
  ordem: number;
};

// ------------------------------------------------------------
// Catálogo (apenas funcionalidades REAIS do sistema)
// ------------------------------------------------------------
export const CATALOGO_DE_PERMISSOES: PermissaoCatalogo[] = [
  // Módulo Produtos
  {
    codigo: "produtos.produto.consultar",
    modulo: "Produtos",
    funcionalidade: "Produto",
    operacao: "Consultar",
    descricao: "Ver a lista de produtos e os dados de cada produto",
    ordem: 110,
  },
  {
    codigo: "produtos.produto.criar",
    modulo: "Produtos",
    funcionalidade: "Produto",
    operacao: "Cadastrar",
    descricao: "Cadastrar produtos novos",
    ordem: 120,
  },
  {
    codigo: "produtos.produto.editar",
    modulo: "Produtos",
    funcionalidade: "Produto",
    operacao: "Alterar",
    descricao: "Alterar os dados cadastrais de um produto",
    ordem: 130,
  },
  {
    codigo: "produtos.produto.desativar",
    modulo: "Produtos",
    funcionalidade: "Produto",
    operacao: "Desativar/Reativar",
    descricao: "Desativar e reativar produtos",
    ordem: 140,
  },

  // Módulo Estoque
  {
    codigo: "estoque.movimento.registrar",
    modulo: "Estoque",
    funcionalidade: "Movimentação",
    operacao: "Registrar",
    descricao: "Registrar entrada, saída e contagem de estoque por local",
    ordem: 210,
  },

  // Módulo Locais de estoque
  {
    codigo: "locais.local.consultar",
    modulo: "Locais de estoque",
    funcionalidade: "Local",
    operacao: "Consultar",
    descricao: "Ver a lista de locais de estoque",
    ordem: 310,
  },
  {
    codigo: "locais.local.criar",
    modulo: "Locais de estoque",
    funcionalidade: "Local",
    operacao: "Cadastrar",
    descricao: "Cadastrar locais de estoque",
    ordem: 320,
  },
  {
    codigo: "locais.local.editar",
    modulo: "Locais de estoque",
    funcionalidade: "Local",
    operacao: "Alterar",
    descricao: "Renomear locais de estoque",
    ordem: 330,
  },
  {
    codigo: "locais.local.excluir",
    modulo: "Locais de estoque",
    funcionalidade: "Local",
    operacao: "Excluir",
    descricao: "Excluir locais de estoque sem estoque nem movimentações",
    ordem: 340,
  },

  // Módulo Usuários
  {
    codigo: "usuarios.usuario.consultar",
    modulo: "Usuários",
    funcionalidade: "Usuário",
    operacao: "Consultar",
    descricao: "Ver a lista de usuários e os dados de cada usuário",
    ordem: 410,
  },
  {
    codigo: "usuarios.usuario.criar",
    modulo: "Usuários",
    funcionalidade: "Usuário",
    operacao: "Cadastrar",
    descricao: "Cadastrar usuários novos",
    ordem: 420,
  },
  {
    codigo: "usuarios.usuario.editar",
    modulo: "Usuários",
    funcionalidade: "Usuário",
    operacao: "Alterar",
    descricao: "Alterar nome, e-mail e senha de um usuário",
    ordem: 430,
  },
  {
    codigo: "usuarios.usuario.desativar",
    modulo: "Usuários",
    funcionalidade: "Usuário",
    operacao: "Desativar/Reativar",
    descricao: "Desativar e reativar usuários",
    ordem: 440,
  },
  {
    codigo: "usuarios.usuario.excluir",
    modulo: "Usuários",
    funcionalidade: "Usuário",
    operacao: "Excluir",
    descricao: "Excluir usuários sem movimentações nem registros no log",
    ordem: 450,
  },

  // Módulo Módulos e Permissões
  {
    codigo: "permissoes.permissao.consultar",
    modulo: "Módulos e Permissões",
    funcionalidade: "Permissão",
    operacao: "Consultar",
    descricao: "Ver a tela de módulos e permissões",
    ordem: 510,
  },
  {
    codigo: "permissoes.permissao.conceder",
    modulo: "Módulos e Permissões",
    funcionalidade: "Permissão",
    operacao: "Conceder/Revogar",
    descricao: "Conceder e revogar permissões dos usuários",
    ordem: 520,
  },
];

// Códigos válidos hoje (útil para validar o que chega do formulário)
export const CODIGOS_DE_PERMISSAO = CATALOGO_DE_PERMISSOES.map(
  (permissao) => permissao.codigo
);

// ------------------------------------------------------------
// Menu principal, filtrado pelas permissões do usuário logado.
// A lista de páginas é fixa de propósito: o que é dinâmico é a
// visibilidade de cada item (depende da permissão).
// ------------------------------------------------------------
export type ItemMenu = {
  href: string;
  rotulo: string;
  // Permissão exigida para o item aparecer
  permissao: string;
};

export const MENU_PRINCIPAL: ItemMenu[] = [
  { href: "/produtos", rotulo: "Produtos", permissao: "produtos.produto.consultar" },
  { href: "/locais", rotulo: "Locais", permissao: "locais.local.consultar" },
  { href: "/usuarios", rotulo: "Usuários", permissao: "usuarios.usuario.consultar" },
  {
    href: "/permissoes",
    rotulo: "Permissões",
    permissao: "permissoes.permissao.consultar",
  },
];

// ------------------------------------------------------------
// Sincronizador do catálogo
// Grava/atualiza no banco (tabela "permissao") o que está no
// catálogo em código. Usa upsert pelo "codigo", então:
//   - permissão nova aparece automaticamente (nasce negada);
//   - permissões já concedidas NÃO são apagadas;
//   - rodar quantas vezes quiser não duplica nada.
// Pode ser chamado dentro de uma transação, passando o "tx".
// ------------------------------------------------------------
export async function sincronizarCatalogoDePermissoes(
  cliente: Prisma.TransactionClient = prisma
): Promise<void> {
  for (const permissao of CATALOGO_DE_PERMISSOES) {
    await cliente.permissao.upsert({
      where: { codigo: permissao.codigo },
      update: {
        modulo: permissao.modulo,
        funcionalidade: permissao.funcionalidade,
        operacao: permissao.operacao,
        descricao: permissao.descricao,
        ordem: permissao.ordem,
      },
      create: {
        codigo: permissao.codigo,
        modulo: permissao.modulo,
        funcionalidade: permissao.funcionalidade,
        operacao: permissao.operacao,
        descricao: permissao.descricao,
        ordem: permissao.ordem,
      },
    });
  }
}
