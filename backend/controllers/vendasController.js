const { pool, query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError, parseInteger } = require('../config/helpers');

const CAMPOS_VENDA = `v.id_venda, v.data_venda, v.valor_total, v.status, v.observacoes,
                      c.id_cliente, c.nome_completo AS cliente_nome,
                      (SELECT COUNT(*)::int FROM itens_venda iv WHERE iv.id_venda = v.id_venda) AS quantidade_itens`;

async function obterVenda(id, executor = { query }) {
  const { rows } = await executor.query(
    `SELECT ${CAMPOS_VENDA} FROM vendas v JOIN clientes c ON c.id_cliente = v.id_cliente WHERE v.id_venda = $1`,
    [id]
  );
  if (rows.length === 0) throw new ApiError(404, 'Venda não encontrada.');
  return rows[0];
}

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `SELECT ${CAMPOS_VENDA}
       FROM vendas v
       JOIN clientes c ON c.id_cliente = v.id_cliente
      WHERE c.nome_completo ILIKE $1 OR v.id_venda::text LIKE $1
      ORDER BY v.data_venda DESC`,
    [termo]
  );
  res.json(rows);
});

exports.detalhes = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID da venda');
  const venda = await obterVenda(id);

  const { rows: itens } = await query(
    `SELECT iv.id_item, iv.id_produto, p.nome AS produto_nome, iv.quantidade,
            iv.preco_unitario, (iv.quantidade * iv.preco_unitario) AS subtotal
       FROM itens_venda iv
       JOIN produtos p ON p.id_produto = iv.id_produto
      WHERE iv.id_venda = $1
      ORDER BY iv.id_item`,
    [id]
  );

  res.json({ ...venda, itens });
});

exports.criar = asyncHandler(async (req, res) => {
  required(req.body, ['id_cliente']);
  const idCliente = parseInteger(req.body.id_cliente, 'ID do cliente', { min: 1 });

  const { rows: clientes } = await query('SELECT id_cliente FROM clientes WHERE id_cliente = $1', [idCliente]);
  if (clientes.length === 0) throw new ApiError(404, 'Cliente não encontrado.');

  const { rows } = await query(
    `INSERT INTO vendas (id_cliente, observacoes)
     VALUES ($1, $2)
     RETURNING id_venda, data_venda, valor_total, status`,
    [idCliente, String(req.body.observacoes ?? '').trim() || null]
  );

  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID da venda');
  required(req.body, ['id_cliente']);

  const atual = await obterVenda(id);
  if (atual.status !== 'pendente') {
    throw new ApiError(400, 'Só é possível editar vendas pendentes.');
  }

  const { rows } = await query(
    `UPDATE vendas
        SET id_cliente = $1, observacoes = $2
      WHERE id_venda = $3
      RETURNING id_venda, data_venda, valor_total, status`,
    [
      parseInteger(req.body.id_cliente, 'ID do cliente', { min: 1 }),
      String(req.body.observacoes ?? '').trim() || null,
      id,
    ]
  );

  res.json(rows[0]);
});

