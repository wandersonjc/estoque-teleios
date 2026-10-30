// ============================================================
// Módulo 1 - Cadastro de produtos: tela de edição
// RN-01 (total calculado), RN-02 (movimentação de estoque) e
// RN-03 (data da última movimentação), RN-23 (produto não é
// apagado, só desativado ou reativado).
// Cada bloco aparece conforme as permissões de quem está logado,
// mas a checagem de verdade é feita nas ações do servidor.
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";

import MovimentacaoEstoque from "../MovimentacaoEstoque";
import ProdutoForm from "../ProdutoForm";
import FormularioPrecoCotado from "@/app/fornecedores/FormularioPrecoCotado";
import FormularioVinculo from "@/app/fornecedores/FormularioVinculo";
import ListaVinculos from "@/app/fornecedores/ListaVinculos";
import { precosAtuais } from "@/app/fornecedores/tipos";

import { atualizarProduto, desativarProduto, reativarProduto } from "../actions";
import {
  calcularTotalEstoque,
  contagemDesatualizada,
  formatarDataBr,
  formatarDecimalBr,
  formatarQuantidade,
  ultimaContagem,
} from "../tipos";

// A tela precisa mostrar o produto e o estoque como estão no banco agora
export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
  searchParams,
}: PageProps<"/produtos/[id]">) {
  // Bloqueia a tela para quem não pode consultar produtos
  const atual = await exigirPermissao("produtos.produto.consultar");

  const podeEditar = atual.permissoes.has("produtos.produto.editar");
  const podeDesativar = atual.permissoes.has("produtos.produto.desativar");
  const podeMovimentar = atual.permissoes.has("estoque.movimento.registrar");
  const podeVincular = atual.permissoes.has("fornecedores.vinculo.gerenciar");
  const podeCotar = atual.permissoes.has("fornecedores.preco.cotar");

  const { id } = await params;
  const { salvo, mov, vinculo, preco } = await searchParams;

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  // RN-01: o produto e os locais vêm em consultas separadas.
  // Vínculos e preços (RN-09 e RN-10) vêm das tabelas
  // produto_fornecedor e historico_preco.
  const [produto, locais, vinculos, historico, fornecedoresAtivos] =
    await Promise.all([
      prisma.produto.findUnique({
        where: { id: numero },
        include: { estoques: true },
      }),
      prisma.localEstoque.findMany({
        select: { id: true, nome: true },
        orderBy: { id: "asc" },
      }),
      prisma.produtoFornecedor.findMany({
        where: { produtoId: numero },
        include: {
          fornecedor: { select: { id: true, nome: true, ativo: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.historicoPreco.findMany({
        where: { produtoId: numero },
        include: { fornecedor: { select: { nome: true } } },
        orderBy: [{ data: "desc" }, { id: "desc" }],
      }),
      prisma.fornecedor.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

  if (!produto) notFound();

  // Estoque atual de cada local, já em texto no padrão brasileiro
  // (o Decimal do Prisma nunca vai para o componente de cliente)
  const saldos: Record<string, string> = {};

  for (const estoque of produto.estoques) {
    const chave = String(estoque.localEstoqueId);
    saldos[chave] = formatarDecimalBr(estoque.quantidade.toString());
  }

  // RN-01: o total é a soma dos locais, sempre calculado
  const total = calcularTotalEstoque(produto.estoques);
  const dataUltima = ultimaContagem(produto.estoques);

  const idsFornecedoresVinculados = new Set(
    vinculos.map((item) => item.fornecedorId)
  );
  const fornecedoresParaVincular = fornecedoresAtivos.filter(
    (fornecedor) => !idsFornecedoresVinculados.has(fornecedor.id)
  );
  const fornecedoresParaPreco = vinculos.map((item) => ({
    id: item.fornecedorId,
    nome: item.fornecedor.nome,
  }));
  const mapaPrecos = precosAtuais(historico);
  const retornoProduto = `/produtos/${produto.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Editar produto</h1>
        <Link href="/produtos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Produto salvo com sucesso.
        </p>
      )}

      {mov === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Movimentação registrada com sucesso.
        </p>
      )}

      {vinculo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Vínculo salvo com sucesso.
        </p>
      )}

      {preco === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Preço cotado registrado.
        </p>
      )}

      {!produto.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este produto está inativo: ele não aparece nas contagens nem na lista
          de produtos ativos.
        </p>
      )}

      <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-base text-zinc-800">
        Total em estoque: <strong>{formatarQuantidade(total)}</strong>
        {" · "}
        {dataUltima ? (
          <>
            Última movimentação: {formatarDataBr(dataUltima)}
            {contagemDesatualizada(dataUltima) && " (desatualizada)"}
          </>
        ) : (
          "Sem movimentação registrada"
        )}
      </p>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Estoque por local
        </h2>
        {locais.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">
            Nenhum local de estoque cadastrado.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {locais.map((local) => (
              <li
                key={local.id}
                className="flex items-center justify-between gap-3 text-base text-zinc-800"
              >
                <span>{local.nome}</span>
                <strong>{saldos[String(local.id)] ?? "0"}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {podeMovimentar && (
        <div className="mt-4">
          <MovimentacaoEstoque
            produtoId={produto.id}
            locais={locais}
            saldos={saldos}
          />
        </div>
      )}

      <section className="mt-6 border-t border-zinc-200 pt-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Fornecedores deste produto
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Quem vende este produto, o código no fornecedor e o preço atual
          (o mais recente do histórico).
        </p>

        {podeVincular && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            <h3 className="text-base font-semibold text-zinc-900">
              Vincular fornecedor
            </h3>
            <div className="mt-3">
              <FormularioVinculo
                produtoId={produto.id}
                opcoes={fornecedoresParaVincular}
                retorno={`${retornoProduto}?vinculo=1`}
              />
            </div>
          </div>
        )}

        {podeCotar && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            <h3 className="text-base font-semibold text-zinc-900">
              Registrar preço cotado
            </h3>
            <div className="mt-3">
              <FormularioPrecoCotado
                produtoId={produto.id}
                opcoes={fornecedoresParaPreco}
                retorno={`${retornoProduto}?preco=1`}
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <ListaVinculos
            podeGerenciarVinculo={podeVincular}
            precosAtuais={mapaPrecos}
            vinculos={vinculos.map((item) => ({
              id: item.id,
              ativo: item.ativo,
              codigoNoFornecedor: item.codigoNoFornecedor,
              produtoId: item.produtoId,
              fornecedorId: item.fornecedorId,
              nome: item.fornecedor.nome,
            }))}
            historico={historico.map((item) => ({
              id: item.id,
              produtoId: item.produtoId,
              fornecedorId: item.fornecedorId,
              precoUnitario: item.precoUnitario.toString(),
              data: item.data,
              origem: item.origem,
              nomePar: item.fornecedor.nome,
            }))}
          />
        </div>
      </section>

      {podeEditar && (
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Dados do produto
          </h2>
          <div className="mt-3">
            <ProdutoForm
              acao={atualizarProduto}
              textoBotao="Salvar alterações"
              id={produto.id}
              valoresIniciais={{
                nome: produto.nome,
                unidade: produto.unidade,
                estoqueMinimo: formatarDecimalBr(produto.estoqueMinimo.toString()),
                codigoBarras: produto.codigoBarras ?? "",
                codigoErp: produto.codigoErp ?? "",
              }}
            />
          </div>
        </div>
      )}

      {podeDesativar && (
        <form
          action={produto.ativo ? desativarProduto : reativarProduto}
          className="mt-6"
        >
          <input type="hidden" name="id" value={produto.id} />
          <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
            {produto.ativo ? "Desativar produto" : "Reativar produto"}
          </BotaoAcao>
        </form>
      )}
    </main>
  );
}
