# Sistema de Pedidos de Compra: Regras de Negócio

> Este arquivo é a **fonte de verdade** das regras do sistema. Se o código e este documento divergirem, o documento vence. Se alguma regra não estiver aqui ou estiver ambígua, **pergunte antes de inventar**.

## 0. Como a IA deve trabalhar neste projeto

- Siga estas regras à risca e **não crie regras novas** por conta própria.
- Trabalhe **um módulo e um item por vez** (seção 10). Não adiantar itens futuros.
- **Ordem dos módulos (definida pelo usuário):** 1) Estoque, 2) Fornecedores, 3) Pedidos.
- **Stack:** Next.js, TypeScript, Prisma 7, PostgreSQL (Aiven), hospedagem na Vercel.
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

## 2. Usuários, login e permissões

**Não existem perfis nem grupos.** O acesso de cada usuário é definido por **permissões individuais**, concedidas na tela `/permissoes` (Módulos e Permissões). Uma permissão que não foi concedida está **negada**.

O catálogo de permissões é organizado em **módulo → funcionalidade → operação**. Cada permissão tem um **código único e estável** no formato `modulo.funcionalidade.operacao` (ex.: `produtos.produto.criar`).

Exemplos de permissões já existentes: `produtos.produto.consultar`, `produtos.produto.criar`, `produtos.produto.editar`, `produtos.produto.desativar`, `estoque.movimento.registrar`, `locais.local.*`, `usuarios.usuario.*` e `permissoes.permissao.*`.

- **RN-27. Gestão de usuários:** na tela `/usuarios` são **cadastrados, alterados, desativados/reativados e excluídos** os usuários (nome, e-mail e senha). O usuário **só pode ser excluído quando não tem nenhuma movimentação nem registro no log**; se tiver, a exclusão é bloqueada e ele só pode ser desativado, para não perder o histórico. O **e-mail é único**. A **senha é guardada como hash** (nunca em texto puro) e nunca aparece nas telas nem no log do sistema. Na edição, o campo de senha em branco **mantém a senha atual**.
- **RN-28. Login e sessão:** o acesso ao sistema exige **e-mail e senha**. A sessão fica guardada no banco (tabela `sessao`) e é identificada por um token aleatório em cookie **httpOnly**, com validade de **7 dias**. Usuário **inativo não entra**. O botão **Sair** encerra a sessão.
- **RN-29. Permissões por usuário:** a tela `/permissoes` (ver seção 2.1) mostra uma **matriz expansível** por módulo, funcionalidade e operação, com caixas de seleção para **conceder (marcar)** e **revogar (desmarcar)** as permissões de um usuário escolhido na busca do topo.
- **RN-30. Autorização no servidor:** toda página e toda operação confere a permissão **no servidor** (funções `exigirPermissao` e `verificarPermissao` em `src/lib/autorizacao.ts`). Esconder um botão na tela **não** é suficiente: tentar executar a ação sem permissão é bloqueado no backend.
- **RN-31. Permissões nascem negadas:** uma permissão nova (recem-registrada no catálogo) **não é concedida a ninguém** até que um administrador marque a caixa e salve.
- **RN-32. Trava contra auto-bloqueio:** ninguém pode remover de si mesmo a permissão `permissoes.permissao.conceder`, para não trancar todos para fora da administração.

Todo registro importante (movimentação de estoque, pedido, preço, ação administrativa) guarda **quem fez** e **quando** (data e hora).

### 2.1 Como registrar uma permissão nova

Este é o **mecanismo padronizado** para que a matriz da tela `/permissoes` cresça sozinha, **sem alterar o componente visual**. A **fonte de verdade** é o arquivo `src/lib/permissoes.ts` (a matriz é gerada a partir do catálogo gravado no banco, nunca de uma lista fixa no frontend).

1. **Registre no catálogo:** acrescente um item em `CATALOGO_DE_PERMISSOES` (`src/lib/permissoes.ts`) com um `codigo` único e estável, o `modulo`, a `funcionalidade`, a `operacao`, uma `descricao` legível e a `ordem` de exibição.
2. **Use o código:** no backend, proteja a operação com `exigirPermissao("novo.codigo")` (páginas) ou `verificarPermissao("novo.codigo")` (ações). No frontend, controle menus, páginas e botões com `usuario.permissoes.has("novo.codigo")` ou inclua o item em `MENU_PRINCIPAL`.
3. **Sincronize:** rode `npm run db:seed` **ou** apenas abra a tela `/permissoes` — o **sincronizador** (`sincronizarCatalogoDePermissoes`) faz `upsert` de cada item do catálogo na tabela `permissao`.

