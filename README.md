# Sistema de Gerenciamento de Pet Shop

Aplicação web completa para gerenciar clientes, animais, produtos, serviços, agendamentos e vendas.
O backend é feito com **Node.js + Express**, o frontend com **HTML/CSS/JavaScript** e todos os dados
são persistidos em **PostgreSQL** através da biblioteca **pg**.

O projeto foi pensado para demonstrar, na prática, os recursos de banco de dados exigidos:

- CRUD completo com consultas parametrizadas;
- **Function** `calcular_total_venda`;
- **Procedure** `finalizar_venda` com `COMMIT`/`ROLLBACK` e validação de estoque;
- **Trigger** `trg_movimentacoes_estoque`, que registra automaticamente cada alteração de estoque;
- Relacionamentos, chaves estrangeiras e restrições de integridade.

---

## 1. Pré-requisitos

- Node.js 18 ou superior (Node 24 testado)
- PostgreSQL 14 ou superior (sintaxe compatível com PostgreSQL 16)
- `psql` ou pgAdmin para executar o script SQL

---

## 2. Instalação

### 2.1. Criar o banco e executar o script

No terminal:

```bash
createdb -U postgres petshop
psql -U postgres -d petshop -f database/script.sql
```

No Windows, se `psql` não estiver no PATH, use o caminho completo, por exemplo:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d petshop -f database\script.sql
```

Também é possível abrir o pgAdmin, criar o banco `petshop` e executar o conteúdo de
`database/script.sql` no Query Tool.

> O script apaga as tabelas existentes, cria toda a estrutura, a function, a procedure,
> o trigger e insere dados de exemplo. Pode ser executado quantas vezes for necessário.

### 2.2. Configurar a conexão

```bash
cp .env.example .env
```

Edite o `.env`. Se preferir usar URL completa:

```env
DATABASE_URL=postgresql://postgres:senha@localhost:5432/petshop
```

Ou configure os parâmetros individualmente:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=senha
DB_NAME=petshop
```

### 2.3. Instalar dependências e iniciar

```bash
npm install
npm start
```

Acesse **http://localhost:3001** (o `PORT` está definido no `.env`; `DATABASE_URL` aponta para o PostgreSQL local).

Para desenvolvimento com reinício automático:

```bash
npm run dev
```

---

## 3. Estrutura do projeto

```text
petshop/
├── backend/
│   ├── config/
│   │   ├── database.js          # Pool de conexões com PostgreSQL (pg)
│   │   └── helpers.js           # Validações e tratamento de erros
│   ├── controllers/
│   │   ├── dashboardController.js
│   │   ├── clientesController.js
│   │   ├── animaisController.js
│   │   ├── produtosController.js
│   │   ├── servicosController.js
│   │   ├── agendamentosController.js
│   │   └── vendasController.js
│   ├── routes/
│   │   ├── dashboardRoutes.js
│   │   ├── clientesRoutes.js
│   │   ├── animaisRoutes.js
│   │   ├── produtosRoutes.js
│   │   ├── servicosRoutes.js
│   │   ├── agendamentosRoutes.js
│   │   └── vendasRoutes.js
│   └── server.js                # Express, rotas, arquivos estáticos e erros
├── frontend/
│   ├── index.html               # Dashboard
│   ├── clientes.html
│   ├── animais.html
│   ├── produtos.html
│   ├── servicos.html
│   ├── agendamentos.html
│   ├── vendas.html
│   ├── css/style.css
│   └── js/
│       ├── common.js            # API fetch, modais, toast, formatação
│       ├── dashboard.js
│       ├── clientes.js
│       ├── animais.js
│       ├── produtos.js
│       ├── servicos.js
│       ├── agendamentos.js
│       └── vendas.js
├── database/
│   ├── script.sql               # DDL, function, procedure, trigger e dados de exemplo
│   └── der.md                   # Diagrama Entidade-Relacionamento (Mermaid)
├── .env.example
├── package.json
└── README.md
```

---

## 4. Funcionalidades

### Dashboard
Indicadores de clientes, animais, produtos, serviços concluídos, vendas finalizadas, faturamento,
produtos com estoque baixo e próximos agendamentos.

