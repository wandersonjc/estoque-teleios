"use server";

// ============================================================
// Módulo 2 - Fornecedores: ações do servidor
// Cadastro, vínculo produto x fornecedor (RN-09) e preço cotado
// (RN-10, origem COTADO). Toda ação confere a permissão no
// servidor: esconder o botão não basta.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import {
  LIMITE_CODIGO_NO_FORNECEDOR,
  LIMITE_CONTATO_FORNECEDOR,
  LIMITE_NOME_FORNECEDOR,
  dataIsoParaDate,
  formatarMoeda,
  normalizarMoeda,
  type ErrosFormularioFornecedor,
  type EstadoFormularioFornecedor,
  type EstadoFormularioPreco,
  type EstadoFormularioVinculo,
  type ValoresFormularioFornecedor,
  type ValoresFormularioPreco,
  type ValoresFormularioVinculo,
} from "./tipos";

// ------------------------------------------------------------
// Auxiliares (não exportadas: em "use server" só funções async)
// ------------------------------------------------------------

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function lerValoresFornecedor(
  formData: FormData
): ValoresFormularioFornecedor {
  return {
    nome: texto(formData, "nome"),
    contato: texto(formData, "contato"),
    prazoEntregaDias: texto(formData, "prazoEntregaDias"),
    valorMinimoPedido: texto(formData, "valorMinimoPedido"),
    frete: texto(formData, "frete"),
  };
}

type FornecedorValidado = {
  nome: string;
  contato: string | null;
  prazoEntregaDias: number | null;
  valorMinimoPedido: string | null;
  frete: string | null;
};

function validarFornecedor(
  valores: ValoresFormularioFornecedor
):
  | { ok: true; dados: FornecedorValidado }
  | { ok: false; estado: EstadoFormularioFornecedor } {
  const erros: ErrosFormularioFornecedor = {};

  if (valores.nome === "") {
    erros.nome = "Informe o nome do fornecedor.";
  } else if (valores.nome.length > LIMITE_NOME_FORNECEDOR) {
    erros.nome = `O nome pode ter no máximo ${LIMITE_NOME_FORNECEDOR} caracteres.`;
  }

  if (valores.contato.length > LIMITE_CONTATO_FORNECEDOR) {
    erros.contato = `O contato pode ter no máximo ${LIMITE_CONTATO_FORNECEDOR} caracteres.`;
  }

  let prazo: number | null = null;
  if (valores.prazoEntregaDias !== "") {
    prazo = Number(valores.prazoEntregaDias);
    if (!Number.isInteger(prazo) || prazo < 0) {
      erros.prazoEntregaDias = "Informe um prazo em dias (número inteiro, zero ou mais).";
    }
  }

  const valorMinimo = normalizarMoeda(valores.valorMinimoPedido, true);
  if (valorMinimo === null) {
    erros.valorMinimoPedido = "Informe um valor em reais, com até 2 casas decimais.";
  }

  const frete = normalizarMoeda(valores.frete, true);
  if (frete === null) {
    erros.frete = "Informe um valor em reais, com até 2 casas decimais.";
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, estado: { erros, valores } };
  }

  return {
    ok: true,
    dados: {
      nome: valores.nome,
      contato: valores.contato === "" ? null : valores.contato,
      prazoEntregaDias: prazo,
      valorMinimoPedido: valorMinimo === "" ? null : valorMinimo,
      frete: frete === "" ? null : frete,
    },
  };
}

function tratarErroBanco(erro: unknown, contexto: string): string {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    if (contexto === "fornecedor") {
      return "Já existe um fornecedor com este nome.";
    }
    if (contexto === "vinculo") {
      return "Este produto já está vinculado a este fornecedor.";
    }
  }

  console.error(`Erro ao gravar ${contexto}:`, erro);
  return "Não foi possível salvar. Tente novamente.";
}

function revalidarFornecedores(produtoId?: number, fornecedorId?: number) {
  revalidatePath("/fornecedores");
  if (fornecedorId) revalidatePath(`/fornecedores/${fornecedorId}`);
  revalidatePath("/produtos");
  if (produtoId) revalidatePath(`/produtos/${produtoId}`);
}

function idPositivo(valor: string): number | null {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  return numero;
}

