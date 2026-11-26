const { query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError } = require('../config/helpers');

const CAMPOS = 'id_cliente, nome_completo, cpf, telefone, email, endereco, criado_em';

function normalizarCpf(valor) {
  const cpf = String(valor || '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    throw new ApiError(400, 'CPF deve conter 11 dígitos.');
  }
  return cpf;
}

function opcional(valor) {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `SELECT ${CAMPOS}
       FROM clientes
      WHERE nome_completo ILIKE $1 OR cpf LIKE $1
      ORDER BY nome_completo`,
    [termo]
  );
  res.json(rows);
});

exports.buscar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do cliente');
  const { rows } = await query(`SELECT ${CAMPOS} FROM clientes WHERE id_cliente = $1`, [id]);

  if (rows.length === 0) throw new ApiError(404, 'Cliente não encontrado.');
  res.json(rows[0]);
});

exports.criar = asyncHandler(async (req, res) => {
  required(req.body, ['nome_completo', 'cpf']);

  const valores = [
    String(req.body.nome_completo).trim(),
    normalizarCpf(req.body.cpf),
    opcional(req.body.telefone),
    opcional(req.body.email),
    opcional(req.body.endereco),
  ];

  const { rows } = await query(
    `INSERT INTO clientes (nome_completo, cpf, telefone, email, endereco)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CAMPOS}`,
    valores
  );

  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do cliente');
  required(req.body, ['nome_completo', 'cpf']);

  const { rows } = await query(
    `UPDATE clientes
        SET nome_completo = $1, cpf = $2, telefone = $3, email = $4, endereco = $5
      WHERE id_cliente = $6
      RETURNING ${CAMPOS}`,
    [
      String(req.body.nome_completo).trim(),
      normalizarCpf(req.body.cpf),
      opcional(req.body.telefone),
      opcional(req.body.email),
      opcional(req.body.endereco),
      id,
    ]
  );

  if (rows.length === 0) throw new ApiError(404, 'Cliente não encontrado.');
  res.json(rows[0]);
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do cliente');
  const { rowCount } = await query('DELETE FROM clientes WHERE id_cliente = $1', [id]);

  if (rowCount === 0) throw new ApiError(404, 'Cliente não encontrado.');
  res.status(204).send();
});
