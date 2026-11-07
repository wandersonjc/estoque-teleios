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
//   3. Rode `npm run db:sync-permissoes` para atualizar o banco.
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
  {
    codigo: "produtos.produto.excluir",
    modulo: "Produtos",
    funcionalidade: "Produto",
    operacao: "Excluir",
    descricao: "Excluir produtos sem vínculos, preços, estoque, movimentações ou transferências",
    ordem: 150,
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
    descricao: "Excluir locais de estoque sem estoque, movimentações ou transferências",
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

  // Módulo Auditoria
  {
    codigo: "auditoria.log.consultar",
    modulo: "Auditoria",
    funcionalidade: "Histórico de Ações",
    operacao: "Consultar",
    descricao: "Ver o histórico completo de ações e auditoria do sistema",
    ordem: 610,
  },

  // Módulo Fornecedores
  {
    codigo: "fornecedores.fornecedor.consultar",
    modulo: "Fornecedores",
    funcionalidade: "Fornecedor",
    operacao: "Consultar",
    descricao: "Ver a lista de fornecedores e seus dados de contato",
    ordem: 710,
  },
  {
    codigo: "fornecedores.fornecedor.criar",
    modulo: "Fornecedores",
    funcionalidade: "Fornecedor",
    operacao: "Cadastrar",
    descricao: "Cadastrar novos fornecedores",
    ordem: 720,
  },
  {
    codigo: "fornecedores.fornecedor.editar",
    modulo: "Fornecedores",
    funcionalidade: "Fornecedor",
    operacao: "Alterar",
    descricao: "Alterar dados de contato e condições comerciais do fornecedor",
    ordem: 730,
  },
  {
    codigo: "fornecedores.fornecedor.desativar",
    modulo: "Fornecedores",
    funcionalidade: "Fornecedor",
    operacao: "Desativar/Reativar",
    descricao: "Desativar e reativar fornecedores",
    ordem: 740,
  },
  {
    codigo: "fornecedores.vinculo.gerenciar",
    modulo: "Fornecedores",
    funcionalidade: "Vínculo produto",
    operacao: "Gerenciar",
    descricao: "Vincular produtos a fornecedores, informar o código no fornecedor e ativar/desativar o vínculo",
    ordem: 750,
  },
  {
    codigo: "fornecedores.preco.cotar",
    modulo: "Fornecedores",
    funcionalidade: "Preço cotado",
    operacao: "Registrar",
    descricao: "Registrar preço cotado de um produto em um fornecedor, sem pedido",
    ordem: 760,
  },
  {
    codigo: "cargos.cargo.consultar",
    modulo: "Cargos",
    funcionalidade: "Cargo",
    operacao: "Consultar",
    descricao: "Ver a lista e os dados dos cargos cadastrados",
    ordem: 810,
  },
  {
    codigo: "cargos.cargo.criar",
    modulo: "Cargos",
    funcionalidade: "Cargo",
    operacao: "Cadastrar",
    descricao: "Cadastrar novos cargos",
    ordem: 820,
  },
  {
    codigo: "cargos.cargo.editar",
    modulo: "Cargos",
    funcionalidade: "Cargo",
    operacao: "Alterar",
    descricao: "Alterar o nome dos cargos cadastrados",
    ordem: 830,
  },
  {
    codigo: "cargos.cargo.excluir",
    modulo: "Cargos",
    funcionalidade: "Cargo",
    operacao: "Excluir",
    descricao: "Excluir cargos sem usuários associados",
    ordem: 840,
  },
  {
    codigo: "cargos.usuario.gerenciar",
    modulo: "Cargos",
    funcionalidade: "Cargo do usuário",
    operacao: "Gerenciar",
    descricao: "Associar e remover cargos dos usuários",
    ordem: 850,
  },
  {
    codigo: "funcoes.funcao.consultar",
    modulo: "Funções",
    funcionalidade: "Função",
    operacao: "Consultar",
    descricao: "Ver a lista e os dados das funções cadastradas",
    ordem: 910,
  },
  {
    codigo: "funcoes.funcao.criar",
    modulo: "Funções",
    funcionalidade: "Função",
    operacao: "Cadastrar",
    descricao: "Cadastrar novas funções",
    ordem: 920,
  },
  {
    codigo: "funcoes.funcao.editar",
    modulo: "Funções",
    funcionalidade: "Função",
    operacao: "Alterar",
    descricao: "Alterar o nome das funções cadastradas",
    ordem: 930,
  },
  {
    codigo: "funcoes.funcao.excluir",
    modulo: "Funções",
    funcionalidade: "Função",
    operacao: "Excluir",
    descricao: "Excluir funções sem usuários associados",
    ordem: 940,
  },
  {
    codigo: "funcoes.usuario.gerenciar",
    modulo: "Funções",
    funcionalidade: "Função do usuário",
    operacao: "Gerenciar",
    descricao: "Associar e remover funções dos usuários",
    ordem: 950,
  },
  // Módulo Pedidos de compra
  {
    codigo: "pedidos.pedido.consultar",
    modulo: "Pedidos de compra",
    funcionalidade: "Pedido",
    operacao: "Consultar",
    descricao: "Consultar planejamento de reposição e pedidos de compra",
    ordem: 1010,
  },
  {
    codigo: "pedidos.configuracao.gerenciar",
    modulo: "Pedidos de compra",
    funcionalidade: "Reposição",
    operacao: "Gerenciar",
    descricao: "Cadastrar e alterar parâmetros de reposição dos produtos",
    ordem: 1020,
  },
  {
    codigo: "pedidos.rascunho.gerenciar",
    modulo: "Pedidos de compra",
    funcionalidade: "Rascunho",
    operacao: "Gerenciar",
    descricao: "Criar e alterar pedidos de compra em rascunho",
    ordem: 1030,
  },
  {
    codigo: "pedidos.pedido.enviar",
    modulo: "Pedidos de compra",
    funcionalidade: "Pedido",
    operacao: "Enviar",
    descricao: "Enviar pedidos de compra aos fornecedores",
    ordem: 1040,
  },
  {
    codigo: "pedidos.pedido.cancelar",
    modulo: "Pedidos de compra",
    funcionalidade: "Pedido",
    operacao: "Cancelar",
    descricao: "Cancelar pedidos de compra em rascunho ou enviados",
    ordem: 1050,
  },
  {
    codigo: "orcamentos.orcamento.consultar",
    modulo: "Orçamento",
    funcionalidade: "Solicitação de orçamento",
    operacao: "Visualizar",
    descricao: "Visualizar a lista e os detalhes das solicitações de orçamento",
    ordem: 1060,
  },
  {
    codigo: "orcamentos.orcamento.enviar",
    modulo: "Orçamento",
    funcionalidade: "Solicitação de orçamento",
    operacao: "Enviar",
    descricao: "Enviar planilhas de cotação por e-mail e WhatsApp aos fornecedores vinculados",
    ordem: 1070,
  },
  {
    codigo: "orcamentos.orcamento.editar",
    modulo: "Orçamento",
    funcionalidade: "Solicitação de orçamento",
    operacao: "Editar",
    descricao: "Editar itens, quantidades e unidades de solicitações ainda não enviadas",
    ordem: 1080,
  },
  {
    codigo: "orcamentos.orcamento.excluir",
    modulo: "Orçamento",
    funcionalidade: "Solicitação de orçamento",
    operacao: "Excluir",
    descricao: "Excluir solicitações de orçamento ainda não enviadas",
    ordem: 1090,
  },
  {
    codigo: "pedidos.pedido.receber",
    modulo: "Pedidos de compra",
    funcionalidade: "Pedido",
    operacao: "Receber",
    descricao: "Registrar recebimentos parciais ou totais de pedidos de compra",
    ordem: 1060,
  },
  // Módulo Transferências
  {
    codigo: "transferencias.pedido.consultar",
    modulo: "Transferências",
    funcionalidade: "Pedido de transferência",
    operacao: "Consultar",
    descricao: "Ver pedidos de transferência entre locais de estoque",
    ordem: 1110,
  },
  {
    codigo: "transferencias.pedido.solicitar",
    modulo: "Transferências",
    funcionalidade: "Pedido de transferência",
    operacao: "Solicitar",
    descricao: "Criar solicitações de transferência entre locais de estoque",
    ordem: 1120,
  },
  {
    codigo: "transferencias.pedido.enviar",
    modulo: "Transferências",
    funcionalidade: "Pedido de transferência",
    operacao: "Enviar",
    descricao: "Registrar o envio de produtos em pedidos de transferência",
    ordem: 1130,
  },
  {
    codigo: "transferencias.pedido.receber",
    modulo: "Transferências",
    funcionalidade: "Pedido de transferência",
    operacao: "Receber",
    descricao: "Confirmar o recebimento de pedidos de transferência",
    ordem: 1140,
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
  // Sem permissão específica, o item fica visível para qualquer usuário logado.
  permissao?: string;
};

export const MENU_PRINCIPAL: ItemMenu[][] = [
  [{ href: "/dashboard", rotulo: "Dashboard" }],
  [
    {
      href: "/produtos",
      rotulo: "Produtos",
      permissao: "produtos.produto.consultar",
    },
    { href: "/locais", rotulo: "Locais", permissao: "locais.local.consultar" },
    {
      href: "/fornecedores",
      rotulo: "Fornecedores",
      permissao: "fornecedores.fornecedor.consultar",
    },
  ],
  [
    {
      href: "/orcamento",
      rotulo: "Orçamentos",
      permissao: "orcamentos.orcamento.consultar",
    },
    {
      href: "/pedidos",
      rotulo: "Pedidos de Compras",
      permissao: "pedidos.pedido.consultar",
    },
    {
      href: "/transferencias",
      rotulo: "Transferências",
      permissao: "transferencias.pedido.consultar",
    },
  ],
  [
    { href: "/cargos", rotulo: "Cargos", permissao: "cargos.cargo.consultar" },
    {
      href: "/funcoes",
      rotulo: "Funções",
      permissao: "funcoes.funcao.consultar",
    },
    {
      href: "/usuarios",
      rotulo: "Usuários",
      permissao: "usuarios.usuario.consultar",
    },
    {
      href: "/permissoes",
      rotulo: "Permissões",
      permissao: "permissoes.permissao.consultar",
    },
  ],
  [
    {
      href: "/historico",
      rotulo: "Histórico",
      permissao: "auditoria.log.consultar",
    },
  ],
];

// ------------------------------------------------------------
// Sincronizador do catálogo, executado pelo seed/comando de manutenção
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
