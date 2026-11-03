"use server";

// ============================================================
// Módulo 1 - Estoque: ações do servidor
// Cadastro/edição de produto e movimentação de estoque
// (entrada soma, saída subtrai e contagem substitui).
// Toda a validação é feita aqui (a do navegador é só conveniência).
// TODA ação confere a permissão no servidor: esconder o botão
// não basta (ver src/lib/autorizacao.ts).
// Regras: RN-01, RN-02, RN-03, RN-22 e RN-23.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import {
  armazenarImagem,
  excluirImagemSemFalhar,
  prepararImagem,
} from "@/lib/armazenamento-imagens";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import {
  LIMITE_CODIGO_BARRAS,
  LIMITE_CODIGO_ERP,
  LIMITE_NOME,
  PREFIXO_QUANTIDADE,
  ROTULO_MOVIMENTO,
  TIPOS_MOVIMENTO,
  UNIDADES,
  formatarQuantidade,
  normalizarDecimal,
  type ErrosFormularioProduto,
  type EstadoFormularioProduto,
  type EstadoMovimento,
  type QuantidadesPorLocal,
  type TipoMovimento,
  type Unidade,
  type ValoresFormularioProduto,
} from "./tipos";

// ------------------------------------------------------------
// Funções auxiliares (não exportadas: em "use server" só podem
// ser exportadas funções assíncronas)
// ------------------------------------------------------------

class ErroEstoqueReservado extends Error {}

const MENSAGEM_NUMERO_INVALIDO =
  "Informe um número maior ou igual a zero, com até 9 dígitos e 3 casas decimais.";

// Lê os campos do formulário. Tudo chega como texto.
function lerValores(formData: FormData): ValoresFormularioProduto {
  const texto = (campo: string): string => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };

  return {
    nome: texto("nome"),
    unidade: texto("unidade").toUpperCase(),
    codigoErp: texto("codigoErp"),
  };
}

// Lê as quantidades informadas por local nos popups de movimentação.
// Os campos chegam como "quantidade_<id do local>".
function lerQuantidades(formData: FormData): QuantidadesPorLocal {
  const quantidades: QuantidadesPorLocal = {};

  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith(PREFIXO_QUANTIDADE)) continue;
    if (typeof valor !== "string") continue;

    const idDoLocal = campo.slice(PREFIXO_QUANTIDADE.length);
    if (!/^\d+$/.test(idDoLocal)) continue;

    quantidades[idDoLocal] = valor.trim();
  }

  return quantidades;
}

function embalagemIdDoFormulario(formData: FormData): string {
  const valor = formData.get("embalagemId");
  return typeof valor === "string" ? valor : "";
}

type ProdutoValidado = {
  nome: string;
  unidade: string;
  codigoErp: string | null;
};

type ResultadoValidacao =
  | { ok: true; dados: ProdutoValidado }
  | { ok: false; estado: EstadoFormularioProduto };

function validarProduto(valores: ValoresFormularioProduto): ResultadoValidacao {
  const erros: ErrosFormularioProduto = {};

  // RN-23: o cadastro é feito à mão, então o nome é obrigatório
  if (valores.nome === "") {
    erros.nome = "Informe o nome do produto.";
  } else if (valores.nome.length > LIMITE_NOME) {
    erros.nome = `O nome pode ter no máximo ${LIMITE_NOME} caracteres.`;
  }

  // Unidade obrigatória, dentro da lista permitida
  if (!UNIDADES.includes(valores.unidade as Unidade)) {
    erros.unidade = "Escolha uma unidade de medida válida.";
  }

  // RN-22: o código do ERP é opcional, mas único quando preenchido
  const codigoErp = valores.codigoErp === "" ? null : valores.codigoErp;
  if (codigoErp !== null && codigoErp.length > LIMITE_CODIGO_ERP) {
    erros.codigoErp = `O código do ERP pode ter no máximo ${LIMITE_CODIGO_ERP} caracteres.`;
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, estado: { erros, valores } };
  }

  return {
    ok: true,
    dados: {
      nome: valores.nome,
      unidade: valores.unidade,
      codigoErp,
    },
  };
}

// Traduz o erro do banco para uma mensagem em português.
// P2002 = alguma coluna única já existe. No produto, só o código
// do ERP é único (RN-22).
function tratarErroBanco(erro: unknown): string {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return "Já existe um produto cadastrado com este código do ERP.";
  }

  console.error("Erro ao gravar produto:", erro);
  return "Não foi possível salvar o produto. Tente novamente.";
}