function caminhoInternoValido(valor: string): string | null {
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  if (valor.includes("://") || valor.includes("\\")) return null;
  return valor;
}

function retornoPrecoComAviso(
  valor: string,
  fornecedorId: number,
  aviso: string
): string {
  const destino =
    caminhoInternoValido(valor) ?? `/fornecedores/${fornecedorId}?aba=precos`;
  const separador = destino.indexOf("?");
  const caminho = separador === -1 ? destino : destino.slice(0, separador);
  const parametros = new URLSearchParams(
    separador === -1 ? "" : destino.slice(separador + 1)
  );
  parametros.set("aba", "precos");
  parametros.set(aviso, "1");
  return `${caminho}?${parametros.toString()}`;
}

// ------------------------------------------------------------
// Cadastro de fornecedor
// ------------------------------------------------------------

export async function criarFornecedor(
  _estadoAnterior: EstadoFormularioFornecedor,
  formData: FormData
): Promise<EstadoFormularioFornecedor> {
  const atual = await verificarPermissao("fornecedores.fornecedor.criar");
  const valores = lerValoresFornecedor(formData);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };

  const validacao = validarFornecedor(valores);
  if (!validacao.ok) return validacao.estado;

  try {
    await prisma.$transaction(async (tx) => {
      const novo = await tx.fornecedor.create({
        data: {
          nome: validacao.dados.nome,
          contato: validacao.dados.contato,
          prazoEntregaDias: validacao.dados.prazoEntregaDias,
          valorMinimoPedido: validacao.dados.valorMinimoPedido,
          frete: validacao.dados.frete,
        },
      });

      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "CRIAR",
          descricao: `Fornecedor "${novo.nome}" cadastrado`,
          registroId: novo.id,
          usuarioId: atual.id,
          dados: {
            nome: novo.nome,
            contato: novo.contato,
            prazoEntregaDias: novo.prazoEntregaDias,
            valorMinimoPedido: novo.valorMinimoPedido?.toString() ?? null,
            frete: novo.frete?.toString() ?? null,
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro, "fornecedor"), valores };
  }

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

export async function atualizarFornecedor(
  _estadoAnterior: EstadoFormularioFornecedor,
  formData: FormData
): Promise<EstadoFormularioFornecedor> {
  const atual = await verificarPermissao("fornecedores.fornecedor.editar");
  const valores = lerValoresFornecedor(formData);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };

  const id = idPositivo(String(formData.get("id") ?? ""));
  if (!id) return { erroGeral: "Fornecedor inválido.", valores };

  const validacao = validarFornecedor(valores);
  if (!validacao.ok) return validacao.estado;

  const antigo = await prisma.fornecedor.findUnique({
    where: { id },
    select: {
      nome: true,
      contato: true,
      prazoEntregaDias: true,
      valorMinimoPedido: true,
      frete: true,
    },
  });
  if (!antigo) return { erroGeral: "Fornecedor não encontrado.", valores };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.fornecedor.update({
        where: { id },
        data: {
          nome: validacao.dados.nome,
          contato: validacao.dados.contato,
          prazoEntregaDias: validacao.dados.prazoEntregaDias,
          valorMinimoPedido: validacao.dados.valorMinimoPedido,
          frete: validacao.dados.frete,
        },
      });

      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "ALTERAR",
          descricao: `Fornecedor "${validacao.dados.nome}" alterado`,
          registroId: id,
          usuarioId: atual.id,
          dados: {
            antes: {
              nome: antigo.nome,
              contato: antigo.contato,
              prazoEntregaDias: antigo.prazoEntregaDias,
              valorMinimoPedido: antigo.valorMinimoPedido?.toString() ?? null,
              frete: antigo.frete?.toString() ?? null,
            },
            depois: validacao.dados,
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro, "fornecedor"), valores };
  }

  revalidarFornecedores(undefined, id);
  redirect(`/fornecedores/${id}?salvo=1`);
}

