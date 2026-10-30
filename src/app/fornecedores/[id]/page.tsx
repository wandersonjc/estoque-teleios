// ============================================================
// Módulo 2 - Tela do fornecedor
// Dados cadastrais, vínculos com produtos (RN-09) e preços
// cotados (RN-10 e RN-11).
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { formatarDecimalBr } from "@/app/produtos/tipos";

import FormularioFornecedor from "../FormularioFornecedor";
import FormularioPrecoCotado from "../FormularioPrecoCotado";
import FormularioVinculo from "../FormularioVinculo";
import ListaVinculos from "../ListaVinculos";
import {
  atualizarFornecedor,
  desativarFornecedor,
  reativarFornecedor,
} from "../actions";
import { formatarMoedaOpcional, precosAtuais } from "../tipos";

export const dynamic = "force-dynamic";

export default async function PaginaEditarFornecedor({
  params,
  searchParams,
}: PageProps<"/fornecedores/[id]">) {
  const atual = await exigirPermissao("fornecedores.fornecedor.consultar");

  const { id } = await params;
  const avisos = await searchParams;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const podeEditar = atual.permissoes.has("fornecedores.fornecedor.editar");
  const podeDesativar = atual.permissoes.has(
    "fornecedores.fornecedor.desativar"
  );
  const podeVincular = atual.permissoes.has("fornecedores.vinculo.gerenciar");
  const podeCotar = atual.permissoes.has("fornecedores.preco.cotar");

  const [fornecedor, produtosAtivos] = await Promise.all([
    prisma.fornecedor.findUnique({
      where: { id: numero },
      include: {
        produtos: {
          include: {
            produto: { select: { id: true, nome: true, ativo: true } },
          },
          orderBy: { produto: { nome: "asc" } },
        },
        historicoPrecos: {
          orderBy: [{ data: "desc" }, { id: "desc" }],
          include: {
            produto: { select: { nome: true } },
          },
        },
      },
    }),
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  if (!fornecedor) notFound();

  const idsVinculados = new Set(
    fornecedor.produtos.map((vinculo) => vinculo.produtoId)
  );
  const produtosParaVincular = produtosAtivos.filter(
    (produto) => !idsVinculados.has(produto.id)
  );
  const produtosParaPreco = fornecedor.produtos.map((vinculo) => ({
    id: vinculo.produtoId,
    nome: vinculo.produto.nome,
  }));

  const mapaPrecos = precosAtuais(fornecedor.historicoPrecos);
  const retorno = `/fornecedores/${fornecedor.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">
          {podeEditar ? "Editar fornecedor" : "Fornecedor"}
        </h1>
        <Link href="/fornecedores" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {avisos.salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Fornecedor salvo com sucesso.
        </p>
      )}
      {avisos.vinculo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Vínculo salvo com sucesso.
        </p>
      )}
      {avisos.preco === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Preço cotado registrado.
        </p>
      )}

      {!fornecedor.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este fornecedor está inativo.
        </p>
      )}

      {podeEditar ? (
        <div className="mt-2">
          <FormularioFornecedor
            acao={atualizarFornecedor}
            textoBotao="Salvar alterações"
            id={fornecedor.id}
            valoresIniciais={{
              nome: fornecedor.nome,
              contato: fornecedor.contato ?? "",
              prazoEntregaDias: fornecedor.prazoEntregaDias?.toString() ?? "",
              valorMinimoPedido: fornecedor.valorMinimoPedido
                ? formatarDecimalBr(fornecedor.valorMinimoPedido.toString())
                : "",
              frete: fornecedor.frete
                ? formatarDecimalBr(fornecedor.frete.toString())
                : "",
            }}
          />
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-base sm:grid-cols-2">
          <div>
            <dt className="text-sm text-zinc-500">Nome</dt>
            <dd className="font-medium text-zinc-900">{fornecedor.nome}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Contato</dt>
            <dd className="font-medium text-zinc-900">
              {fornecedor.contato || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Prazo de entrega</dt>
            <dd className="font-medium text-zinc-900">
              {fornecedor.prazoEntregaDias !== null
                ? `${fornecedor.prazoEntregaDias} dias`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Pedido mínimo</dt>
            <dd className="font-medium text-zinc-900">
              {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Frete</dt>
            <dd className="font-medium text-zinc-900">
              {formatarMoedaOpcional(fornecedor.frete)}
            </dd>
          </div>
        </dl>
      )}

      {podeDesativar && (
        <form
          action={fornecedor.ativo ? desativarFornecedor : reativarFornecedor}
          className="mt-4"
        >
          <input type="hidden" name="id" value={fornecedor.id} />
          <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
            {fornecedor.ativo ? "Desativar fornecedor" : "Reativar fornecedor"}
          </BotaoAcao>
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">
          Produtos deste fornecedor
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Um produto pode ter vários fornecedores. O vínculo guarda o código
          no fornecedor e se está ativo.
        </p>

        {podeVincular && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            <h3 className="text-base font-semibold text-zinc-900">
              Vincular produto
            </h3>
            <div className="mt-3">
              <FormularioVinculo
                fornecedorId={fornecedor.id}
                opcoes={produtosParaVincular}
                retorno={`${retorno}?vinculo=1`}
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <ListaVinculos
            podeGerenciarVinculo={podeVincular}
            precosAtuais={mapaPrecos}
            vinculos={fornecedor.produtos.map((vinculo) => ({
              id: vinculo.id,
              ativo: vinculo.ativo,
              codigoNoFornecedor: vinculo.codigoNoFornecedor,
              produtoId: vinculo.produtoId,
              fornecedorId: vinculo.fornecedorId,
              nome: vinculo.produto.nome,
            }))}
            historico={fornecedor.historicoPrecos.map((item) => ({
              id: item.id,
              produtoId: item.produtoId,
              fornecedorId: item.fornecedorId,
              precoUnitario: item.precoUnitario.toString(),
              data: item.data,
              origem: item.origem,
              nomePar: item.produto.nome,
            }))}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Preços cotados</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Preço informado pelo comprador, sem pedido. O preço atual de cada
          produto é o registro mais recente.
        </p>

        {podeCotar && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
            <FormularioPrecoCotado
              fornecedorId={fornecedor.id}
              opcoes={produtosParaPreco}
              retorno={`${retorno}?preco=1`}
            />
          </div>
        )}
      </section>
    </main>
  );
}