// ------------------------------------------------------------
// Ações de produto
// ------------------------------------------------------------

// Cadastra um produto novo. A quantidade em estoque NÃO é informada
// aqui: ela começa zerada e é movimentada pelos popups de entrada,
// saída e contagem na tela do produto (RN-02).
export async function criarProduto(
  _estadoAnterior: EstadoFormularioProduto,
  formData: FormData
): Promise<EstadoFormularioProduto> {
  const atual = await verificarPermissao("produtos.produto.criar");
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores: lerValores(formData) };
  }

  const valores = lerValores(formData);
  const validacao = validarProduto(valores);

  // Devolve os erros mantendo o que foi digitado
  if (!validacao.ok) return validacao.estado;

  const imagemPreparada = await prepararImagem(formData.get("imagem"));
  if (!imagemPreparada.ok) {
    return { erroGeral: imagemPreparada.erro, valores };
  }

  let imagemChave: string | null = null;
  if (imagemPreparada.imagem) {
    try {
      imagemChave = await armazenarImagem(imagemPreparada.imagem, "produtos");
    } catch (erro) {
      console.error("Erro ao enviar imagem do produto:", erro);
      return { erroGeral: "Não foi possível enviar a imagem. Tente novamente.", valores };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome: validacao.dados.nome,
          unidade: validacao.dados.unidade,
          codigoErp: validacao.dados.codigoErp,
          imagemChave,
        },
      });

      await registrarLog(
        {
          modulo: "PRODUTOS",
          acao: "CRIAR",
          registroId: produto.id,
          descricao: `Produto "${produto.nome}" cadastrado`,
          dados: {
            nome: produto.nome,
            unidade: produto.unidade,
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    await excluirImagemSemFalhar(imagemChave);
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  // Fora do try/catch: o redirect lança um erro de controle de fluxo
  revalidatePath("/produtos");
  redirect("/produtos");
}

// Altera os dados cadastrais de um produto (não mexe em "ativo"
// nem no estoque: o estoque só muda pelas movimentações).
export async function atualizarProduto(
  _estadoAnterior: EstadoFormularioProduto,
  formData: FormData
): Promise<EstadoFormularioProduto> {
  const atual = await verificarPermissao("produtos.produto.editar");
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores: lerValores(formData) };
  }

  const valores = lerValores(formData);
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { erroGeral: "Produto inválido.", valores };
  }

  const antes = await prisma.produto.findUnique({
    where: { id },
    select: {
      nome: true,
      unidade: true,
      codigoBarras: true,
      codigoErp: true,
      imagemChave: true,
    },
  });

  if (!antes) return { erroGeral: "Produto não encontrado.", valores };
  valores.unidade = antes.unidade;

  const validacao = validarProduto(valores);
  if (!validacao.ok) return validacao.estado;

  const imagemPreparada = await prepararImagem(formData.get("imagem"));
  if (!imagemPreparada.ok) {
    return { erroGeral: imagemPreparada.erro, valores };
  }

  let novaImagemChave: string | null = null;
  if (imagemPreparada.imagem) {
    try {
      novaImagemChave = await armazenarImagem(
        imagemPreparada.imagem,
        "produtos"
      );
    } catch (erro) {
      console.error("Erro ao enviar imagem do produto:", erro);
      return { erroGeral: "Não foi possível enviar a imagem. Tente novamente.", valores };
    }
  }
  const removerImagem = formData.get("removerImagem") === "1";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id },
        data: {
          nome: validacao.dados.nome,
          unidade: validacao.dados.unidade,
          codigoErp: validacao.dados.codigoErp,
          imagemChave:
            novaImagemChave ?? (removerImagem ? null : antes.imagemChave),
        },
      });

      await registrarLog(
        {
          modulo: "PRODUTOS",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Produto "${validacao.dados.nome}" alterado`,
          dados: {
            antes: {
              nome: antes.nome,
              unidade: antes.unidade,
              codigoErp: antes.codigoErp,
            },
            depois: {
              nome: validacao.dados.nome,
              unidade: validacao.dados.unidade,
              codigoErp: validacao.dados.codigoErp,
            },
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    await excluirImagemSemFalhar(novaImagemChave);
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  if (novaImagemChave || removerImagem) {
    await excluirImagemSemFalhar(antes.imagemChave);
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  redirect(`/produtos/${id}?salvo=1`);
}

type DadosEmbalagem = {
  codigoBarras: string;
  unidade: string;
  quantidadeBase: string;
};

function lerDadosEmbalagem(formData: FormData): DadosEmbalagem {
  const texto = (campo: string): string => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };

  return {
    codigoBarras: texto("codigoBarras"),
    unidade: texto("unidade").toUpperCase(),
    quantidadeBase: texto("quantidadeBase"),
  };
}

function validarDadosEmbalagem(dados: DadosEmbalagem): string | null {
  const quantidade = normalizarDecimal(dados.quantidadeBase);
  if (
    dados.codigoBarras.length === 0 ||
    dados.codigoBarras.length > LIMITE_CODIGO_BARRAS ||
    !UNIDADES.includes(dados.unidade as Unidade) ||
    quantidade === null ||
    Number(quantidade) <= 0
  ) {
    return null;
  }
  return quantidade;
}

function urlEmbalagens(produtoId: number, resultado?: string): string {
  const parametros = new URLSearchParams({ aba: "embalagens" });
  if (resultado) parametros.set("embalagem", resultado);
  return `/produtos/${produtoId}?${parametros.toString()}`;
}

function erroCodigoDuplicado(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

async function bloquearProdutoEmEdicao(
  tx: Prisma.TransactionClient,
  produtoId: number
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM produto WHERE id = ${produtoId} FOR UPDATE`;
}

export async function adicionarEmbalagemProduto(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.editar");
  if (!atual) return;

  const produtoId = Number(formData.get("produtoId"));
  const dados = lerDadosEmbalagem(formData);
  if (!Number.isInteger(produtoId) || produtoId <= 0) return;
  const quantidadeBase = validarDadosEmbalagem(dados);
  if (quantidadeBase === null) {
    redirect(urlEmbalagens(produtoId, "dados-invalidos"));
  }

  try {
    const criada = await prisma.$transaction(async (tx) => {
      await bloquearProdutoEmEdicao(tx, produtoId);
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
        select: { nome: true },
      });
      if (!produto) return false;

      const quantidadeExistente = await tx.embalagemProduto.count({
        where: { produtoId },
      });
      const embalagem = await tx.embalagemProduto.create({
        data: {
          produtoId,
          codigoBarras: dados.codigoBarras,
          unidade: dados.unidade,
          quantidadeBase,
          principal: quantidadeExistente === 0,
        },
      });
      if (embalagem.principal) {
        await tx.produto.update({
          where: { id: produtoId },
          data: { codigoBarras: embalagem.codigoBarras },
        });
      }

      await registrarLog(
        {
          modulo: "PRODUTOS",
          acao: "CRIAR",
          registroId: produtoId,
          descricao: `Embalagem ${embalagem.unidade} adicionada ao produto "${produto.nome}"`,
          dados: {
            codigoBarras: embalagem.codigoBarras,
            unidade: embalagem.unidade,
            quantidadeBase: embalagem.quantidadeBase.toString(),
            principal: embalagem.principal,
          },
          usuarioId: atual.id,
        },
        tx
      );
      return true;
    });
    if (!criada) {
      redirect(urlEmbalagens(produtoId, "produto-nao-encontrado"));
    }
  } catch (erro) {
    if (erroCodigoDuplicado(erro)) {
      redirect(urlEmbalagens(produtoId, "codigo-duplicado"));
    }
    throw erro;
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(urlEmbalagens(produtoId, "adicionada"));
}