export async function desativarFornecedor(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("fornecedores.fornecedor.desativar");
  if (!atual) return;

  const id = idPositivo(String(formData.get("id") ?? ""));
  if (!id) return;

  const fornecedor = await prisma.fornecedor.findUnique({
    where: { id },
    select: { id: true, nome: true, ativo: true },
  });
  if (!fornecedor || !fornecedor.ativo) return;

  await prisma.$transaction(async (tx) => {
    await tx.fornecedor.update({ where: { id }, data: { ativo: false } });
    await registrarLog(
      {
        modulo: "FORNECEDORES",
        acao: "ALTERAR",
        descricao: `Fornecedor "${fornecedor.nome}" desativado`,
        registroId: id,
        usuarioId: atual.id,
      },
      tx
    );
  });

  revalidarFornecedores(undefined, id);
}

export async function reativarFornecedor(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("fornecedores.fornecedor.desativar");
  if (!atual) return;

  const id = idPositivo(String(formData.get("id") ?? ""));
  if (!id) return;

  const fornecedor = await prisma.fornecedor.findUnique({
    where: { id },
    select: { id: true, nome: true, ativo: true },
  });
  if (!fornecedor || fornecedor.ativo) return;

  await prisma.$transaction(async (tx) => {
    await tx.fornecedor.update({ where: { id }, data: { ativo: true } });
    await registrarLog(
      {
        modulo: "FORNECEDORES",
        acao: "ALTERAR",
        descricao: `Fornecedor "${fornecedor.nome}" reativado`,
        registroId: id,
        usuarioId: atual.id,
      },
      tx
    );
  });

  revalidarFornecedores(undefined, id);
}

// ------------------------------------------------------------
// Vínculo produto x fornecedor (RN-09)
// ------------------------------------------------------------

function lerValoresVinculo(formData: FormData): ValoresFormularioVinculo {
  return {
    produtoId: texto(formData, "produtoId"),
    fornecedorId: texto(formData, "fornecedorId"),
    codigoNoFornecedor: texto(formData, "codigoNoFornecedor"),
  };
}

export async function vincularProdutoFornecedor(
  _estadoAnterior: EstadoFormularioVinculo,
  formData: FormData
): Promise<EstadoFormularioVinculo> {
  const atual = await verificarPermissao("fornecedores.vinculo.gerenciar");
  const valores = lerValoresVinculo(formData);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };

  const produtoId = idPositivo(valores.produtoId);
  const fornecedorId = idPositivo(valores.fornecedorId);
  const erros: NonNullable<EstadoFormularioVinculo["erros"]> = {};

  if (!produtoId) erros.produtoId = "Escolha um produto.";
  if (!fornecedorId) erros.fornecedorId = "Escolha um fornecedor.";
  if (valores.codigoNoFornecedor.length > LIMITE_CODIGO_NO_FORNECEDOR) {
    erros.codigoNoFornecedor = `O código pode ter no máximo ${LIMITE_CODIGO_NO_FORNECEDOR} caracteres.`;
  }

  if (Object.keys(erros).length > 0) return { erros, valores };

  const [produto, fornecedor] = await Promise.all([
    prisma.produto.findUnique({
      where: { id: produtoId! },
      select: { id: true, nome: true },
    }),
    prisma.fornecedor.findUnique({
      where: { id: fornecedorId! },
      select: { id: true, nome: true },
    }),
  ]);

  if (!produto) return { erroGeral: "Produto não encontrado.", valores };
  if (!fornecedor) return { erroGeral: "Fornecedor não encontrado.", valores };

  const codigo =
    valores.codigoNoFornecedor === "" ? null : valores.codigoNoFornecedor;

  try {
    await prisma.$transaction(async (tx) => {
      const vinculo = await tx.produtoFornecedor.upsert({
        where: {
          produtoId_fornecedorId: {
            produtoId: produto.id,
            fornecedorId: fornecedor.id,
          },
        },
        create: {
          produtoId: produto.id,
          fornecedorId: fornecedor.id,
          codigoNoFornecedor: codigo,
          ativo: true,
        },
        update: {
          codigoNoFornecedor: codigo,
          ativo: true,
        },
      });

      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "ALTERAR",
          descricao: `Vinculou "${produto.nome}" ao fornecedor "${fornecedor.nome}"`,
          registroId: vinculo.id,
          usuarioId: atual.id,
          dados: {
            produtoId: produto.id,
            fornecedorId: fornecedor.id,
            codigoNoFornecedor: codigo,
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro, "vinculo"), valores };
  }

  revalidarFornecedores(produto.id, fornecedor.id);
  const retorno =
    caminhoInternoValido(String(formData.get("retorno") ?? "")) ??
    `/fornecedores/${fornecedor.id}?vinculo=1`;
  redirect(retorno);
}

