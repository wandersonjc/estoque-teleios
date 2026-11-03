# Sistema de Pedidos de Compra: Regras de Negócio

> Este arquivo é a **fonte de verdade** das regras do sistema. Se o código e este documento divergirem, o documento vence. Se alguma regra não estiver aqui ou estiver ambígua, **pergunte antes de inventar**.

## 0. Como a IA deve trabalhar neste projeto

- Siga estas regras à risca e **não crie regras novas** por conta própria.
- Trabalhe **um módulo e um item por vez** (seção 10). Não adiantar itens futuros.
- **Ordem dos módulos (definida pelo usuário):** 1) Estoque, 2) Fornecedores, 3) Pedidos.
- **Stack:** Next.js, TypeScript, Prisma 7, PostgreSQL (Aiven), hospedagem na Vercel.
- Entregue código **completo e pronto para usar**, com **comentários explicativos em português**.
- Use TypeScript em modo `strict`. Nomes de tabelas e campos em português, sem acento (ex.: `pedido_compra`, `estoque_seguranca`).
- Valores em dinheiro: **nunca usar `float`**. Usar `Decimal` (ou inteiro em centavos).
- Interface em português do Brasil (pt-BR), moeda em R$, datas no formato dd/mm/aaaa, fuso `America/Sao_Paulo`.
- Interface **responsiva e pensada primeiro para celular** (o estoquista usa em pé, no depósito).
- Em toda tabela de dados, os cabeçalhos das colunas de dados devem permitir alternar entre ordenação ascendente e descendente. A coluna “Ações”, quando existir, não é ordenável.
- **Atualização de listas sem recarregar a página:** buscas e filtros de listas — incluindo checkboxes e listas suspensas — devem atualizar os resultados automaticamente por navegação interna do Next.js, sem recarga completa do documento. Durante a atualização, exiba “Carregando...” com indicador visual na área dos resultados, mantendo o restante da tela utilizável. Preserve os demais filtros, a ordenação e o tamanho de página; ao mudar um filtro que altera o conjunto de resultados, volte à primeira página. Aplique este padrão progressivamente aos módulos existentes e obrigatoriamente a todos os novos módulos e listas.
- **Accordion de busca e filtros:** em toda tela com campos de pesquisa ou filtro, agrupe esses controles em um accordion nativo e acessível com o título “Busca e Filtros”, fechado por padrão. Ao abrir, exiba todos os campos relacionados e um botão “Limpar buscas e filtros”, que restaura os filtros aos valores padrão e volta à primeira página, preservando a ordenação e a quantidade de resultados por página. Essa convenção vale para telas existentes ao serem atualizadas e para todas as novas telas.
- Dúvida sobre uma regra? Veja a seção 11 (decisões pendentes) e pergunte ao usuário.

## 1. Contexto

Mercado com 3 locais de estoque que compra de vários fornecedores. O **estoquista** conta os produtos; quando algum está baixo, o **comprador** monta o pedido ao fornecedor. Para o pedido compensar, o comprador também inclui os **outros produtos baixos** daquele fornecedor, mesmo que ainda não estejam em falta.

O sistema deve:

1. Registrar o estoque de cada produto nos 3 locais e mostrar o **total**.
2. Avisar quais produtos estão baixos.
3. Comparar preços entre fornecedores e montar pedidos de compra.
4. Registrar cada pedido: quem fez, data, fornecedor, previsão de entrega e produtos.

## 2. Usuários, login e permissões

**Não existem perfis nem grupos de permissões.** Cargos são informações descritivas associadas aos usuários e **não concedem acesso**, exceto quando uma regra de negócio de um módulo declarar explicitamente uma exceção. O acesso de cada usuário é definido por **permissões individuais**, concedidas na tela `/permissoes` (Módulos e Permissões). Uma permissão que não foi concedida está **negada**.

O catálogo de permissões é organizado em **módulo → funcionalidade → operação**. Cada permissão tem um **código único e estável** no formato `modulo.funcionalidade.operacao` (ex.: `produtos.produto.criar`).

Exemplos de permissões já existentes: `produtos.produto.consultar`, `produtos.produto.criar`, `produtos.produto.editar`, `produtos.produto.desativar`, `estoque.movimento.registrar`, `locais.local.*`, `usuarios.usuario.*` e `permissoes.permissao.*`.

