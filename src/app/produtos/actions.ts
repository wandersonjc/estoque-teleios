"use server";

// ============================================================
// Módulo 1 - Estoque: ações do servidor
// Cadastro/edição de produto e movimentação de estoque
// (entrada soma, saída subtrai e contagem substitui).
// Toda a validação é feita aqui (a do navegador é só conveniência).
// TODA ação confere a permissão no servidor: esconder o botão
// não basta (ver src/lib/autorizacao.ts).
// Regras: RN-01, RN-02, RN-03, RN-05, RN-22 e RN-23.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
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

// Lê os campos do formulário. Tudo chega como texto.
function lerValores(formData: FormData): ValoresFormularioProduto {
  const texto = (campo: string): string => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };

  return {
    nome: texto("nome"),
    unidade: texto("unidade").toUpperCase(),
    estoqueMinimo: texto("estoqueMinimo"),
    codigoBarras: texto("codigoBarras"),
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

type ProdutoValidado = {
  nome: string;
  unidade: string;
  codigoBarras: string | null;
  codigoErp: string | null;
  estoqueMinimo: string;
};

type ResultadoValidacao =
  | { ok: true; dados: ProdutoValidado }
  | { ok: false; estado: EstadoFormularioProduto };

const MENSAGEM_NUMERO_INVALIDO =
  "Informe um número maior ou igual a zero, com até 9 dígitos e 3 casas decimais.";

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

  // RN-05: estoque mínimo único por produto, comparado com o total dos locais
  const estoqueMinimo = normalizarDecimal(valores.estoqueMinimo);
  if (estoqueMinimo === null) {
    erros.estoqueMinimo = MENSAGEM_NUMERO_INVALIDO;
  }

  const codigoBarras = valores.codigoBarras === "" ? null : valores.codigoBarras;
  if (codigoBarras !== null && codigoBarras.length > LIMITE_CODIGO_BARRAS) {
    erros.codigoBarras = `O código de barras pode ter no máximo ${LIMITE_CODIGO_BARRAS} caracteres.`;
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
      codigoBarras,
      codigoErp,
      estoqueMinimo: estoqueMinimo ?? "0",
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

  try {
    await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome: validacao.dados.nome,
          unidade: validacao.dados.unidade,
          codigoBarras: validacao.dados.codigoBarras,
          codigoErp: validacao.dados.codigoErp,
          estoqueMinimo: validacao.dados.estoqueMinimo,
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
            estoqueMinimo: produto.estoqueMinimo.toString(),
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
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

  const validacao = validarProduto(valores);
  if (!validacao.ok) return validacao.estado;

  const antes = await prisma.produto.findUnique({
    where: { id },
    select: {
      nome: true,
      unidade: true,
      estoqueMinimo: true,
      codigoBarras: true,
      codigoErp: true,
    },
  });

  if (!antes) return { erroGeral: "Produto não encontrado.", valores };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id },
        data: {
          nome: validacao.dados.nome,
          unidade: validacao.dados.unidade,
          codigoBarras: validacao.dados.codigoBarras,
          codigoErp: validacao.dados.codigoErp,
          estoqueMinimo: validacao.dados.estoqueMinimo,
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
              estoqueMinimo: antes.estoqueMinimo.toString(),
              codigoBarras: antes.codigoBarras,
              codigoErp: antes.codigoErp,
            },
            depois: {
              nome: validacao.dados.nome,
              unidade: validacao.dados.unidade,
              estoqueMinimo: validacao.dados.estoqueMinimo,
              codigoBarras: validacao.dados.codigoBarras,
              codigoErp: validacao.dados.codigoErp,
            },
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  redirect(`/produtos/${id}?salvo=1`);
}

// RN-23: produto nunca é apagado, só desativado, porque depois
// tem estoque, movimentações e pedidos ligados a ele.
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
  const atual = await verificarPermissao("estoque.movimento.registrar");
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores: lerQuantidades(formData) };
  }

  const valores = lerQuantidades(formData);
  const produtoId = Number(formData.get("produtoId"));
  const tipo = String(formData.get("tipo") ?? "");

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return { erroGeral: "Produto inválido.", valores };
  }

  if (!TIPOS_MOVIMENTO.includes(tipo as TipoMovimento)) {
    return { erroGeral: "Tipo de movimentação inválido.", valores };
  }

  const tipoMovimento = tipo as TipoMovimento;

  // Campos em branco = não mexer no local. Os demais precisam ser
  // números válidos. Entrada/saída de zero não mudam nada.
  const informadas: { localEstoqueId: number; valor: string }[] = [];
  const erros: Record<string, string> = {};

  for (const [idDoLocal, texto] of Object.entries(valores)) {
    if (texto === "") continue;

    const valor = normalizarDecimal(texto);
    if (valor === null) {
      erros[idDoLocal] = MENSAGEM_NUMERO_INVALIDO;
      continue;
    }

    if (tipoMovimento !== "CONTAGEM" && Number(valor) === 0) continue;

    informadas.push({ localEstoqueId: Number(idDoLocal), valor });
  }

  if (Object.keys(erros).length > 0) return { erros, valores };

  if (informadas.length === 0) {
    return {
      erroGeral: "Informe a quantidade de pelo menos um local.",
      valores,
    };
  }

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { id: true, nome: true },
  });
  if (!produto) return { erroGeral: "Produto não encontrado.", valores };

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
    });
  }

  if (Object.keys(errosSaldo).length > 0) return { erros: errosSaldo, valores };

  if (linhas.length === 0) {
    return {
      erroGeral: "Nada a alterar: as quantidades informadas são iguais às atuais.",
      valores,
    };
  }

  const agora = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const linha of linhas) {
        // Atualiza o estoque atual do local (RN-01: o total é a soma disto)
        await tx.estoque.upsert({
          where: {
            produtoId_localEstoqueId: {
              produtoId,
              localEstoqueId: linha.localEstoqueId,
            },
          },
          update: {
            quantidade: String(linha.saldoNovo),
            dataUltimaContagem: agora,
          },
          create: {
            produtoId,
            localEstoqueId: linha.localEstoqueId,
            quantidade: String(linha.saldoNovo),
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
              Number(linha.quantidadeRegistrada)
            )} em "${produto.nome}" (${linha.localNome})`,
            dados: {
              produtoId,
              localEstoqueId: linha.localEstoqueId,
              tipo: tipoMovimento,
              quantidade: Number(linha.quantidadeRegistrada),
              saldoAnterior: linha.saldoAnterior,
              saldoNovo: linha.saldoNovo,
            },
            usuarioId: atual.id,
          },
          tx
        );
      }
    });
  } catch (erro) {
    console.error("Erro ao registrar movimentação:", erro);
    return {
      erroGeral: "Não foi possível registrar a movimentação. Tente novamente.",
      valores,
    };
  }

  // Para onde voltar: a lista manda a própria URL; sem ela, a
  // movimentação volta para a tela de edição do produto.
  const retorno = caminhoInternoValido(String(formData.get("retorno") ?? ""));

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(retorno ?? `/produtos/${produtoId}?mov=1`);
}