Resultado: a nova permissão aparece automaticamente na matriz, **negada para todos**, até ser concedida explicitamente. O sincronizador pode ser rodado quantas vezes quiser: não duplica nada e não apaga concessões já feitas.

## 3. Locais de estoque

Começam cadastrados os 3 locais abaixo, criados pelo script `scripts/seed.ts`:

- Loja Nova Iguaçu
- Loja Mesquita
- Galpão

- **RN-25. Locais gerenciáveis:** o comprador pode **cadastrar, renomear e excluir** locais de estoque na tela `/locais`. Um local só pode ser excluído quando **não tem estoque nem movimentações**; se tiver, a exclusão é bloqueada para não perder o histórico. Renomear um local não altera as movimentações já gravadas.

## 4. Regras de estoque

- **RN-01. Total calculado:** o estoque total de um produto é a **soma das quantidades nos locais de estoque**. O total **não é gravado**, é sempre calculado.
- **RN-02. Movimentação de estoque:** a quantidade de um produto em um local muda por **movimentação**, feita na tela do produto por um popup com um campo por local de estoque. Há três tipos de movimentação:
  - **Entrada:** a quantidade informada é **somada** ao estoque atual do local.
  - **Saída:** a quantidade informada é **subtraída** do estoque atual do local; a saída não pode deixar o local negativo.
  - **Contagem:** a quantidade informada **substitui** o estoque atual do local.
  Cada movimentação é guardada em histórico (`movimento_estoque`: produto, local, tipo, quantidade, usuário, data e hora). Os popups de movimentação só aparecem **depois que o produto é salvo**. A quantidade **não** é informada no cadastro do produto: ele nasce zerado. Enquanto não existir login (item 5), o usuário da movimentação fica em branco.
- **RN-03. Data da movimentação visível:** em qualquer tela que mostre quantidade, mostrar também a **data da última movimentação**, destacando movimentações antigas (ex.: mais de 30 dias, valor configurável).
- **RN-04. Entradas por recebimento:** quando um pedido é recebido, a quantidade recebida **soma** ao estoque do local de entrada (padrão: Galpão).
- **RN-05. Estoque mínimo:** cada produto tem **um estoque mínimo único**, comparado com o **total** (soma dos 3 locais), e não com cada local.
- **RN-06. Produto baixo:** um produto está **baixo** quando seu total é menor ou igual ao estoque mínimo.
- **RN-07. Pedido a caminho:** quantidades de pedidos com status *Enviado* (ainda não recebidos) contam como **"a caminho"**. Para decidir se um produto precisa de novo pedido, considerar `total + a caminho`. O painel mostra a quantidade a caminho ao lado do total. **Só passa a valer no Módulo 3**, quando existirem pedidos. Antes disso, o painel de produtos baixos usa apenas o total.
- **RN-08. Estoque do ERP não é usado:** os números de estoque do ERP não são confiáveis. O sistema **nunca importa quantidade de estoque** do ERP.
- **RN-26. Histórico geral de ações (log):** toda ação relevante de qualquer módulo (produtos, estoque, locais, fornecedores, pedidos, usuários) grava uma linha na tabela `log_sistema`, com **módulo**, **ação** (criar, alterar, excluir, entrada, saída, contagem, recebimento), **descrição** legível, **registro afetado**, **detalhes** (JSON, guardando o "antes x depois" quando fizer sentido), **usuário** (em branco até existir login) e **data/hora**. O log é gravado na mesma transação da ação, para nunca ficar pela metade.

## 5. Regras de fornecedores e preços

- **RN-09. Muitos para muitos:** um produto pode ter **um ou vários fornecedores**, e um fornecedor vende vários produtos. A ligação (`produto_fornecedor`) guarda o código do produto no fornecedor e se ele está ativo. O vínculo só pode ser excluído permanentemente enquanto não houver preço registrado nem uso em compras; depois disso, pode ser desativado, mas deve ser mantido para preservar o histórico.
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
- **RN-23.** No início, produtos são **cadastrados à mão** (testes com 20 a 30 itens).
- **RN-24.** A importação de planilha do ERP (Superus) faz parte do **Módulo 1** e deve estar pronta **antes do uso real** pelo estoquista, para o catálogo completo estar cadastrado. Ela importa **somente cadastro** (código, descrição, unidade, código de barras, custo), nunca estoque.

## 9. Modelo de dados conceitual

