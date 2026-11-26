-- ============================================================================
-- PET SHOP - SCRIPT COMPLETO DO BANCO DE DADOS
-- PostgreSQL 14+ (testado com sintaxe compatível com PostgreSQL 16)
--
-- Executar: psql -U postgres -d petshop -f database/script.sql
-- ============================================================================

-- Limpeza (permite executar o script quantas vezes for necessário)
DROP TABLE IF EXISTS movimentacoes_estoque, itens_venda, vendas, agendamentos,
                    servicos, produtos, animais, clientes CASCADE;
DROP PROCEDURE IF EXISTS finalizar_venda(INTEGER, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calcular_total_venda(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS registrar_movimentacao_estoque() CASCADE;

-- ----------------------------------------------------------------------------
-- 1. TABELAS
-- ----------------------------------------------------------------------------

CREATE TABLE clientes (
    id_cliente    SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    cpf           VARCHAR(14)  NOT NULL UNIQUE,
    telefone      VARCHAR(20),
    email         VARCHAR(150),
    endereco      TEXT,
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_clientes_cpf_formato CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE TABLE animais (
    id_animal        SERIAL PRIMARY KEY,
    nome             VARCHAR(100) NOT NULL,
    especie          VARCHAR(50)  NOT NULL,
    raca             VARCHAR(80),
    data_nascimento  DATE,
    peso             NUMERIC(6,2) CHECK (peso > 0),
    sexo             CHAR(1) CHECK (sexo IN ('M', 'F')),
    id_cliente       INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    criado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE produtos (
    id_produto         SERIAL PRIMARY KEY,
    nome               VARCHAR(150) NOT NULL,
    categoria          VARCHAR(80),
    descricao          TEXT,
    preco_venda        NUMERIC(10,2) NOT NULL CHECK (preco_venda >= 0),
    quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
    estoque_minimo     INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    criado_em          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE servicos (
    id_servico      SERIAL PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL UNIQUE,
    descricao       TEXT,
    preco           NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0)
);

CREATE TABLE agendamentos (
    id_agendamento    SERIAL PRIMARY KEY,
    id_animal         INTEGER NOT NULL REFERENCES animais(id_animal) ON DELETE CASCADE,
    id_servico        INTEGER NOT NULL REFERENCES servicos(id_servico) ON DELETE RESTRICT,
    data_agendamento  DATE NOT NULL,
    horario           TIME NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'agendado'
                      CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    observacoes       TEXT,
    criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendas (
    id_venda     SERIAL PRIMARY KEY,
    id_cliente   INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    data_venda   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    status       VARCHAR(20) NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'finalizada', 'cancelada')),
    observacoes  TEXT
);

CREATE TABLE itens_venda (
    id_item         SERIAL PRIMARY KEY,
    id_venda        INTEGER NOT NULL REFERENCES vendas(id_venda) ON DELETE CASCADE,
    id_produto      INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE RESTRICT,
    quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario  NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
    CONSTRAINT uq_item_venda_produto UNIQUE (id_venda, id_produto)
);

CREATE TABLE movimentacoes_estoque (
    id_movimentacao     SERIAL PRIMARY KEY,
    id_produto          INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
    quantidade_anterior INTEGER NOT NULL,
    quantidade_atual    INTEGER NOT NULL,
    diferenca           INTEGER NOT NULL,
    tipo_movimentacao   VARCHAR(10) NOT NULL CHECK (tipo_movimentacao IN ('entrada', 'saida')),
    observacao          TEXT,
    data_movimentacao   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para as pesquisas mais frequentes da aplicação
CREATE INDEX idx_clientes_nome      ON clientes (nome_completo);
CREATE INDEX idx_animais_cliente    ON animais (id_cliente);
CREATE INDEX idx_produtos_nome      ON produtos (nome);
CREATE INDEX idx_itens_venda_venda  ON itens_venda (id_venda);
CREATE INDEX idx_vendas_cliente     ON vendas (id_cliente);
CREATE INDEX idx_agendamentos_data  ON agendamentos (data_agendamento, horario);
CREATE INDEX idx_movimentacoes_prod ON movimentacoes_estoque (id_produto, data_movimentacao);

-- ----------------------------------------------------------------------------
-- 2. FUNCTION: cálculo do valor total da venda
--    Utilizada pela procedure finalizar_venda e pela aplicação.
-- ----------------------------------------------------------------------------

CREATE FUNCTION calcular_total_venda(p_id_venda INTEGER)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
      INTO v_total
      FROM itens_venda
     WHERE id_venda = p_id_venda;

    RETURN v_total;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. TRIGGER: registro automático de movimentações de estoque
--    Disparado sempre que quantidade_estoque mudar. A aplicação NÃO chama
--    esta função diretamente: o PostgreSQL executa o trigger sozinho.
-- ----------------------------------------------------------------------------

CREATE FUNCTION registrar_movimentacao_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO movimentacoes_estoque (
        id_produto,
        quantidade_anterior,
        quantidade_atual,
        diferenca,
        tipo_movimentacao,
        observacao
    ) VALUES (
        NEW.id_produto,
        OLD.quantidade_estoque,
        NEW.quantidade_estoque,
        NEW.quantidade_estoque - OLD.quantidade_estoque,
        CASE WHEN NEW.quantidade_estoque > OLD.quantidade_estoque
             THEN 'entrada' ELSE 'saida' END,
        'Atualização automática de estoque'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_movimentacoes_estoque
AFTER UPDATE OF quantidade_estoque ON produtos
FOR EACH ROW
WHEN (OLD.quantidade_estoque IS DISTINCT FROM NEW.quantidade_estoque)
EXECUTE FUNCTION registrar_movimentacao_estoque();

-- ----------------------------------------------------------------------------
-- 4. PROCEDURE: finalização de venda com transação e controle de estoque
--
--    Parâmetros de saída (INOUT) devolvem o resultado para a aplicação:
--      p_sucesso : TRUE se a venda foi finalizada
--      p_mensagem: detalhe do sucesso ou do motivo da falha
--
--    Chamada: CALL finalizar_venda(2, NULL, NULL);
--
--    Se ALGUM produto não tiver estoque suficiente, a exceção é capturada,
--    todas as alterações da venda são desfeitas e a procedure executa
--    ROLLBACK explícito. Se tudo estiver correto, executa COMMIT explícito.
-- ----------------------------------------------------------------------------

CREATE PROCEDURE finalizar_venda(
    p_id_venda   INTEGER,
    INOUT p_sucesso  BOOLEAN,
    INOUT p_mensagem TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status VARCHAR(20);
    v_item   RECORD;
    v_total  NUMERIC(12,2);
    v_erro   TEXT;
BEGIN
    p_sucesso  := FALSE;
    p_mensagem := '';

    -- Bloco com EXCEPTION: funciona como uma subtransação. Caso ocorra erro,
    -- o PostgreSQL desfaz automaticamente tudo que foi feito dentro dele.
    BEGIN
        SELECT status
          INTO v_status
          FROM vendas
         WHERE id_venda = p_id_venda
           FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Venda % não encontrada.', p_id_venda;
        END IF;

        IF v_status = 'finalizada' THEN
            RAISE EXCEPTION 'A venda % já está finalizada.', p_id_venda;
        END IF;

        IF v_status = 'cancelada' THEN
            RAISE EXCEPTION 'A venda % está cancelada e não pode ser finalizada.', p_id_venda;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM itens_venda WHERE id_venda = p_id_venda) THEN
            RAISE EXCEPTION 'Não é possível finalizar uma venda sem itens.';
        END IF;

        -- Bloqueia os produtos da venda para evitar concorrência e valida o estoque
        FOR v_item IN
            SELECT p.id_produto,
                   p.nome,
                   iv.quantidade,
                   p.quantidade_estoque
              FROM itens_venda iv
              JOIN produtos p ON p.id_produto = iv.id_produto
             WHERE iv.id_venda = p_id_venda
             ORDER BY iv.id_item
               FOR UPDATE OF p
        LOOP
            IF v_item.quantidade_estoque < v_item.quantidade THEN
                RAISE EXCEPTION
                    'Estoque insuficiente para "%". Disponível: %, solicitado: %.',
                    v_item.nome, v_item.quantidade_estoque, v_item.quantidade;
            END IF;
        END LOOP;

        -- Baixa de estoque. O trigger trg_movimentacoes_estoque registra cada linha.
        UPDATE produtos p
           SET quantidade_estoque = p.quantidade_estoque - iv.quantidade
          FROM itens_venda iv
         WHERE iv.id_venda = p_id_venda
           AND p.id_produto = iv.id_produto;

        -- Usa a FUNCTION exigida para calcular o total
        v_total := calcular_total_venda(p_id_venda);

        UPDATE vendas
           SET valor_total = v_total,
               status = 'finalizada'
         WHERE id_venda = p_id_venda;

        p_sucesso  := TRUE;
        p_mensagem := 'Venda ' || p_id_venda || ' finalizada com sucesso. Total: R$ ' || v_total;
    EXCEPTION WHEN OTHERS THEN
        v_erro := SQLERRM;
    END;

    IF v_erro IS NOT NULL THEN
        p_sucesso  := FALSE;
        p_mensagem := v_erro;
        ROLLBACK;
        RETURN;
    END IF;

    COMMIT;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. DADOS DE EXEMPLO
-- ----------------------------------------------------------------------------

INSERT INTO clientes (nome_completo, cpf, telefone, email, endereco) VALUES
('Ana Paula Lima',     '52998224725', '(11) 98877-1122', 'ana.lima@email.com',    'Rua das Flores, 120 - São Paulo/SP'),
('Bruno Costa',        '11144477735', '(11) 97744-8899', 'bruno.costa@email.com', 'Av. Central, 540 - São Paulo/SP'),
('Carla Mendes',       '16899535009', '(11) 96655-2233', 'carla.mendes@email.com','Rua do Parque, 78 - Campinas/SP'),
('Diego Souza',        '28717638001', '(11) 95533-6677', 'diego.souza@email.com', 'Rua Aurora, 312 - Santos/SP'),
('Elisa Ferreira',     '27882622082', '(11) 94422-1100', 'elisa.ferreira@email.com','Av. das Nações, 900 - Guarulhos/SP');

INSERT INTO animais (nome, especie, raca, data_nascimento, peso, sexo, id_cliente) VALUES
('Thor',   'cachorro', 'Labrador',    '2021-05-12', 28.50, 'M', 1),
('Mimi',   'gato',     'Siamês',      '2022-03-08',  4.20, 'F', 1),
('Mel',    'cachorro', 'Poodle',      '2020-11-20',  9.10, 'F', 2),
('Freddie','ave',      'Canário',     '2023-01-15',  0.09, 'M', 3),
('Nina',   'gato',     'Persa',       '2021-09-30',  5.60, 'F', 4),
('Bob',    'cachorro', 'Buldogue',    '2019-07-02', 22.00, 'M', 5),
('Lilo',   'coelho',   'Mini Lop',    '2024-02-10',  1.80, 'F', 2);

INSERT INTO produtos (nome, categoria, descricao, preco_venda, quantidade_estoque, estoque_minimo) VALUES
('Ração Premium Cães 15kg', 'Alimentação', 'Ração completa para cães adultos', 189.90, 25, 10),
('Ração Gatos 10kg',        'Alimentação', 'Ração específica para gatos adultos', 129.90, 6, 8),
('Brinquedo Mordedor',       'Brinquedos', 'Mordedor de borracha resistente', 39.90, 40, 10),
('Coleira Ajustável',        'Acessórios', 'Coleira de nylon ajustável tamanho M', 49.90, 15, 5),
('Shampoo Pet',              'Higiene',    'Shampoo suave para banho frequente', 34.90, 4, 6),
('Areia Sanitária',          'Higiene',    'Areia sanitária aglomerante 4kg', 59.90, 20, 8),
('Petisco Natural',          'Alimentação','Petisco natural para cães 500g', 24.90, 30, 10),
('Cama Macia',               'Acessórios', 'Cama acolchoada tamanho médio', 149.90, 3, 5);

INSERT INTO servicos (nome, descricao, preco, duracao_minutos) VALUES
('Banho',               'Banho completo com secagem', 60.00, 60),
('Tosa',                'Tosa higiênica ou completa', 80.00, 90),
('Banho e tosa',        'Combo de banho com tosa completa', 120.00, 150),
('Consulta veterinária','Avaliação clínica geral', 150.00, 40),
('Corte de unhas',      'Corte e lixamento de unhas', 30.00, 20),
('Limpeza de ouvido',   'Limpeza delicada dos ouvidos', 40.00, 25);

INSERT INTO agendamentos (id_animal, id_servico, data_agendamento, horario, status, observacoes) VALUES
(1, 3, (CURRENT_DATE + 1)::date,  '09:00', 'agendado',  'Chegar com 10 min de antecedência'),
(2, 1, (CURRENT_DATE + 2)::date,  '10:30', 'agendado',  NULL),
(5, 4, (CURRENT_DATE + 3)::date,  '14:00', 'agendado',  'Levar histórico vacinal'),
(3, 2, (CURRENT_DATE - 2)::date,  '11:00', 'concluido', 'Tosa completa'),
(6, 1, (CURRENT_DATE - 1)::date,  '16:00', 'concluido', NULL),
(7, 5, (CURRENT_DATE + 5)::date,  '08:30', 'agendado',  NULL);

-- Venda 1: já finalizada (estoque baixado manualmente; o trigger registrou as saídas)
INSERT INTO vendas (id_cliente, data_venda, status, observacoes) VALUES
(1, CURRENT_TIMESTAMP - INTERVAL '3 days', 'pendente', 'Compra de suprimentos');

INSERT INTO itens_venda (id_venda, id_produto, quantidade, preco_unitario) VALUES
(1, 1, 1, 189.90),
(1, 3, 2,  39.90),
(1, 7, 3,  24.90);

UPDATE produtos SET quantidade_estoque = quantidade_estoque - 1 WHERE id_produto = 1;
UPDATE produtos SET quantidade_estoque = quantidade_estoque - 2 WHERE id_produto = 3;
UPDATE produtos SET quantidade_estoque = quantidade_estoque - 3 WHERE id_produto = 7;
UPDATE vendas SET valor_total = calcular_total_venda(1), status = 'finalizada' WHERE id_venda = 1;

-- Venda 2: pendente — ideal para testar a procedure finalizar_venda pela aplicação
INSERT INTO vendas (id_cliente, data_venda, status, observacoes) VALUES
(2, CURRENT_TIMESTAMP - INTERVAL '1 day', 'pendente', 'Finalizar para baixar o estoque');

INSERT INTO itens_venda (id_venda, id_produto, quantidade, preco_unitario) VALUES
(2, 2, 1, 129.90),
(2, 6, 2,  59.90);

UPDATE vendas SET valor_total = calcular_total_venda(2) WHERE id_venda = 2;

-- Venda 3: finalizada
INSERT INTO vendas (id_cliente, data_venda, status, observacoes) VALUES
(4, CURRENT_TIMESTAMP - INTERVAL '5 days', 'pendente', NULL);

INSERT INTO itens_venda (id_venda, id_produto, quantidade, preco_unitario) VALUES
(3, 5, 2, 34.90),
(3, 4, 1, 49.90);

UPDATE produtos SET quantidade_estoque = quantidade_estoque - 2 WHERE id_produto = 5;
UPDATE produtos SET quantidade_estoque = quantidade_estoque - 1 WHERE id_produto = 4;
UPDATE vendas SET valor_total = calcular_total_venda(3), status = 'finalizada' WHERE id_venda = 3;

-- Venda 4: cancelada (sem itens)
INSERT INTO vendas (id_cliente, data_venda, status, observacoes) VALUES
(5, CURRENT_TIMESTAMP - INTERVAL '7 days', 'cancelada', 'Cliente desistiu');

-- Reinicia as sequences para os IDs acompanharem os registros inseridos
SELECT setval(pg_get_serial_sequence('clientes', 'id_cliente'),    (SELECT MAX(id_cliente)    FROM clientes));
SELECT setval(pg_get_serial_sequence('animais', 'id_animal'),      (SELECT MAX(id_animal)      FROM animais));
SELECT setval(pg_get_serial_sequence('produtos', 'id_produto'),    (SELECT MAX(id_produto)    FROM produtos));
SELECT setval(pg_get_serial_sequence('servicos', 'id_servico'),    (SELECT MAX(id_servico)    FROM servicos));
SELECT setval(pg_get_serial_sequence('agendamentos', 'id_agendamento'), (SELECT MAX(id_agendamento) FROM agendamentos));
SELECT setval(pg_get_serial_sequence('vendas', 'id_venda'),        (SELECT MAX(id_venda)       FROM vendas));
SELECT setval(pg_get_serial_sequence('itens_venda', 'id_item'),    (SELECT MAX(id_item)        FROM itens_venda));

-- ============================================================================
-- EXEMPLO DE USO DA PROCEDURE (descomente para testar no psql):
-- CALL finalizar_venda(2, NULL, NULL);
-- SELECT * FROM movimentacoes_estoque ORDER BY data_movimentacao DESC;
-- ============================================================================