export async function atualizarCodigoVinculo(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("fornecedores.vinculo.gerenciar");
  if (!atual) return;

  const id = idPositivo(String(formData.get("id") ?? ""));
  if (!id) return;

  const codigoTexto = texto(formData, "codigoNoFornecedor");
  if (codigoTexto.length > LIMITE_CODIGO_NO_FORNECEDOR) return;

  const vinculo = await prisma.produtoFornecedor.findUnique({
    where: { id },
    include: {
      produto: { select: { id: true, nome: true } },
      fornecedor: { select: { id: true, nome: true } },
    },
  });
  if (!vinculo) return;

  const codigo = codigoTexto === "" ? null : codigoTexto;

  await prisma.$transaction(async (tx) => {
    await tx.produtoFornecedor.update({
      where: { id },
      data: { codigoNoFornecedor: codigo },
    });
    await registrarLog(
      {
        modulo: "FORNECEDORES",
        acao: "ALTERAR",
        descricao: `Alterou o código de "${vinculo.produto.nome}" no fornecedor "${vinculo.fornecedor.nome}"`,
        registroId: id,
        usuarioId: atual.id,
        dados: {
          antes: vinculo.codigoNoFornecedor,
          depois: codigo,
        },
      },
      tx
    );
  });

  revalidarFornecedores(vinculo.produtoId, vinculo.fornecedorId);
}

export async function alternarAtivoVinculo(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("fornecedores.vinculo.gerenciar");
  if (!atual) return;

  const id = idPositivo(String(formData.get("id") ?? ""));
  if (!id) return;

  const vinculo = await prisma.produtoFornecedor.findUnique({
    where: { id },
    include: {
      produto: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
    },
  });
  if (!vinculo) return;

  const ativo = !vinculo.ativo;

  await prisma.$transaction(async (tx) => {
    await tx.produtoFornecedor.update({
      where: { id },
      data: { ativo },
    });
    await registrarLog(
      {
        modulo: "FORNECEDORES",
        acao: "ALTERAR",
        descricao: ativo
          ? `Reativou o vínculo de "${vinculo.produto.nome}" com "${vinculo.fornecedor.nome}"`
          : `Desativou o vínculo de "${vinculo.produto.nome}" com "${vinculo.fornecedor.nome}"`,
        registroId: id,
        usuarioId: atual.id,
      },
      tx
    );
  });

  revalidarFornecedores(vinculo.produtoId, vinculo.fornecedorId);
}

// ------------------------------------------------------------
// Preço cotado (RN-10)
// ------------------------------------------------------------

function lerValoresPreco(formData: FormData): ValoresFormularioPreco {
  return {
    produtoId: texto(formData, "produtoId"),
    fornecedorId: texto(formData, "fornecedorId"),
    precoUnitario: texto(formData, "precoUnitario"),
    data: texto(formData, "data"),
  };
}