export async function atualizarEmbalagemProduto(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.editar");
  if (!atual) return;

  const produtoId = Number(formData.get("produtoId"));
  const embalagemId = Number(formData.get("embalagemId"));
  const dados = lerDadosEmbalagem(formData);
  if (
    !Number.isInteger(produtoId) ||
    produtoId <= 0 ||
    !Number.isInteger(embalagemId) ||
    embalagemId <= 0
  ) {
    return;
  }
  const quantidadeBase = validarDadosEmbalagem(dados);
  if (quantidadeBase === null) {
    redirect(urlEmbalagens(produtoId, "dados-invalidos"));
  }

  try {
    const atualizada = await prisma.$transaction(async (tx) => {
      await bloquearProdutoEmEdicao(tx, produtoId);
      const resultado = await tx.embalagemProduto.updateMany({
        where: { id: embalagemId, produtoId },
        data: {
          codigoBarras: dados.codigoBarras,
          unidade: dados.unidade,
          quantidadeBase,
        },
      });
      if (resultado.count === 0) return false;
      const embalagem = await tx.embalagemProduto.findUnique({
        where: { id: embalagemId },
        select: {
          codigoBarras: true,
          unidade: true,
          quantidadeBase: true,
          principal: true,
        },
      });
      if (!embalagem) return false;
      if (embalagem.principal) {
        await tx.produto.update({
          where: { id: produtoId },
          data: { codigoBarras: embalagem.codigoBarras },
        });
      }
      await registrarLog(
        {
          modulo: "PRODUTOS",
          acao: "ALTERAR",
          registroId: produtoId,
          descricao: `Embalagem do produto #${produtoId} alterada`,
          dados: {
            codigoBarras: embalagem.codigoBarras,
            unidade: embalagem.unidade,
            quantidadeBase: embalagem.quantidadeBase.toString(),
            principal: embalagem.principal,
          },
          usuarioId: atual.id,
        },
        tx
      );
      return true;
    });
    if (!atualizada) {
      redirect(urlEmbalagens(produtoId, "nao-encontrada"));
    }
  } catch (erro) {
    if (erroCodigoDuplicado(erro)) {
      redirect(urlEmbalagens(produtoId, "codigo-duplicado"));
    }
    throw erro;
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(urlEmbalagens(produtoId, "atualizada"));
}

export async function definirEmbalagemPrincipal(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.editar");
  if (!atual) return;

  const produtoId = Number(formData.get("produtoId"));
  const embalagemId = Number(formData.get("embalagemId"));
  if (
    !Number.isInteger(produtoId) ||
    produtoId <= 0 ||
    !Number.isInteger(embalagemId) ||
    embalagemId <= 0
  ) {
    return;
  }

  const embalagem = await prisma.$transaction(async (tx) => {
    await bloquearProdutoEmEdicao(tx, produtoId);
    const encontrada = await tx.embalagemProduto.findFirst({
      where: { id: embalagemId, produtoId },
      select: { codigoBarras: true, unidade: true },
    });
    if (!encontrada) return null;

    await tx.embalagemProduto.updateMany({
      where: { produtoId },
      data: { principal: false },
    });
    await tx.embalagemProduto.update({
      where: { id: embalagemId },
      data: { principal: true },
    });
    await tx.produto.update({
      where: { id: produtoId },
      data: { codigoBarras: encontrada.codigoBarras },
    });
    await registrarLog(
      {
        modulo: "PRODUTOS",
        acao: "ALTERAR",
        registroId: produtoId,
        descricao: `Embalagem principal do produto #${produtoId} alterada`,
        dados: {
          codigoBarras: encontrada.codigoBarras,
          unidade: encontrada.unidade,
        },
        usuarioId: atual.id,
      },
      tx
    );
    return encontrada;
  });

  if (!embalagem) redirect(urlEmbalagens(produtoId, "nao-encontrada"));
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(urlEmbalagens(produtoId, "principal-atualizada"));
}

export async function excluirEmbalagemProduto(
  formData: FormData
): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.editar");
  if (!atual) return;

  const produtoId = Number(formData.get("produtoId"));
  const embalagemId = Number(formData.get("embalagemId"));
  if (
    !Number.isInteger(produtoId) ||
    produtoId <= 0 ||
    !Number.isInteger(embalagemId) ||
    embalagemId <= 0
  ) {
    return;
  }

  const excluida = await prisma.$transaction(async (tx) => {
    await bloquearProdutoEmEdicao(tx, produtoId);
    const embalagem = await tx.embalagemProduto.findFirst({
      where: { id: embalagemId, produtoId },
      select: { codigoBarras: true, unidade: true, principal: true },
    });
    if (!embalagem) return false;

    await tx.embalagemProduto.delete({ where: { id: embalagemId } });
    if (embalagem.principal) {
      const proximaPrincipal = await tx.embalagemProduto.findFirst({
        where: { produtoId },
        orderBy: { codigoBarras: "asc" },
        select: { id: true, codigoBarras: true },
      });
      if (proximaPrincipal) {
        await tx.embalagemProduto.update({
          where: { id: proximaPrincipal.id },
          data: { principal: true },
        });
      }
      await tx.produto.update({
        where: { id: produtoId },
        data: { codigoBarras: proximaPrincipal?.codigoBarras ?? null },
      });
    }
    await registrarLog(
      {
        modulo: "PRODUTOS",
        acao: "EXCLUIR",
        registroId: produtoId,
        descricao: `Embalagem ${embalagem.unidade} removida do produto #${produtoId}`,
        dados: {
          codigoBarras: embalagem.codigoBarras,
          unidade: embalagem.unidade,
          principal: embalagem.principal,
        },
        usuarioId: atual.id,
      },
      tx
    );
    return true;
  });

  if (!excluida) {
    redirect(urlEmbalagens(produtoId, "nao-encontrada"));
  }
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(urlEmbalagens(produtoId, "excluida"));
}