| Entidade | Módulo | Campos principais |
|---|---|---|
| `usuario` | 1 | nome, e-mail, senha (hash), ativo |
| `permissao` | 1 | codigo (único), modulo, funcionalidade, operacao, descricao, ordem (catálogo) |
| `permissao_usuario` | 1 | usuario, permissao, concedido_em (concessão; único por usuario+permissao) |
| `sessao` | 1 | id (token), usuario, criado_em, expira_em |
| `produto` | 1 | nome, unidade, codigo_barras, codigo_erp (opcional, único), estoque_minimo, ativo |
| `local_estoque` | 1 | nome (Loja Nova Iguaçu, Loja Mesquita, Galpão) |
| `estoque` | 1 | produto, local, quantidade, data_ultima_contagem |
| `movimento_estoque` | 1 | produto, local, tipo (entrada/saída/contagem/recebimento), quantidade, usuario, data_hora (histórico) |
| `log_sistema` | 1 | módulo, ação, descrição, registro_id, dados (JSON), usuario, criado_em (histórico geral) |
| `fornecedor` | 2 | nome, contato, prazo_entrega_dias, valor_minimo_pedido, frete (opcionais), ativo |
| `produto_fornecedor` | 2 | produto, fornecedor, codigo_no_fornecedor, ativo |
| `historico_preco` | 2 e 3 | produto, fornecedor, preco_unitario, data, origem (pago ou cotado), pedido (opcional). Módulo 2 grava os preços *cotados*; o Módulo 3 grava os *pagos* |
| `pedido_compra` | 3 | comprador, fornecedor, data_compra, previsao_entrega, status, observacao |
| `item_pedido` | 3 | pedido, produto, quantidade, preco_unitario, quantidade_recebida |

> As tabelas `usuario`, `local_estoque`, `produto`, `fornecedor`, `produto_fornecedor`, `estoque`, `movimento_estoque`, `log_sistema`, `permissao`, `permissao_usuario` e `sessao` já existem no banco. As tabelas `fornecedor` e `produto_fornecedor` ficam sem uso até o Módulo 2. O **catálogo de permissões** (`permissao`) é separado das **concessões aos usuários** (`permissao_usuario`).

## 10. Módulos e itens de construção (um por vez)

Ordem definida pelo usuário: primeiro o estoque, depois os fornecedores, depois os pedidos. Só avançar para o item seguinte quando o atual estiver testado e aprovado.

### Módulo 1: Estoque

1. **Cadastro de produtos:** nome, unidade, código de barras, estoque mínimo e código do ERP (opcional).
2. **Tela de movimentação de estoque por local** (entrada, saída e contagem), pensada para o celular (RN-02 e RN-03).
3. **Total calculado e painel de produtos baixos**, como lista simples (RN-01, RN-05 e RN-06).
4. **Histórico de movimentações e histórico geral de ações (log)** (RN-02 e RN-26).
5. **Gestão de usuários** (cadastro, alteração e ativar/desativar — RN-27), **login e sessão** (RN-28) e **Módulos e Permissões** (matriz de permissões por usuário — RN-29 a RN-32), com **deploy na Vercel**, para o estoquista usar de verdade.

Também no Módulo 1: **importação da planilha de produtos do ERP** (RN-24), antes do uso real pelo estoquista.

### Módulo 2: Fornecedores

1. **Cadastro de fornecedores:** prazo de entrega, pedido mínimo e frete.
2. **Vínculo produto x fornecedor** (RN-09).
3. **Preços cotados**, digitados pelo comprador sem pedido (RN-10, origem *cotado*).

### Módulo 3: Pedidos

1. **Comparativo de preços e divisão por fornecedor**, com aviso de pedido mínimo (RN-13 a RN-18).
2. **Confirmação do pedido**, gravando o preço pago no histórico (RN-19).
3. **Status, previsão de entrega e pedido a caminho** (RN-07 e seção 7).
4. **Recebimento**, com entrada no estoque (RN-04, RN-20 e RN-21).

### Futuro

Relatório de vendas e correção de preço no recebimento.

## 11. Decisões pendentes (perguntar ao usuário antes de implementar)

- **Quantidade sugerida no pedido** (decidir no Módulo 3): hoje não existe regra. Proposta: campo opcional `estoque_ideal` por produto, e a sugestão seria `estoque_ideal - (total + a caminho)`. Sem esse campo, o comprador digita a quantidade.
- **Quantidades decimais:** alguns produtos podem ser vendidos por peso (kg). Proposta: aceitar decimais com 3 casas (`Decimal(12,3)`).
- **"Baixo" é menor ou igual ao mínimo** (RN-06). Confirmar se o correto é "menor que".
- **Quem cadastra produtos e fornecedores:** definido pelas permissões concedidas a cada usuário (seção 2). Confirmar quem recebe cada permissão na operação real.

## 12. Fora do escopo da primeira versão

- Emissão de nota fiscal e pagamentos.
- Integração automática com o ERP (API ou banco).
- Abatimento de estoque por vendas.
- Correção de preço no recebimento (nota diferente do pedido).
- Comparação considerando frete e pedido mínimo no cálculo do "mais barato" (nesta versão, só preço unitário).