- **RN-27. Gestão de usuários:** na tela `/usuarios` são **cadastrados, alterados, desativados/reativados e excluídos** os usuários (nome, e-mail e senha). O usuário **só pode ser excluído quando não tem movimentações, registros no log nem vínculos com pedidos de transferência**; se tiver, a exclusão é bloqueada e ele só pode ser desativado, para preservar o histórico. O **e-mail é único**. A **senha é guardada como hash** (nunca em texto puro) e nunca aparece nas telas nem no log do sistema. Na edição, o campo de senha em branco **mantém a senha atual**. A lista possui busca por nome/e-mail, filtro para usuários inativos, visualização em cards ou tabela, ordenação e paginação de 10, 25, 50, 75 ou 100 registros. Pode ser agrupada por cargo ou função, nunca pelos dois ao mesmo tempo.
- **RN-28. Login e sessão:** o acesso ao sistema exige **e-mail e senha**. A sessão fica guardada no banco (tabela `sessao`) e é identificada por um token aleatório em cookie **httpOnly**, com validade de **7 dias**. Usuário **inativo não entra**. O botão **Sair** encerra a sessão.
- **RN-29. Permissões por usuário:** a tela `/permissoes` (ver seção 2.1) mostra uma **matriz expansível** por módulo, funcionalidade e operação, com caixas de seleção para **conceder (marcar)** e **revogar (desmarcar)** as permissões de um usuário escolhido na busca do topo.
- **RN-30. Autorização no servidor:** toda página e toda operação confere a permissão **no servidor** (funções `exigirPermissao` e `verificarPermissao` em `src/lib/autorizacao.ts`). Esconder um botão na tela **não** é suficiente: tentar executar a ação sem permissão é bloqueado no backend.
- **RN-31. Permissões nascem negadas:** uma permissão nova (recem-registrada no catálogo) **não é concedida a ninguém** até que um administrador marque a caixa e salve.
- **RN-32. Trava contra auto-bloqueio:** ninguém pode remover de si mesmo a permissão `permissoes.permissao.conceder`, para não trancar todos para fora da administração.
- **RN-33. Cargos informativos:** um usuário pode ter vários cargos e um cargo pode pertencer a vários usuários. Cargos não concedem permissões, exceto quando uma regra de negócio declarar explicitamente uma exceção; os acessos continuam individuais nos demais casos. O módulo `/cargos` permite consultar, cadastrar, renomear e excluir cargos. A lista é uma tabela pesquisável e ordenável pelo cabeçalho, começa por nome ascendente, usa 10 itens por página por padrão e oferece 10, 25, 50, 75 ou 100 itens. Os 31 cargos iniciais são cadastrados pelo seed e apresentados em ordem alfabética. O cargo "Administrador" é protegido e não pode ser editado nem excluído. Os demais cargos só podem ser excluídos quando não estiverem associados a nenhum usuário.
- **RN-34. Funções informativas:** um usuário pode ter várias funções e uma função pode estar associada a vários usuários. Funções não concedem permissões; os acessos continuam individuais. O módulo `/funcoes` permite consultar, cadastrar, renomear e excluir funções. A lista é uma tabela pesquisável e ordenável pelo cabeçalho, começa por nome ascendente, usa 10 itens por página por padrão e oferece 10, 25, 50, 75 ou 100 itens. As 40 funções iniciais são cadastradas pelo seed e armazenadas em ordem alfabética. Uma função só pode ser excluída quando não estiver associada a nenhum usuário.
- **RN-35. Dashboard:** a página `/dashboard` é o destino inicial após o login e fica disponível no menu para qualquer usuário autenticado. Cada indicador e link só exibe dados de módulos para os quais o usuário possui permissão de consulta; a visão geral não concede acesso adicional.
- **RN-36. Notificações de transferências:** as notificações internas são persistidas e exibidas no sino do cabeçalho, com contador, lista das 10 mais recentes, marcação individual ou em lote como lidas e atualização periódica a cada 30 segundos. Na solicitação, notificam-se usuários ativos com permissões de consulta e envio; no envio, o solicitante e usuários ativos com permissões de consulta e recebimento; na conclusão, o solicitante e quem enviou. O autor de cada evento não recebe notificação sobre a própria ação. Os destinatários diretos também precisam da permissão de consulta; notificação não concede acesso. Usuários podem ativar notificações push por dispositivo, após consentimento do navegador. A assinatura fica vinculada ao usuário autenticado. Cada push abre o pedido de transferência e não deve conter dados além da mensagem da notificação. A gravação da notificação e das entregas pendentes é transacional; o envio ocorre após a resposta e é recuperado pela fila agendada, com retentativas e remoção de assinaturas expiradas.
- **RN-37. Instalação do aplicativo:** o manifesto PWA oferece o Atria como aplicativo instalável em dispositivos e computadores compatíveis. O botão **Instalar** no cabeçalho abre o prompt nativo quando disponível; nos demais navegadores, apresenta instruções específicas para iOS, Android ou computador. A instalação requer HTTPS em produção e depende do suporte do navegador.