// Produtos com relações funcionais não podem ser excluídos; nesses casos,
// a opção é desativar para preservar estoque, movimentações e históricos.
export async function desativarProduto(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.desativar");
  if (!atual) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const produto = await prisma.produto.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!produto) return;

  await prisma.$transaction(async (tx) => {
    await tx.produto.update({ where: { id }, data: { ativo: false } });
    await registrarLog(
      {
        modulo: "PRODUTOS",
        acao: "ALTERAR",
        registroId: id,
        descricao: `Produto "${produto.nome}" desativado`,
        usuarioId: atual.id,
      },
      tx
    );
  });

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
}

// Reativa um produto desativado
export async function reativarProduto(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.desativar");
  if (!atual) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const produto = await prisma.produto.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!produto) return;

  await prisma.$transaction(async (tx) => {
    await tx.produto.update({ where: { id }, data: { ativo: true } });
    await registrarLog(
      {
        modulo: "PRODUTOS",
        acao: "ALTERAR",
        registroId: id,
        descricao: `Produto "${produto.nome}" reativado`,
        usuarioId: atual.id,
      },
      tx
    );
  });

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
}

export async function excluirProduto(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("produtos.produto.excluir");
  if (!atual) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const resultado = await prisma.$transaction(async (tx) => {
    const produto = await tx.produto.findUnique({
      where: { id },
      select: { nome: true, imagemChave: true },
    });
    if (!produto) return { tipo: "inexistente" as const };

    const [vinculos, precos, estoques, movimentos, itensTransferencia] =
      await Promise.all([
      tx.produtoFornecedor.count({ where: { produtoId: id } }),
      tx.historicoPreco.count({ where: { produtoId: id } }),
      tx.estoque.count({ where: { produtoId: id } }),
      tx.movimentoEstoque.count({ where: { produtoId: id } }),
      tx.itemTransferencia.count({ where: { produtoId: id } }),
    ]);

    if (
      vinculos > 0 ||
      precos > 0 ||
      estoques > 0 ||
      movimentos > 0 ||
      itensTransferencia > 0
    ) {
      return { tipo: "em-uso" as const };
    }

    await tx.produto.delete({ where: { id } });
    await registrarLog(
      {
        modulo: "PRODUTOS",
        acao: "EXCLUIR",
        registroId: id,
        descricao: `Produto "${produto.nome}" excluído`,
        dados: { nome: produto.nome },
        usuarioId: atual.id,
      },
      tx
    );

    return { tipo: "excluido" as const, imagemChave: produto.imagemChave };
  });

  if (resultado.tipo === "em-uso") {
    redirect(`/produtos/${id}?erro=em-uso`);
  }
  if (resultado.tipo === "inexistente") redirect("/produtos");

  await excluirImagemSemFalhar(resultado.imagemChave);
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  redirect("/produtos");
}