export async function registrarPrecoCotado(
  _estadoAnterior: EstadoFormularioPreco,
  formData: FormData
): Promise<EstadoFormularioPreco> {
  const atual = await verificarPermissao("fornecedores.preco.cotar");
  const valores = lerValoresPreco(formData);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };

  const produtoId = idPositivo(valores.produtoId);
  const fornecedorId = idPositivo(valores.fornecedorId);
  const erros: NonNullable<EstadoFormularioPreco["erros"]> = {};

  if (!produtoId) erros.produtoId = "Escolha um produto.";
  if (!fornecedorId) erros.fornecedorId = "Escolha um fornecedor.";

  const preco = normalizarMoeda(valores.precoUnitario, false);
  if (preco === null || Number(preco) <= 0) {
    erros.precoUnitario = "Informe um preço maior que zero, com até 2 casas decimais.";
  }

  const data = dataIsoParaDate(valores.data);
  if (!data) erros.data = "Informe a data da cotação.";

  if (Object.keys(erros).length > 0) return { erros, valores };

  const vinculo = await prisma.produtoFornecedor.findUnique({
    where: {
      produtoId_fornecedorId: {
        produtoId: produtoId!,
        fornecedorId: fornecedorId!,
      },
    },
    include: {
      produto: { select: { id: true, nome: true } },
      fornecedor: { select: { id: true, nome: true } },
    },
  });

  if (!vinculo) {
    return {
      erroGeral:
        "Vincule o produto a este fornecedor antes de registrar o preço.",
      valores,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.historicoPreco.create({
        data: {
          produtoId: vinculo.produtoId,
          fornecedorId: vinculo.fornecedorId,
          precoUnitario: preco!,
          data: data!,
          origem: "COTADO",
        },
      });

      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "CRIAR",
          descricao: `Preço cotado de ${formatarMoeda(preco!)} para "${vinculo.produto.nome}" no fornecedor "${vinculo.fornecedor.nome}"`,
          registroId: registro.id,
          usuarioId: atual.id,
          dados: {
            produtoId: vinculo.produtoId,
            fornecedorId: vinculo.fornecedorId,
            precoUnitario: preco,
            data: valores.data,
            origem: "COTADO",
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro, "preco"), valores };
  }

  revalidarFornecedores(vinculo.produtoId, vinculo.fornecedorId);
  const retorno =
    caminhoInternoValido(String(formData.get("retorno") ?? "")) ??
    `/fornecedores/${vinculo.fornecedorId}?preco=1`;
  redirect(retorno);
}

export async function atualizarPrecoHistorico(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("fornecedores.preco.cotar");
  if (!atual) return;

  const id = idPositivo(texto(formData, "id"));
  const fornecedorId = idPositivo(texto(formData, "fornecedorId"));
  if (!id || !fornecedorId) return;

  const retorno = texto(formData, "retorno");
  const preco = normalizarMoeda(texto(formData, "precoUnitario"), false);
  if (preco === null || Number(preco) <= 0) {
    redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoErro"));
  }

  const registro = await prisma.historicoPreco.findUnique({
    where: { id },
    include: {
      produto: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
    },
  });
  if (
    !registro ||
    registro.fornecedorId !== fornecedorId ||
    registro.origem !== "COTADO"
  ) {
    redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoErro"));
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.historicoPreco.update({
        where: { id },
        data: { precoUnitario: preco },
      });
      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "ALTERAR",
          descricao: `Alterou preço cotado de ${formatarMoeda(registro.precoUnitario.toString())} para ${formatarMoeda(preco)} de "${registro.produto.nome}" no fornecedor "${registro.fornecedor.nome}"`,
          registroId: id,
          usuarioId: atual.id,
          dados: {
            produtoId: registro.produtoId,
            fornecedorId,
            origem: registro.origem,
            precoAnterior: registro.precoUnitario.toString(),
            precoNovo: preco,
          },
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao atualizar preço cotado:", erro);
    redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoErro"));
  }

  revalidarFornecedores(registro.produtoId, fornecedorId);
  redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoAtualizado"));
}

export async function excluirPrecoHistorico(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("fornecedores.preco.cotar");
  if (!atual) return;

  const id = idPositivo(texto(formData, "id"));
  const fornecedorId = idPositivo(texto(formData, "fornecedorId"));
  if (!id || !fornecedorId) return;

  const retorno = texto(formData, "retorno");
  const registro = await prisma.historicoPreco.findUnique({
    where: { id },
    include: {
      produto: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
    },
  });
  if (
    !registro ||
    registro.fornecedorId !== fornecedorId ||
    registro.origem !== "COTADO"
  ) {
    redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoErro"));
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.historicoPreco.delete({ where: { id } });
      await registrarLog(
        {
          modulo: "FORNECEDORES",
          acao: "EXCLUIR",
          descricao: `Excluiu preço cotado de ${formatarMoeda(registro.precoUnitario.toString())} de "${registro.produto.nome}" no fornecedor "${registro.fornecedor.nome}"`,
          registroId: id,
          usuarioId: atual.id,
          dados: {
            produtoId: registro.produtoId,
            fornecedorId,
            origem: registro.origem,
            precoUnitario: registro.precoUnitario.toString(),
            data: registro.data.toISOString(),
          },
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao excluir preço cotado:", erro);
    redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoErro"));
  }

  revalidarFornecedores(registro.produtoId, fornecedorId);
  redirect(retornoPrecoComAviso(retorno, fornecedorId, "precoExcluido"));
}