Todo registro importante (movimentação de estoque, pedido, preço, ação administrativa) guarda **quem fez** e **quando** (data e hora).

### 2.1 Como registrar uma permissão nova

Este é o **mecanismo padronizado** para que a matriz da tela `/permissoes` cresça sozinha, **sem alterar o componente visual**. A **fonte de verdade** é o arquivo `src/lib/permissoes.ts` (a matriz é gerada a partir do catálogo gravado no banco, nunca de uma lista fixa no frontend).

1. **Registre no catálogo:** acrescente um item em `CATALOGO_DE_PERMISSOES` (`src/lib/permissoes.ts`) com um `codigo` único e estável, o `modulo`, a `funcionalidade`, a `operacao`, uma `descricao` legível e a `ordem` de exibição.
2. **Use o código:** no backend, proteja a operação com `exigirPermissao("novo.codigo")` (páginas) ou `verificarPermissao("novo.codigo")` (ações). No frontend, controle menus, páginas e botões com `usuario.permissoes.has("novo.codigo")` ou inclua o item em `MENU_PRINCIPAL`.
3. **Sincronize:** rode `npm run db:seed` **ou** apenas abra a tela `/permissoes` — o **sincronizador** (`sincronizarCatalogoDePermissoes`) faz `upsert` de cada item do catálogo na tabela `permissao`.

Resultado: a nova permissão aparece automaticamente na matriz, **negada para todos**, até ser concedida explicitamente. O sincronizador pode ser rodado quantas vezes quiser: não duplica nada e não apaga concessões já feitas.

O Módulo 3 usa as permissões `pedidos.pedido.consultar`, `pedidos.configuracao.gerenciar`, `pedidos.rascunho.gerenciar`, `pedidos.pedido.enviar`, `pedidos.pedido.cancelar` e `pedidos.pedido.receber`. Todas nascem negadas e devem ser concedidas na tela `/permissoes`; não há aprovação separada nem privilégio implícito por cargo.

## 3. Locais de estoque

Começam cadastrados os 3 locais abaixo, criados pelo script `scripts/seed.ts`:

- Loja Nova Iguaçu
- Loja Mesquita
- Galpão

- **RN-25. Locais gerenciáveis:** o comprador pode **cadastrar, renomear e excluir** locais de estoque na tela `/locais`. Um local só pode ser excluído quando **não tem estoque, movimentações nem pedidos de transferência associados**; se tiver, a exclusão é bloqueada para preservar o histórico. Renomear um local não altera as movimentações já gravadas.

## 4. Regras de estoque

- **RN-01. Total calculado:** o estoque total de um produto é a **soma das quantidades nos locais de estoque**. O total **não é gravado**, é sempre calculado.
- **RN-02. Movimentação de estoque:** a quantidade de um produto em um local muda por **movimentação**, feita na tela do produto por um popup com um campo por local de estoque. Há três tipos de movimentação:
  - **Entrada:** a quantidade informada é **somada** ao estoque atual do local.
  - **Saída:** a quantidade informada é **subtraída** do estoque atual do local; a saída não pode deixar o local negativo.
  - **Contagem:** a quantidade informada **substitui** o estoque atual do local.
  Cada movimentação é guardada em histórico (`movimento_estoque`: produto, local, tipo, quantidade, usuário, data e hora). Os popups de movimentação só aparecem **depois que o produto é salvo**. A quantidade **não** é informada no cadastro do produto: ele nasce zerado. Enquanto não existir login (item 5), o usuário da movimentação fica em branco.