// ------------------------------------------------------------
// Movimentação de estoque (RN-02)
// ENTRADA soma, SAIDA subtrai (sem deixar negativo) e CONTAGEM
// substitui a quantidade do local. Cada movimentação é guardada
// no histórico com data, hora e (quando houver login) o usuário.
// ------------------------------------------------------------

// Resultado do cálculo de uma linha de movimentação
type LinhaMovimento = {
  localEstoqueId: number;
  localNome: string;
  saldoAnterior: number;
  saldoNovo: number;
  // Valor gravado no histórico (na contagem, é o novo saldo)
  quantidadeRegistrada: string;
  quantidadeInformada: string;
};

// Aceita apenas um caminho interno (ex.: "/produtos?..."). Serve
// para o formulário dizer de qual tela veio (a lista ou a edição),
// sem permitir que o usuário redirecione para um site de fora.
function caminhoInternoValido(valor: string): string | null {
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//") || valor.includes("\\")) return null;
  return valor;
}

export async function registrarMovimento(
  _estadoAnterior: EstadoMovimento,
  formData: FormData
): Promise<EstadoMovimento> {
  const comentarioInformado = formData.get("comentario");
  const comentario =
    typeof comentarioInformado === "string"
      ? comentarioInformado.trim()
      : "";
  const estadoComComentario = { comentario };

  if (comentario.length > 500) {
    return {
      erroGeral: "O comentário pode ter no máximo 500 caracteres.",
      valores: lerQuantidades(formData),
      ...estadoComComentario,
    };
  }

  const atual = await verificarPermissao("estoque.movimento.registrar");
  if (!atual) {
    return {
      erroGeral: MENSAGEM_SEM_PERMISSAO,
      valores: lerQuantidades(formData),
      ...estadoComComentario,
    };
  }

  const valores = lerQuantidades(formData);
  const embalagemIdInformado = embalagemIdDoFormulario(formData);
  const produtoId = Number(formData.get("produtoId"));
  const tipo = String(formData.get("tipo") ?? "");

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return { erroGeral: "Produto inválido.", valores, ...estadoComComentario };
  }

  if (!TIPOS_MOVIMENTO.includes(tipo as TipoMovimento)) {
    return {
      erroGeral: "Tipo de movimentação inválido.",
      valores,
      ...estadoComComentario,
    };
  }

  const tipoMovimento = tipo as TipoMovimento;

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: {
      id: true,
      nome: true,
      unidade: true,
      embalagens: {
        select: {
          id: true,
          codigoBarras: true,
          unidade: true,
          quantidadeBase: true,
          principal: true,
        },
      },
    },
  });
  if (!produto) {
    return {
      erroGeral: "Produto não encontrado.",
      valores,
      ...estadoComComentario,
    };
  }

  let multiplicador = new Prisma.Decimal(1);
  let rotuloEmbalagem = produto.unidade;
  if (tipoMovimento !== "CONTAGEM" && embalagemIdInformado !== "") {
    const embalagemId = Number(embalagemIdInformado);
    if (!Number.isInteger(embalagemId) || embalagemId <= 0) {
      return {
        erroGeral: "Selecione uma embalagem válida.",
        valores,
        embalagemId: embalagemIdInformado,
        ...estadoComComentario,
      };
    }
    const embalagem = produto.embalagens.find(
      (item) => item.id === embalagemId
    );
    if (!embalagem) {
      return {
        erroGeral: "A embalagem selecionada não pertence a este produto.",
        valores,
        embalagemId: embalagemIdInformado,
        ...estadoComComentario,
      };
    }
    multiplicador = embalagem.quantidadeBase;
    rotuloEmbalagem = embalagem.unidade;
  }

  // Campos em branco = não mexer no local. Os demais precisam ser
  // números válidos. Entradas/saídas são convertidas para a unidade-base.
  const informadas: {
    localEstoqueId: number;
    valor: string;
    valorInformado: string;
  }[] = [];
  const erros: Record<string, string> = {};

  for (const [idDoLocal, texto] of Object.entries(valores)) {
    if (texto === "") continue;

    const valorInformado = normalizarDecimal(texto);
    if (valorInformado === null) {
      erros[idDoLocal] = MENSAGEM_NUMERO_INVALIDO;
      continue;
    }

    if (tipoMovimento !== "CONTAGEM" && Number(valorInformado) === 0) continue;

    const convertido = new Prisma.Decimal(valorInformado).mul(multiplicador);
    if (
      convertido.decimalPlaces() > 3 ||
      convertido.abs().greaterThan("999999999.999")
    ) {
      erros[idDoLocal] =
        `A quantidade convertida excede a precisão permitida em ${produto.unidade}.`;
      continue;
    }

    informadas.push({
      localEstoqueId: Number(idDoLocal),
      valor: convertido.toFixed(3),
      valorInformado,
    });
  }

  if (Object.keys(erros).length > 0) {
    return {
      erros,
      valores,
      embalagemId: embalagemIdInformado,
      ...estadoComComentario,
    };
  }

  if (informadas.length === 0) {
    return {
      erroGeral: "Informe a quantidade de pelo menos um local.",
      valores,
      embalagemId: embalagemIdInformado,
      ...estadoComComentario,
    };
  }

  const locais = await prisma.localEstoque.findMany({
    select: { id: true, nome: true },
  });
  const nomeDoLocal = new Map(locais.map((local) => [local.id, local.nome]));

  const estoquesAtuais = await prisma.estoque.findMany({
    where: { produtoId },
    select: { localEstoqueId: true, quantidade: true },
  });
  const saldoPorLocal = new Map(
    estoquesAtuais.map((estoque) => [
      estoque.localEstoqueId,
      Number(estoque.quantidade.toString()),
    ])
  );

  // Calcula o novo saldo de cada local e valida a saída
  const linhas: LinhaMovimento[] = [];
  const errosSaldo: Record<string, string> = {};

  for (const item of informadas) {
    const existe = saldoPorLocal.has(item.localEstoqueId);
    const saldoAnterior = saldoPorLocal.get(item.localEstoqueId) ?? 0;
    const valor = Number(item.valor);

    let saldoNovo: number;
    if (tipoMovimento === "ENTRADA") {
      saldoNovo = saldoAnterior + valor;
    } else if (tipoMovimento === "SAIDA") {
      saldoNovo = saldoAnterior - valor;
    } else {
      saldoNovo = valor; // CONTAGEM substitui
    }

    // Arredonda para 3 casas (mesma precisão do banco)
    saldoNovo = Number(saldoNovo.toFixed(3));

    if (tipoMovimento === "SAIDA" && saldoNovo < 0) {
      const nome = nomeDoLocal.get(item.localEstoqueId) ?? "local";
      errosSaldo[String(item.localEstoqueId)] =
        `Saída maior que o estoque atual (${formatarQuantidade(saldoAnterior)}) em ${nome}.`;
      continue;
    }

    // Contagem que não muda nada não gera histórico (evita ruído)
    const semMudanca =
      saldoNovo === saldoAnterior && (existe || saldoNovo === 0);
    if (tipoMovimento === "CONTAGEM" && semMudanca) continue;

    linhas.push({
      localEstoqueId: item.localEstoqueId,
      localNome: nomeDoLocal.get(item.localEstoqueId) ?? `Local ${item.localEstoqueId}`,
      saldoAnterior,
      saldoNovo,
      quantidadeRegistrada: item.valor,
      quantidadeInformada: item.valorInformado,
    });
  }

  if (Object.keys(errosSaldo).length > 0) {
    return {
      erros: errosSaldo,
      valores,
      embalagemId: embalagemIdInformado,
      ...estadoComComentario,
    };
  }

  if (linhas.length === 0) {
    return {
      erroGeral: "Nada a alterar: as quantidades informadas são iguais às atuais.",
      valores,
      embalagemId: embalagemIdInformado,
      ...estadoComComentario,
    };
  }

  const agora = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const locaisParaBloquear = linhas
        .map((linha) => linha.localEstoqueId)
        .sort((a, b) => a - b);
      for (const localEstoqueId of locaisParaBloquear) {
        await tx.estoque.upsert({
          where: {
            produtoId_localEstoqueId: { produtoId, localEstoqueId },
          },
          update: {},
          create: { produtoId, localEstoqueId, quantidade: "0" },
        });
      }
      await tx.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM estoque
          WHERE produto_id = ${produtoId}
            AND local_estoque_id IN (${Prisma.join(locaisParaBloquear)})
          ORDER BY local_estoque_id
          FOR UPDATE`
      );
      const saldosAtualizados = await tx.estoque.findMany({
        where: {
          produtoId,
          localEstoqueId: { in: locaisParaBloquear },
        },
        select: { localEstoqueId: true, quantidade: true },
      });
      const saldoAtualizadoPorLocal = new Map(
        saldosAtualizados.map((estoque) => [
          estoque.localEstoqueId,
          estoque.quantidade,
        ])
      );
      const reservas = await tx.$queryRaw<
        { localEstoqueId: number; quantidade: string }[]
      >(
        Prisma.sql`SELECT transferencia.origem_id AS "localEstoqueId",
            SUM(item.quantidade_enviada)::text AS quantidade
          FROM item_transferencia item
          INNER JOIN pedido_transferencia transferencia
            ON transferencia.id = item.transferencia_id
          WHERE item.produto_id = ${produtoId}
            AND transferencia.status = 'EM_TRANSITO'
            AND transferencia.origem_id IN (${Prisma.join(locaisParaBloquear)})
          GROUP BY transferencia.origem_id`
      );
      const reservaPorLocal = new Map(
        reservas.map((reserva) => [
          reserva.localEstoqueId,
          new Prisma.Decimal(reserva.quantidade),
        ])
      );

      for (const linha of linhas) {
        const saldoAnterior =
          saldoAtualizadoPorLocal.get(linha.localEstoqueId) ??
          new Prisma.Decimal(0);
        const quantidade = new Prisma.Decimal(linha.quantidadeRegistrada);
        const saldoNovo =
          tipoMovimento === "ENTRADA"
            ? saldoAnterior.add(quantidade)
            : tipoMovimento === "SAIDA"
              ? saldoAnterior.sub(quantidade)
              : quantidade;
        if (tipoMovimento === "SAIDA" && saldoNovo.lt(0)) {
          throw new ErroEstoqueReservado(
            `Saída maior que o estoque atual (${formatarQuantidade(Number(saldoAnterior.toString()))}) em ${linha.localNome}.`
          );
        }

        const reservado = reservaPorLocal.get(linha.localEstoqueId) ??
          new Prisma.Decimal(0);
        if (
          (tipoMovimento === "SAIDA" || tipoMovimento === "CONTAGEM") &&
          saldoNovo.lt(reservado)
        ) {
          throw new ErroEstoqueReservado(
            `Esta quantidade deixaria o saldo abaixo das ${formatarQuantidade(Number(reservado.toString()))} unidades reservadas para transferências em trânsito em ${linha.localNome}.`
          );
        }

        if (
          tipoMovimento === "CONTAGEM" &&
          saldoNovo.equals(saldoAnterior)
        ) {
          continue;
        }

        // Atualiza o estoque atual do local (RN-01: o total é a soma disto)
        await tx.estoque.update({
          where: {
            produtoId_localEstoqueId: {
              produtoId,
              localEstoqueId: linha.localEstoqueId,
            },
          },
          data: {
            quantidade: saldoNovo,
            dataUltimaContagem: agora,
          },
        });

        // RN-02: guarda a movimentação no histórico
        await tx.movimentoEstoque.create({
          data: {
            produtoId,
            localEstoqueId: linha.localEstoqueId,
            usuarioId: atual.id,
            tipo: tipoMovimento,
            quantidade: linha.quantidadeRegistrada,
            comentario: comentario || null,
            dataHora: agora,
          },
        });

        // Log geral do sistema
        await registrarLog(
          {
            modulo: "ESTOQUE",
            acao: tipoMovimento,
            registroId: produto.id,
            descricao: `${ROTULO_MOVIMENTO[tipoMovimento]} de ${formatarQuantidade(
              Number(linha.quantidadeInformada)
            )} ${rotuloEmbalagem} em "${produto.nome}" (${linha.localNome}) — equivalente a ${formatarQuantidade(
              Number(linha.quantidadeRegistrada)
            )} ${produto.unidade}${comentario ? ` — Comentário: ${comentario}` : ""}`,
            dados: {
              produtoId,
              localEstoqueId: linha.localEstoqueId,
              tipo: tipoMovimento,
              quantidadeInformada: Number(linha.quantidadeInformada),
              unidadeInformada: rotuloEmbalagem,
              quantidadeBase: Number(linha.quantidadeRegistrada),
              unidadeBase: produto.unidade,
              saldoAnterior: Number(saldoAnterior.toString()),
              saldoNovo: Number(saldoNovo.toString()),
              comentario: comentario || null,
            },
            usuarioId: atual.id,
          },
          tx
        );
      }
    });
  } catch (erro) {
    if (erro instanceof ErroEstoqueReservado) {
      return {
        erroGeral: erro.message,
        valores,
        embalagemId: embalagemIdInformado,
        ...estadoComComentario,
      };
    }
    console.error("Erro ao registrar movimentação:", erro);
    return {
      erroGeral: "Não foi possível registrar a movimentação. Tente novamente.",
      valores,
      embalagemId: embalagemIdInformado,
      ...estadoComComentario,
    };
  }

  // Para onde voltar: a lista manda a própria URL; sem ela, a
  // movimentação volta para a tela de edição do produto.
  const retorno = caminhoInternoValido(String(formData.get("retorno") ?? ""));

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(retorno ?? `/produtos/${produtoId}?mov=1`);
}
