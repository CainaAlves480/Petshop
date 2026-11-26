const { query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError, parseNumber, parseInteger } = require('../config/helpers');

const CAMPOS = `a.id_animal, a.nome, a.especie, a.raca, a.data_nascimento, a.peso, a.sexo,
                a.id_cliente, c.nome_completo AS cliente_nome, a.criado_em`;
const CAMPOS_INSERT = 'id_animal, nome, especie, raca, data_nascimento, peso, sexo, id_cliente, criado_em';

function normalizarSexo(valor) {
  const sexo = String(valor ?? '').trim().toUpperCase();
  if (sexo === '') return null;
  if (!['M', 'F'].includes(sexo)) throw new ApiError(400, 'Sexo deve ser M ou F.');
  return sexo;
}

function dados(body) {
  required(body, ['nome', 'especie', 'id_cliente']);
  return [
    String(body.nome).trim(),
    String(body.especie).trim().toLowerCase(),
    String(body.raca ?? '').trim() || null,
    String(body.data_nascimento ?? '').trim() || null,
    parseNumber(body.peso, 'Peso', { min: 0.01, allowEmpty: true }),
    normalizarSexo(body.sexo),
    parseInteger(body.id_cliente, 'ID do cliente', { min: 1 }),
  ];
}

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `SELECT ${CAMPOS}
       FROM animais a
       JOIN clientes c ON c.id_cliente = a.id_cliente
      WHERE a.nome ILIKE $1 OR a.especie ILIKE $1 OR c.nome_completo ILIKE $1
      ORDER BY a.nome`,
    [termo]
  );
  res.json(rows);
});

exports.buscar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do animal');
  const { rows } = await query(
    `SELECT ${CAMPOS} FROM animais a JOIN clientes c ON c.id_cliente = a.id_cliente WHERE a.id_animal = $1`,
    [id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Animal não encontrado.');
  res.json(rows[0]);
});

exports.criar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO animais (nome, especie, raca, data_nascimento, peso, sexo, id_cliente)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${CAMPOS_INSERT}`,
    dados(req.body)
  );
  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do animal');
  const valores = dados(req.body);

  const { rows } = await query(
    `UPDATE animais a
        SET nome = $1, especie = $2, raca = $3, data_nascimento = $4,
            peso = $5, sexo = $6, id_cliente = $7
      WHERE a.id_animal = $8
      RETURNING ${CAMPOS}`,
    [...valores, id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Animal não encontrado.');
  res.json(rows[0]);
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do animal');
  const { rowCount } = await query('DELETE FROM animais WHERE id_animal = $1', [id]);

  if (rowCount === 0) throw new ApiError(404, 'Animal não encontrado.');
  res.status(204).send();
});