- **RN-02.1. Embalagens e conversão:** todo saldo é mantido na unidade-base do produto (por exemplo, UN). Cada embalagem associa um código de barras, uma unidade comercial e uma quantidade equivalente na unidade-base. Entradas e saídas podem ser informadas em uma embalagem e são convertidas para a unidade-base antes de gravar saldo e histórico. Contagens são sempre informadas diretamente na unidade-base. Um produto pode ter no máximo uma embalagem principal; seu código é exibido nas listas e cartões.
- **RN-03. Data da movimentação visível:** em qualquer tela que mostre quantidade, mostrar também a **data da última movimentação**, destacando movimentações antigas (ex.: mais de 30 dias, valor configurável).
- **RN-04. Entradas por recebimento:** quando um pedido é recebido, a quantidade recebida **soma** ao estoque do local de entrada (padrão: Galpão).
- **RN-07. Pedido a caminho:** quantidades de pedidos com status *Enviado* (ainda não recebidos) contam como **"a caminho"**. Para decidir se um produto precisa de novo pedido, considerar `total + a caminho`. O painel mostra a quantidade a caminho ao lado do total.
- **RN-38. Configuração de reposição:** os parâmetros de compra são opcionais e definidos por produto. Consumo, estoque de segurança e estoque máximo desejado podem ser informados na unidade-base ou em qualquer embalagem cadastrada para o produto. Converter cada quantidade pelo fator da embalagem para a unidade-base antes dos cálculos; o período do consumo converte dia por 1, semana por 7 e mês por 30 dias (padrão). Registrar o valor digitado, unidade e fator usados; os valores operacionais e cálculos permanecem na unidade-base. Estoque de segurança e máximo convertidos precisam ter até 3 casas decimais (`Decimal(12,3)`); se excederem essa precisão, informar erro ao usuário em vez de arredondar silenciosamente.
- **RN-39. Indicadores de reposição:** o estoque disponível é a soma dos saldos atuais em todos os locais; a quantidade a caminho é a soma de `quantidade - quantidade_recebida` dos itens em pedidos *Enviados*. A posição de estoque é `disponível + a caminho`; o ponto de reposição é `consumo diário × prazo de entrega + estoque de segurança`; a quantidade sugerida é `máximo desejado - posição`, limitada a zero. Para o prazo de reposição, usar o maior prazo informado entre os fornecedores ativos vinculados ao produto. Se não houver prazo informado, não estimar o ponto de reposição. O estado é **Crítico** quando o disponível for menor ou igual ao estoque de segurança; senão, **Comprar** quando a posição for menor ou igual ao ponto de reposição; nos demais casos, **Estoque adequado**. No dashboard, os totais e listas desses estados só aparecem para usuários com permissão de consulta de pedidos. Produtos sem configuração ou sem prazo aparecem em indicador separado de dados pendentes; ainda podem ser classificados como Críticos se houver configuração de segurança.
- **RN-08. Estoque do ERP não é usado:** os números de estoque do ERP não são confiáveis. O sistema **nunca importa quantidade de estoque** do ERP.
- **RN-26. Histórico geral de ações (log):** toda ação relevante de qualquer módulo (produtos, estoque, locais, fornecedores, pedidos, transferências e usuários) grava uma linha na tabela `log_sistema`, com **módulo**, **ação** (criar, alterar, excluir, entrada, saída, contagem, recebimento, solicitar, enviar e concluir transferência), **descrição** legível, **registro afetado**, **detalhes** (JSON, guardando o "antes x depois" quando fizer sentido), **usuário** (em branco até existir login) e **data/hora**. O log é gravado na mesma transação da ação, para nunca ficar pela metade.

## 5. Regras de fornecedores e preços

