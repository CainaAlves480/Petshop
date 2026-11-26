const { query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError, parseNumber, parseInteger } = require('../config/helpers');

function dados(body) {
  required(body, ['nome', 'preco_venda', 'quantidade_estoque', 'estoque_minimo']);
  return [
    String(body.nome).trim(),
    String(body.categoria ?? '').trim() || null,
    String(body.descricao ?? '').trim() || null,
    parseNumber(body.preco_venda, 'Preço de venda', { min: 0 }),
    parseInteger(body.quantidade_estoque, 'Quantidade em estoque', { min: 0 }),
    parseInteger(body.estoque_minimo, 'Estoque mínimo', { min: 0 }),
  ];
}

const SELECT_BASE = `SELECT id_produto, nome, categoria, descricao, preco_venda,
                            quantidade_estoque, estoque_minimo, criado_em,
                            (quantidade_estoque <= estoque_minimo) AS estoque_baixo
                       FROM produtos`;

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `${SELECT_BASE}
      WHERE nome ILIKE $1 OR categoria ILIKE $1
      ORDER BY (quantidade_estoque <= estoque_minimo) DESC, nome`,
    [termo]
  );
  res.json(rows);
});

exports.estoqueBaixo = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${SELECT_BASE} WHERE quantidade_estoque <= estoque_minimo ORDER BY nome`
  );
  res.json(rows);
});

exports.buscar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do produto');
  const { rows } = await query(`${SELECT_BASE} WHERE id_produto = $1`, [id]);

  if (rows.length === 0) throw new ApiError(404, 'Produto não encontrado.');
  res.json(rows[0]);
});

exports.criar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO produtos (nome, categoria, descricao, preco_venda, quantidade_estoque, estoque_minimo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_produto, nome, categoria, descricao, preco_venda,
               quantidade_estoque, estoque_minimo, criado_em,
               (quantidade_estoque <= estoque_minimo) AS estoque_baixo`,
    dados(req.body)
  );
  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do produto');
  const { rows } = await query(
    `UPDATE produtos
        SET nome = $1, categoria = $2, descricao = $3, preco_venda = $4,
            quantidade_estoque = $5, estoque_minimo = $6
      WHERE id_produto = $7
      RETURNING id_produto, nome, categoria, descricao, preco_venda,
                quantidade_estoque, estoque_minimo, criado_em,
                (quantidade_estoque <= estoque_minimo) AS estoque_baixo`,
    [...dados(req.body), id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Produto não encontrado.');
  res.json(rows[0]);
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do produto');
  const { rowCount } = await query('DELETE FROM produtos WHERE id_produto = $1', [id]);

  if (rowCount === 0) throw new ApiError(404, 'Produto não encontrado.');
  res.status(204).send();
});
