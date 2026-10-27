# Sistema de Pedidos de Compra: Regras de Negócio

> Este arquivo é a **fonte de verdade** das regras do sistema. Se o código e este documento divergirem, o documento vence. Se alguma regra não estiver aqui ou estiver ambígua, **pergunte antes de inventar**.

## 0. Como a IA deve trabalhar neste projeto

- Siga estas regras à risca e **não crie regras novas** por conta própria.
- Trabalhe **uma etapa por vez** (seção 10). Não adiantar etapas futuras.
- Entregue código **completo e pronto para usar**, com **comentários explicativos em português**.
- Use TypeScript em modo `strict`. Nomes de tabelas e campos em português, sem acento (ex.: `pedido_compra`, `estoque_minimo`).
- Valores em dinheiro: **nunca usar `float`**. Usar `Decimal` (ou inteiro em centavos).
- Interface em português do Brasil (pt-BR), moeda em R$, datas no formato dd/mm/aaaa, fuso `America/Sao_Paulo`.
- Interface **responsiva e pensada primeiro para celular** (o estoquista usa em pé, no depósito).
- Dúvida sobre uma regra? Veja a seção 11 (decisões pendentes) e pergunte ao usuário.

## 1. Contexto

Mercado com 3 locais de estoque que compra de vários fornecedores. O **estoquista** conta os produtos; quando algum está baixo, o **comprador** monta o pedido ao fornecedor. Para o pedido compensar, o comprador também inclui os **outros produtos baixos** daquele fornecedor, mesmo que ainda não estejam em falta.

O sistema deve:

1. Registrar o estoque de cada produto nos 3 locais e mostrar o **total**.
2. Avisar quais produtos estão baixos.
3. Comparar preços entre fornecedores e montar pedidos de compra.
4. Registrar cada pedido: quem fez, data, fornecedor, previsão de entrega e produtos.

## 2. Perfis de usuário

| Perfil | Pode |
|---|---|
| **Estoquista** | Registrar contagem de estoque, consultar estoque e produtos baixos |
| **Comprador** | Tudo do estoquista (consulta), mais: cadastrar produtos e fornecedores, definir preços e mínimos, criar e acompanhar pedidos, registrar recebimento |

Todo registro importante (contagem, pedido, preço) guarda **quem fez** e **quando** (data e hora).

## 3. Locais de estoque

Existem exatamente 3, cadastrados de início:

- Loja Nova Iguaçu
- Loja Mesquita
- Galpão

## 4. Regras de estoque

- **RN-01. Total calculado:** o estoque total de um produto é a **soma das quantidades nos 3 locais**. O total **não é gravado**, é sempre calculado.
- **RN-02. Estoque por contagem:** a quantidade de um produto em um local é definida pela **contagem** feita pelo estoquista. Cada contagem **substitui** a quantidade atual daquele local e é guardada em histórico (produto, local, quantidade, usuário, data e hora).
- **RN-03. Data da contagem visível:** em qualquer tela que mostre quantidade, mostrar também a **data da última contagem**, destacando contagens antigas (ex.: mais de 30 dias, valor configurável).
- **RN-04. Entradas por recebimento:** quando um pedido é recebido, a quantidade recebida **soma** ao estoque do local de entrada (padrão: Galpão).
- **RN-05. Estoque mínimo:** cada produto tem **um estoque mínimo único**, comparado com o **total** (soma dos 3 locais), e não com cada local.
- **RN-06. Produto baixo:** um produto está **baixo** quando seu total é menor ou igual ao estoque mínimo.
- **RN-07. Pedido a caminho:** quantidades de pedidos com status *Enviado* (ainda não recebidos) contam como **"a caminho"**. Para decidir se um produto precisa de novo pedido, considerar `total + a caminho`. O painel mostra a quantidade a caminho ao lado do total.
- **RN-08. Estoque do ERP não é usado:** os números de estoque do ERP não são confiáveis. O sistema **nunca importa quantidade de estoque** do ERP.

## 5. Regras de fornecedores e preços

- **RN-09. Muitos para muitos:** um produto pode ter **um ou vários fornecedores**, e um fornecedor vende vários produtos. A ligação (`produto_fornecedor`) guarda o código do produto no fornecedor e se ele está ativo.
- **RN-10. Histórico de preços:** todo preço fica em histórico, com: produto, fornecedor, preço unitário, data, **origem** e, se houver, o pedido de origem.
  - Origem **pago:** gravado automaticamente ao **confirmar um pedido** (RN-18).
  - Origem **cotado:** digitado manualmente pelo comprador numa consulta, **sem pedido**.
- **RN-11. Preço atual:** o preço atual de um produto em um fornecedor é o **registro mais recente** do histórico (por produto e fornecedor).
- **RN-12. Preço sugerido no pedido:** ao montar um pedido, o campo de preço unitário vem **preenchido com o preço atual** daquele fornecedor, e o comprador pode **editar na hora** se o valor mudou.

## 6. Regras de comparação e montagem do pedido