### Cadastros
CRUD completo de clientes, animais, produtos, serviços e agendamentos, com pesquisa, edição em
modal e confirmação antes de excluir. Clientes podem ter vários animais.

### Produtos e estoque
Cadastro, edição, exclusão, pesquisa, consulta de estoque e destaque para itens abaixo do mínimo.
Toda alteração em `quantidade_estoque` gera uma linha em `movimentacoes_estoque` automaticamente.

### Vendas
Criação de venda pendente, adição de vários produtos, cálculo automático do total, remoção de itens,
cancelamento, exclusão e finalização. A finalização chama a procedure do PostgreSQL.

---

## 5. Lógica implementada no PostgreSQL

### 5.1. Function — `calcular_total_venda`

Soma `quantidade * preco_unitario` de todos os itens da venda.

```sql
SELECT calcular_total_venda(2);
```

### 5.2. Procedure — `finalizar_venda`

Recebe o ID da venda e dois parâmetros de saída. Etapas executadas:

1. Verifica se a venda existe e se está pendente;
2. Bloqueia os produtos da venda (`FOR UPDATE`);
3. Valida o estoque de cada item;
4. Se faltar estoque, lança exceção, desfaz as alterações e executa `ROLLBACK`;
5. Se estiver tudo certo, baixa o estoque (o trigger registra as movimentações),
   usa `calcular_total_venda` para atualizar `valor_total`, muda o status para `finalizada`
   e executa `COMMIT`.

```sql
-- Venda 2 do script de exemplo está pendente
CALL finalizar_venda(2, NULL, NULL);

SELECT id_venda, valor_total, status FROM vendas WHERE id_venda = 2;
SELECT * FROM movimentacoes_estoque ORDER BY id_movimentacao DESC;
```

Na aplicação, o botão **Finalizar** da tela de vendas executa exatamente esse `CALL`.

### 5.3. Trigger — `trg_movimentacoes_estoque`

Disparado automaticamente após qualquer `UPDATE` em `produtos.quantidade_estoque`.
Registra produto, quantidade anterior, quantidade atual, diferença, tipo da movimentação e data/hora.

```sql
-- Teste manual: o trigger grava a movimentação sem nenhuma chamada da aplicação
UPDATE produtos SET quantidade_estoque = quantidade_estoque + 5 WHERE id_produto = 1;
SELECT * FROM movimentacoes_estoque ORDER BY data_movimentacao DESC;
```

---

## 6. DER (Diagrama Entidade-Relacionamento)

O diagrama completo em Mermaid está em [`database/der.md`](database/der.md) e pode ser renderizado
no GitHub, no VS Code com a extensão Mermaid ou em ferramentas como draw.io/mermaid-cli.

Resumo dos relacionamentos:

```mermaid
erDiagram
    CLIENTES ||--o{ ANIMAIS : possui
    CLIENTES ||--o{ VENDAS : realiza
    ANIMAIS ||--o{ AGENDAMENTOS : recebe
    SERVICOS ||--o{ AGENDAMENTOS : agendado_em
    VENDAS ||--o{ ITENS_VENDA : contem
    PRODUTOS ||--o{ ITENS_VENDA : compoe
    PRODUTOS ||--o{ MOVIMENTACOES_ESTOQUE : gera
```

### Slides de apresentação

Apresentação única em 16:9, com 3 páginas, pronta para o seminário:

[`petshop-apresentacao.pdf`](apresentacao/petshop-apresentacao.pdf) · [`petshop-apresentacao.pptx`](apresentacao/petshop-apresentacao.pptx)

Páginas: visão geral, DER/modelagem e "como foi feito / o que o código faz".

Slides individuais (mesmo conteúdo, para edição separada):

1. Visão geral do sistema, arquitetura, recursos PostgreSQL e fluxo de vendas:
   [`slide-petshop.pdf`](apresentacao/slide-petshop.pdf) · [`slide-petshop.pptx`](apresentacao/slide-petshop.pptx) · [`slide.html`](apresentacao/slide.html)