- **RN-09. Muitos para muitos:** um produto pode ter **um ou vários fornecedores**, e um fornecedor vende vários produtos. A ligação (`produto_fornecedor`) guarda o código do produto no fornecedor e se ele está ativo. O vínculo só pode ser excluído permanentemente enquanto não houver preço registrado nem uso em compras; depois disso, pode ser desativado, mas deve ser mantido para preservar o histórico.
- **RN-10. Histórico de preços:** todo preço fica em histórico, com: produto, fornecedor, preço unitário, data, **origem** e, se houver, o pedido de origem.
  - Origem **pago:** gravado automaticamente ao **confirmar um pedido** (RN-18).
  - Origem **cotado:** digitado manualmente pelo comprador numa consulta, **sem pedido**.
- **RN-11. Preço atual:** o preço atual de um produto em um fornecedor é o **registro mais recente** do histórico (por produto e fornecedor).
- **RN-12. Preço sugerido no pedido:** ao montar um pedido, o campo de preço unitário vem **preenchido com o preço atual** daquele fornecedor, e o comprador pode **editar na hora** se o valor mudou.

## 6. Regras de comparação e montagem do pedido

- **RN-13. Critério único de escolha: menor preço unitário.** Para cada produto com situação **Crítico** ou **Comprar**, listar os fornecedores ativos vinculados, ordenados do **mais barato para o mais caro**, mostrando origem (pago ou cotado) e data de cada preço. O mais barato vem **pré-selecionado**.
- **RN-14. Fornecedor sem preço:** aparece no fim da lista, marcado como "sem preço". Não é pré-selecionado.
- **RN-15. Troca manual:** o comprador pode trocar o fornecedor escolhido e ajustar a quantidade de qualquer item.
- **RN-16. Um pedido por fornecedor:** os itens são agrupados pelo fornecedor escolhido e o sistema gera **um pedido (rascunho) por fornecedor**, mostrando o total de cada um.
- **RN-17. Pedido mínimo do fornecedor:** cada fornecedor tem um campo opcional de **valor mínimo de pedido** (e opcionalmente frete). Se o total do pedido ficar **abaixo do mínimo**, o sistema **avisa e não bloqueia**, e sugere incluir outros produtos baixos que **esse fornecedor também vende** e que ainda não estão no pedido.
- **RN-18. Evitar duplicidade:** um produto já incluído no pedido de um fornecedor aparece marcado como **"já em pedido"** nas listas dos outros fornecedores.
- Produtos com situação **Estoque adequado** podem ser incluídos em um pedido para atingir o valor mínimo do fornecedor, desde que estejam vinculados e ativos para esse fornecedor. O sistema apenas sugere esses produtos e nunca altera a seleção automaticamente.

## 7. Regras do pedido de compra

Campos obrigatórios: **comprador** (usuário logado), **data da compra** (data da confirmação), **fornecedor**, **previsão de entrega** (padrão: data da confirmação + prazo médio do fornecedor, editável) e **itens** (produto, quantidade, preço unitário).

**Status e transições permitidas:**

| De | Para |
|---|---|
| Rascunho | Enviado, Cancelado |
| Enviado | Recebido, Cancelado |
| Recebido, Cancelado | (final, não muda mais) |

O status **Rascunho** não representa uma aprovação pendente: não existe etapa de aprovação separada. Usuários com a permissão de envio podem enviar um rascunho. Durante recebimentos parciais, o pedido permanece **Enviado**; passa a **Recebido** apenas quando a quantidade recebida de todos os itens alcançar a quantidade pedida.

- **RN-19. Confirmar pedido** (Rascunho para Enviado) grava no histórico o **preço de cada item** (origem *pago*), registra data de compra e comprador.
- **RN-20. Edição:** só pedidos em *Rascunho* podem ter itens alterados. Pedidos *Enviado*, *Recebido* ou *Cancelado* ficam travados para edição de itens.
- **RN-21. Recebimento:** usuário com permissão informa a quantidade recebida por item (pode ser **parcial**) e o local de entrada (padrão: Galpão). Cada recebimento soma somente a quantidade efetivamente informada ao estoque (RN-04), na mesma transação que atualiza o item, o pedido, as movimentações e o log. O status permanece *Enviado* até todas as quantidades serem recebidas; então muda para *Recebido*. Não se pode receber pedido cancelado ou já recebido.

## 7.1. Regras de transferência entre locais de estoque

A transferência permite que um usuário solicite produtos de um local de estoque para outro. A origem e o destino são escolhidos pelo solicitante; não há restrição de local associada ao usuário. Origem e destino devem ser locais diferentes.