- **RN-13. Critério único de escolha: menor preço unitário.** Para cada produto baixo, listar os fornecedores ordenados do **mais barato para o mais caro**, mostrando origem (pago ou cotado) e data de cada preço. O mais barato vem **pré-selecionado**.
- **RN-14. Fornecedor sem preço:** aparece no fim da lista, marcado como "sem preço". Não é pré-selecionado.
- **RN-15. Troca manual:** o comprador pode trocar o fornecedor escolhido e ajustar a quantidade de qualquer item.
- **RN-16. Um pedido por fornecedor:** os itens são agrupados pelo fornecedor escolhido e o sistema gera **um pedido (rascunho) por fornecedor**, mostrando o total de cada um.
- **RN-17. Pedido mínimo do fornecedor:** cada fornecedor tem um campo opcional de **valor mínimo de pedido** (e opcionalmente frete). Se o total do pedido ficar **abaixo do mínimo**, o sistema **avisa e não bloqueia**, e sugere incluir outros produtos baixos que **esse fornecedor também vende** e que ainda não estão no pedido.
- **RN-18. Evitar duplicidade:** um produto já incluído no pedido de um fornecedor aparece marcado como **"já em pedido"** nas listas dos outros fornecedores.

## 7. Regras do pedido de compra

Campos obrigatórios: **comprador** (usuário logado), **data da compra** (data da confirmação), **fornecedor**, **previsão de entrega** (padrão: data da confirmação + prazo médio do fornecedor, editável) e **itens** (produto, quantidade, preço unitário).

**Status e transições permitidas:**

| De | Para |
|---|---|
| Rascunho | Enviado, Cancelado |
| Enviado | Recebido, Cancelado |
| Recebido, Cancelado | (final, não muda mais) |

- **RN-19. Confirmar pedido** (Rascunho para Enviado) grava no histórico o **preço de cada item** (origem *pago*), registra data de compra e comprador.
- **RN-20. Edição:** só pedidos em *Rascunho* podem ter itens alterados. Pedidos *Enviado*, *Recebido* ou *Cancelado* ficam travados para edição de itens.
- **RN-21. Recebimento:** ao marcar como *Recebido*, o usuário informa a quantidade recebida por item (pode ser **parcial**) e o local de entrada. A quantidade soma ao estoque (RN-04).

## 8. Regras do catálogo de produtos

- **RN-22.** O produto tem um campo opcional **`codigo_erp`**, **único** quando preenchido. Será a chave para importar e atualizar produtos do ERP no futuro, sem duplicar.
- **RN-23.** No início, produtos são **cadastrados à mão** (testes com 20 a 30 itens de 1 ou 2 fornecedores principais).
- **RN-24.** A importação de planilha do ERP (Superus) é **etapa futura**. Ela importa **somente cadastro** (código, descrição, unidade, código de barras, custo), nunca estoque.

## 9. Modelo de dados conceitual

| Entidade | Campos principais |
|---|---|
| `usuario` | nome, e-mail, senha (hash), perfil |
| `produto` | nome, unidade, codigo_barras, codigo_erp (opcional, único), estoque_minimo, ativo |
| `fornecedor` | nome, contato, prazo_entrega_dias, valor_minimo_pedido, frete (opcionais), ativo |
| `produto_fornecedor` | produto, fornecedor, codigo_no_fornecedor, ativo |
| `local_estoque` | nome (Loja Nova Iguaçu, Loja Mesquita, Galpão) |
| `estoque` | produto, local, quantidade, data_ultima_contagem |
| `contagem_estoque` | produto, local, quantidade, usuario, data_hora (histórico) |
| `historico_preco` | produto, fornecedor, preco_unitario, data, origem (pago ou cotado), pedido (opcional) |
| `pedido_compra` | comprador, fornecedor, data_compra, previsao_entrega, status, observacao |
| `item_pedido` | pedido, produto, quantidade, preco_unitario, quantidade_recebida |

## 10. Etapas de construção (uma por vez)

1. **Cadastros:** usuários e perfis, locais de estoque, fornecedores, produtos e vínculo produto x fornecedor.
2. **Contagem e alerta:** tela de contagem por local, total calculado, painel de produtos baixos.
3. **Comparativo e pedido:** comparação de preços, divisão por fornecedor, aviso de pedido mínimo, gravação do preço ao confirmar.
4. **Acompanhamento:** status do pedido, previsão de entrega, recebimento com entrada no estoque.
5. **Futuro:** importação de planilha do ERP, relatório de vendas, correção de preço no recebimento.

## 11. Decisões pendentes (perguntar ao usuário antes de implementar)

- **Quantidade sugerida no pedido:** hoje não existe regra. Proposta: campo opcional `estoque_ideal` por produto, e a sugestão seria `estoque_ideal - (total + a caminho)`. Sem esse campo, o comprador digita a quantidade.
- **Quantidades decimais:** alguns produtos podem ser vendidos por peso (kg). Proposta: aceitar decimais com 3 casas (`Decimal(12,3)`).
- **"Baixo" é menor ou igual ao mínimo** (RN-06). Confirmar se o correto é "menor que".
- **Quem cadastra produtos e fornecedores:** assumido o comprador (seção 2). Confirmar.
- **Banco de dados:** PostgreSQL (recomendado) ou MySQL.

## 12. Fora do escopo da primeira versão

- Emissão de nota fiscal e pagamentos.
- Integração automática com o ERP (API ou banco).
- Abatimento de estoque por vendas.
- Correção de preço no recebimento (nota diferente do pedido).
- Comparação considerando frete e pedido mínimo no cálculo do "mais barato" (nesta versão, só preço unitário).