2. Modelagem de dados, DER simplificado e regras de integridade:
   [`slide2-der.pdf`](apresentacao/slide2-der.pdf) · [`slide2-der.pptx`](apresentacao/slide2-der.pptx) · [`slide2-der.html`](apresentacao/slide2-der.html)
3. Como foi feito e o que o código faz, em um único slide:
   [`slide3-como-foi-feito.pdf`](apresentacao/slide3-como-foi-feito.pdf) · [`slide3-como-foi-feito.pptx`](apresentacao/slide3-como-foi-feito.pptx) · [`slide3-como-foi-feito.html`](apresentacao/slide3-como-foi-feito.html)

Os PDFs já estão gerados em 13,33 × 7,5 polegadas. Os PPTX incluem notas do apresentador.

### Documentação em Word

Documento completo com código, conceitos, arquitetura, fluxos, instalação, validações e conclusão:

[`Petshop-Documentacao-Tecnica.docx`](Petshop-Documentacao-Tecnica.docx)

---

## 7. Principais rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/resumo` | Indicadores do dashboard |
| GET/POST | `/api/clientes` | Listar (com `?q=`) / cadastrar cliente |
| GET/PUT/DELETE | `/api/clientes/:id` | Buscar / editar / excluir cliente |
| GET/POST | `/api/animais` | Listar / cadastrar animal |
| GET/PUT/DELETE | `/api/animais/:id` | Buscar / editar / excluir animal |
| GET/POST | `/api/produtos` | Listar / cadastrar produto |
| GET | `/api/produtos/estoque-baixo` | Produtos abaixo do estoque mínimo |
| GET/PUT/DELETE | `/api/produtos/:id` | Buscar / editar / excluir produto |
| GET/POST | `/api/servicos` | Listar / cadastrar serviço |
| GET/PUT/DELETE | `/api/servicos/:id` | Buscar / editar / excluir serviço |
| GET/POST | `/api/agendamentos` | Listar / agendar serviço |
| GET/PUT/DELETE | `/api/agendamentos/:id` | Buscar / editar / excluir agendamento |
| GET/POST | `/api/vendas` | Listar / criar venda pendente |
| GET | `/api/vendas/:id/detalhes` | Venda com seus itens |
| POST | `/api/vendas/:id/itens` | Adicionar item (preço unitário vem do produto) |
| DELETE | `/api/vendas/:id/itens/:itemId` | Remover item |
| POST | `/api/vendas/:id/finalizar` | Chama a procedure `finalizar_venda` |
| POST | `/api/vendas/:id/cancelar` | Cancela venda pendente |
| PUT/DELETE | `/api/vendas/:id` | Editar / excluir venda pendente |

Todas as consultas usam parâmetros (`$1`, `$2`, ...) — nenhuma string do usuário é concatenada em SQL.

---

## 8. Roteiro de testes para o seminário

1. **CRUD:** crie um cliente, edite o telefone, pesquise pelo CPF e exclua um registro de teste.
2. **Relacionamento:** cadastre um animal para esse cliente e tente excluir o cliente;
   o banco exige tratar os dependentes (ou exclui em cascata, conforme a FK).
3. **Trigger:** edite a quantidade de um produto e consulte `movimentacoes_estoque`.
4. **Function:** anote o total de uma venda pendente e rode `SELECT calcular_total_venda(id)`.
5. **Procedure:** clique em **Finalizar** na tela de vendas e verifique:
   - status da venda passou para `finalizada`;
   - estoque dos produtos foi baixado;
   - novas movimentações aparecem na tabela de auditoria.
6. **Rollback:** crie uma venda com um item cuja quantidade seja maior que o estoque e tente
   finalizar. A procedure devolve `p_sucesso = false`, nenhuma quantidade é alterada e o status
   continua `pendente`.

---

## 9. Observações

- Dados de exemplo já vêm no script: 5 clientes, 7 animais, 8 produtos, 6 serviços,
  6 agendamentos e 4 vendas (duas finalizadas, uma pendente e uma cancelada).
- A venda pendente `#2` foi preparada para o teste da procedure.
- Produtos com estoque baixo no exemplo: Ração Gatos, Shampoo Pet e Cama Macia.