**Estados e fluxo:**

| Estado | Ação e dados registrados | Próximo estado |
|---|---|---|
| **Pendente** | O solicitante informa origem, destino, produtos e quantidades solicitadas. O sistema registra solicitante e data/hora da solicitação. A solicitação não altera nem reserva o estoque. | **Em trânsito**, quando um usuário com permissão de envio registra as quantidades enviadas. |
| **Em trânsito** | O sistema registra quem enviou e quando. Se a quantidade enviada for diferente da solicitada, o remetente deve informar a justificativa nesse momento. As quantidades solicitadas e enviadas ficam bloqueadas para edição. As quantidades enviadas são reservadas no local de origem para não ficarem disponíveis em outro envio. | **Concluído**, quando um usuário com permissão de recebimento confirma as quantidades recebidas. |
| **Concluído** | O sistema registra quem recebeu e quando, as quantidades recebidas e as justificativas das divergências. Registra as movimentações de saída na origem e entrada no destino. | Estado final; somente consulta. |

**Regras de autorização e edição:**

- Consultar, solicitar, enviar e receber são operações controladas por permissões individuais, conferidas no servidor. As permissões nascem negadas e não ficam limitadas a um local específico. A edição e a exclusão de pedidos pendentes seguem a regra específica de autoria ou cargo Administrador descrita abaixo.
- Enquanto estiver **Pendente**, somente o solicitante ou um usuário com o cargo **Administrador** pode editar ou excluir a solicitação. O cargo Administrador é uma exceção explícita à regra geral de que cargos não concedem acesso: neste módulo, ele permite editar ou excluir solicitações pendentes, mas não concede por si só permissão para enviar ou receber.
- Somente usuários com a permissão de envio podem enviar uma solicitação. O envio é irreversível: depois que a solicitação passa para **Em trânsito**, ninguém pode editar, excluir ou cancelar o pedido, inclusive o solicitante, o remetente e o Administrador.
- Somente usuários com a permissão de recebimento podem confirmar o recebimento. Após a conclusão, ninguém pode editar ou excluir o registro; ele fica disponível para consulta.

**Reserva e atualização de estoque:**

- Ao enviar, o sistema valida que a quantidade a enviar está disponível na origem, descontando as quantidades já reservadas por outras transferências **Em trânsito**. O envio deve gravar as quantidades enviadas, mudar o estado e reservar o saldo de forma atômica, para que duas solicitações concorrentes não reservem a mesma quantidade.
- A reserva não altera o saldo físico registrado no estoque. Enquanto a transferência estiver **Em trânsito**, a quantidade reservada não pode ser usada para outra transferência.
- No recebimento, a transação baixa da origem a quantidade **enviada** e credita no destino a quantidade **efetivamente recebida**. A reserva correspondente é liberada na conclusão.
- A quantidade recebida pode ser diferente da enviada, inclusive parcial ou maior que a enviada. Quando houver divergência, o recebimento exige justificativa, registrada no item e no log. A quantidade efetivamente recebida é creditada no destino; a quantidade enviada continua sendo baixada da origem.
- A conclusão, as movimentações da origem e do destino, a liberação da reserva e o log devem ocorrer na mesma transação. Não pode haver conclusão parcial nem saldo negativo na origem.

**Dados de auditoria:**

- Registrar os identificadores dos usuários solicitante, remetente e recebedor, além da data e hora de cada etapa. Exibir os nomes associados aos identificadores nas telas e preservar esses vínculos para o histórico.
- Cada item guarda produto, quantidade solicitada, quantidade enviada e quantidade recebida. Quando a quantidade enviada divergir da solicitada, a justificativa obrigatória é registrada no item durante o envio. Quando a quantidade recebida divergir da enviada, inclusive quando for maior, a justificativa obrigatória é registrada no item durante o recebimento.
- A quantidade pode ser informada em uma embalagem cadastrada para o produto ou na unidade-base. O sistema converte cada etapa para a unidade-base antes das validações e atualizações de estoque. Também preserva a quantidade digitada, a unidade escolhida e o fator de conversão daquela etapa, para que alterações futuras no cadastro de embalagens não modifiquem o histórico.
- As movimentações geradas na conclusão devem manter vínculo com a transferência que as originou.