exports.adicionarItem = asyncHandler(async (req, res) => {
  const idVenda = parseId(req.params.id, 'ID da venda');
  required(req.body, ['id_produto', 'quantidade']);

  const idProduto = parseInteger(req.body.id_produto, 'ID do produto', { min: 1 });
  const quantidade = parseInteger(req.body.quantidade, 'Quantidade', { min: 1 });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: vendas } = await client.query(
      'SELECT status FROM vendas WHERE id_venda = $1 FOR UPDATE',
      [idVenda]
    );
    if (vendas.length === 0) throw new ApiError(404, 'Venda não encontrada.');
    if (vendas[0].status !== 'pendente') {
      throw new ApiError(400, 'Só é possível adicionar itens a vendas pendentes.');
    }

    const { rows: produtos } = await client.query(
      'SELECT id_produto, nome, preco_venda, quantidade_estoque FROM produtos WHERE id_produto = $1 FOR UPDATE',
      [idProduto]
    );
    if (produtos.length === 0) throw new ApiError(404, 'Produto não encontrado.');

    const { rows: existentes } = await client.query(
      'SELECT id_item, quantidade FROM itens_venda WHERE id_venda = $1 AND id_produto = $2',
      [idVenda, idProduto]
    );

    const quantidadeFinal = (existentes[0]?.quantidade || 0) + quantidade;
    if (produtos[0].quantidade_estoque < quantidadeFinal) {
      throw new ApiError(
        400,
        `Estoque insuficiente para "${produtos[0].nome}". Disponível: ${produtos[0].quantidade_estoque}.`
      );
    }

    let item;
    if (existentes.length > 0) {
      const atualiza = await client.query(
        'UPDATE itens_venda SET quantidade = $1 WHERE id_item = $2 RETURNING *',
        [quantidadeFinal, existentes[0].id_item]
      );
      item = atualiza.rows[0];
    } else {
      const insere = await client.query(
        `INSERT INTO itens_venda (id_venda, id_produto, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [idVenda, idProduto, quantidade, produtos[0].preco_venda]
      );
      item = insere.rows[0];
    }

    const total = await client.query('SELECT calcular_total_venda($1) AS total', [idVenda]);
    await client.query('UPDATE vendas SET valor_total = $1 WHERE id_venda = $2', [total.rows[0].total, idVenda]);

    await client.query('COMMIT');
    res.status(201).json({ item, valor_total: total.rows[0].total });
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
});

exports.removerItem = asyncHandler(async (req, res) => {
  const idVenda = parseId(req.params.id, 'ID da venda');
  const idItem = parseId(req.params.itemId, 'ID do item');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: vendas } = await client.query(
      'SELECT status FROM vendas WHERE id_venda = $1 FOR UPDATE',
      [idVenda]
    );
    if (vendas.length === 0) throw new ApiError(404, 'Venda não encontrada.');
    if (vendas[0].status !== 'pendente') {
      throw new ApiError(400, 'Só é possível remover itens de vendas pendentes.');
    }

    const removido = await client.query(
      'DELETE FROM itens_venda WHERE id_item = $1 AND id_venda = $2',
      [idItem, idVenda]
    );
    if (removido.rowCount === 0) throw new ApiError(404, 'Item não encontrado nesta venda.');

    const total = await client.query('SELECT calcular_total_venda($1) AS total', [idVenda]);
    await client.query('UPDATE vendas SET valor_total = $1 WHERE id_venda = $2', [total.rows[0].total, idVenda]);

    await client.query('COMMIT');
    res.json({ message: 'Item removido.', valor_total: total.rows[0].total });
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
});

exports.finalizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID da venda');

  // Chamada real da PROCEDURE do PostgreSQL (não é simulada em JavaScript).
  const { rows } = await query('CALL finalizar_venda($1, NULL, NULL)', [id]);
  const retorno = rows[0] || {};
  const sucesso = retorno.p_sucesso ?? retorno.sucesso ?? true;
  const mensagem = retorno.p_mensagem || retorno.mensagem || 'Venda finalizada com sucesso.';

  if (sucesso === false) throw new ApiError(400, mensagem);

  const venda = await obterVenda(id);
  res.json({ message: mensagem, venda });
});

exports.cancelar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID da venda');
  const atual = await obterVenda(id);

  if (atual.status !== 'pendente') {
    throw new ApiError(400, 'Só é possível cancelar vendas pendentes.');
  }

  const { rows } = await query(
    `UPDATE vendas SET status = 'cancelada' WHERE id_venda = $1 RETURNING id_venda, status`,
    [id]
  );
  res.json({ message: 'Venda cancelada.', venda: rows[0] });
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID da venda');
  const atual = await obterVenda(id);

  if (atual.status !== 'pendente') {
    throw new ApiError(400, 'Só é possível excluir vendas pendentes.');
  }

  const { rowCount } = await query('DELETE FROM vendas WHERE id_venda = $1', [id]);
  if (rowCount === 0) throw new ApiError(404, 'Venda não encontrada.');
  res.status(204).send();
});
