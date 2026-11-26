const { query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError, parseNumber, parseInteger } = require('../config/helpers');

function dados(body) {
  required(body, ['nome', 'preco', 'duracao_minutos']);
  return [
    String(body.nome).trim(),
    String(body.descricao ?? '').trim() || null,
    parseNumber(body.preco, 'Preço', { min: 0 }),
    parseInteger(body.duracao_minutos, 'Duração estimada', { min: 1 }),
  ];
}

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `SELECT id_servico, nome, descricao, preco, duracao_minutos
       FROM servicos
      WHERE nome ILIKE $1 OR descricao ILIKE $1
      ORDER BY nome`,
    [termo]
  );
  res.json(rows);
});

exports.buscar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do serviço');
  const { rows } = await query(
    'SELECT id_servico, nome, descricao, preco, duracao_minutos FROM servicos WHERE id_servico = $1',
    [id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Serviço não encontrado.');
  res.json(rows[0]);
});

exports.criar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO servicos (nome, descricao, preco, duracao_minutos)
     VALUES ($1, $2, $3, $4)
     RETURNING id_servico, nome, descricao, preco, duracao_minutos`,
    dados(req.body)
  );
  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do serviço');
  const { rows } = await query(
    `UPDATE servicos
        SET nome = $1, descricao = $2, preco = $3, duracao_minutos = $4
      WHERE id_servico = $5
      RETURNING id_servico, nome, descricao, preco, duracao_minutos`,
    [...dados(req.body), id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Serviço não encontrado.');
  res.json(rows[0]);
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do serviço');
  const { rowCount } = await query('DELETE FROM servicos WHERE id_servico = $1', [id]);

  if (rowCount === 0) throw new ApiError(404, 'Serviço não encontrado.');
  res.status(204).send();
});