## 8. Regras do catálogo de produtos

- **RN-22.** O produto tem um campo opcional **`codigo_erp`**, **único** quando preenchido. Será a chave para importar e atualizar produtos do ERP no futuro, sem duplicar.
- **RN-22.1. Embalagens de produto:** um produto pode ter vários códigos de barras, um por embalagem. Cada código de barras cadastrado é único no sistema; unidade comercial e quantidade equivalente em unidade-base são informadas por embalagem. O código principal é o apresentado na lista de produtos. Códigos legados são migrados como embalagem principal, com equivalência 1:1 na unidade-base.
- **RN-23. Exclusão segura de produto:** produtos são cadastrados à mão. Um produto só pode ser excluído permanentemente por usuário com a permissão `produtos.produto.excluir` quando não houver vínculos com fornecedores, registros de preços, linhas de estoque, movimentações ou outras relações funcionais do sistema. Registros de auditoria, por si só, não bloqueiam a exclusão e devem ser preservados. Ao adicionar uma nova relação funcional ao produto, atualize também a verificação de elegibilidade para exclusão. Quando houver qualquer relação funcional, o produto só pode ser desativado.
- **RN-24.** A importação de planilha do ERP (Superus) faz parte do **Módulo 1** e deve estar pronta **antes do uso real** pelo estoquista, para o catálogo completo estar cadastrado. Ela importa **somente cadastro** (código, descrição, unidade, código de barras, custo), nunca estoque.

## 9. Modelo de dados conceitual

| Entidade | Módulo | Campos principais |
|---|---|---|
| `usuario` | 1 | nome, e-mail, senha (hash), ativo |
| `permissao` | 1 | codigo (único), modulo, funcionalidade, operacao, descricao, ordem (catálogo) |
| `permissao_usuario` | 1 | usuario, permissao, concedido_em (concessão; único por usuario+permissao) |
| `sessao` | 1 | id (token), usuario, criado_em, expira_em |
| `produto` | 1 | nome, unidade, codigo_barras, codigo_erp (opcional, único), ativo |
| `local_estoque` | 1 | nome (Loja Nova Iguaçu, Loja Mesquita, Galpão) |
| `estoque` | 1 | produto, local, quantidade, data_ultima_contagem |
| `movimento_estoque` | 1 | produto, local, tipo (entrada/saída/contagem/recebimento), quantidade, usuario, data_hora (histórico) |
| `log_sistema` | 1 | módulo, ação, descrição, registro_id, dados (JSON), usuario, criado_em (histórico geral) |
| `fornecedor` | 2 | nome, contato, prazo_entrega_dias, valor_minimo_pedido, frete (opcionais), ativo |
| `produto_fornecedor` | 2 | produto, fornecedor, codigo_no_fornecedor, ativo |
| `historico_preco` | 2 e 3 | produto, fornecedor, preco_unitario, data, origem (pago ou cotado), pedido (opcional). Módulo 2 grava os preços *cotados*; o Módulo 3 grava os *pagos* |
| `configuracao_compra` | 3 | produto (único), consumo informado/período/unidade/fator, consumo_diario na unidade-base, estoque de segurança e máximo na unidade-base e os respectivos valores informados/unidades/fatores |
| `pedido_compra` | 3 | comprador, fornecedor, data_compra, previsao_entrega, status, observacao |
| `item_pedido` | 3 | pedido, produto, quantidade, preco_unitario, quantidade_recebida |
| `pedido_transferencia` | 4 | origem, destino, solicitante, criado_em, status, enviado_por, enviado_em, recebido_por, recebido_em |
| `item_transferencia` | 4 | transferencia, produto, quantidade_solicitada/quantidade_enviada/quantidade_recebida na unidade-base; quantidade_*_informada, unidade_* e fator_* preservam os valores escolhidos em cada etapa; justificativa_envio e justificativa_divergencia |

> As tabelas `usuario`, `local_estoque`, `produto`, `fornecedor`, `produto_fornecedor`, `estoque`, `movimento_estoque`, `log_sistema`, `permissao`, `permissao_usuario` e `sessao` já existem no banco. O schema Prisma também define `pedido_transferencia` e `item_transferencia`, além do vínculo entre movimentações e transferências. Antes de usar o módulo em um ambiente, aplique as alterações do schema com `npx prisma db push` no banco correto e sincronize o catálogo com `npm run db:sync-permissoes`; depois, conceda individualmente as permissões na tela `/permissoes`. As tabelas `fornecedor` e `produto_fornecedor` ficam sem uso até o Módulo 2. As quantidades reservadas são calculadas a partir dos itens enviados em transferências Em trânsito; não representam uma alteração antecipada do saldo físico. O **catálogo de permissões** (`permissao`) é separado das **concessões aos usuários** (`permissao_usuario`).

## 10. Módulos e itens de construção (um por vez)

Ordem definida pelo usuário: primeiro o estoque, depois os fornecedores, depois os pedidos. Só avançar para o item seguinte quando o atual estiver testado e aprovado.

### Módulo 1: Estoque

1. **Cadastro de produtos:** nome, unidade, código de barras e código do ERP (opcional).
2. **Tela de movimentação de estoque por local** (entrada, saída e contagem), pensada para o celular (RN-02 e RN-03).
3. **Total calculado e indicadores de reposição** (RN-01 e RN-38 a RN-39).
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

### Módulo 4: Transferência entre locais de estoque

1. **Solicitação:** usuário com permissão escolhe os locais de origem e destino e informa produtos e quantidades. O pedido começa Pendente e registra solicitante e data/hora.
2. **Edição e exclusão da solicitação:** enquanto Pendente, somente o solicitante ou um usuário com cargo Administrador pode editar ou excluir.
3. **Envio:** usuário com permissão registra as quantidades enviadas. O sistema identifica remetente e data/hora, valida e reserva o saldo disponível na origem. A transferência passa para Em trânsito e não pode mais ser editada, excluída ou cancelada.
4. **Recebimento:** usuário com permissão informa a quantidade recebida de cada produto. Diferenças, inclusive recebimentos parciais, exigem justificativa.
5. **Conclusão:** em uma transação, o sistema baixa da origem o que foi enviado, credita no destino o que foi recebido, libera as reservas e registra recebedor, data/hora, movimentações e log. O pedido concluído fica somente para consulta.
6. **Permissões:** consultar, solicitar, enviar e receber são permissões individuais, sem restrição por local. O cargo Administrador é exceção somente para editar ou excluir solicitações ainda Pendentes; não substitui as permissões de envio e recebimento.
7. **Disponibilização:** o módulo está implementado nas telas `/transferencias`, `/transferencias/novo` e `/transferencias/[id]`, com validações no servidor, controle de saldo reservado, histórico de movimentações, auditoria e notificações internas e push (RN-36). Para ativar push, gere um par VAPID (`npx web-push generate-vapid-keys`) e configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no ambiente. Configure também `CRON_SECRET` (segredo aleatório forte) localmente e na hospedagem. O cron de `vercel.json` chama `/api/cron/push` a cada minuto; a hospedagem precisa aceitar essa frequência. O envio imediato após as ações de transferência depende do runtime suportar a API `after` do Next.js; o cron é necessário para recuperação e retentativas. Aplique o schema Prisma ao banco correto para criar as tabelas `assinatura_push` e `entrega_push`, e sincronize/conceda as permissões conforme a seção 2.1. Push requer HTTPS em produção; suporte e condições de instalação variam entre navegadores e dispositivos.

### Futuro

Relatório de vendas e correção de preço no recebimento.

## 11. Decisões pendentes (perguntar ao usuário antes de implementar)

As regras do primeiro escopo do Módulo 3 foram confirmadas: mês de 30 dias; maior prazo dos fornecedores ativos vinculados; quantidade sugerida mínima zero; Crítico quando estoque disponível ≤ segurança; sem etapa de aprovação; status Enviado até o recebimento integral; quantidades com até 3 casas decimais. As permissões do módulo permanecem negadas até serem concedidas individualmente em `/permissoes`.

## 12. Fora do escopo da primeira versão

- Emissão de nota fiscal e pagamentos.
- Integração automática com o ERP (API ou banco).
- Abatimento de estoque por vendas.
- Correção de preço no recebimento (nota diferente do pedido).
- Comparação considerando frete e pedido mínimo no cálculo do "mais barato" (nesta versão, só preço unitário).