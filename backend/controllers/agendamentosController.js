const { query } = require('../config/database');
const { asyncHandler, parseId, required, ApiError, parseInteger } = require('../config/helpers');

const STATUS = ['agendado', 'concluido', 'cancelado'];

const CAMPOS = `ag.id_agendamento, ag.id_animal, ag.id_servico, ag.data_agendamento,
                ag.horario, ag.status, ag.observacoes, ag.criado_em,
                an.nome AS animal_nome, c.nome_completo AS cliente_nome,
                s.nome AS servico_nome`;
const CAMPOS_PROPRIOS = `id_agendamento, id_animal, id_servico, data_agendamento,
                         horario, status, observacoes, criado_em`;

function normalizarStatus(valor) {
  const status = String(valor ?? 'agendado').trim().toLowerCase();
  if (!STATUS.includes(status)) {
    throw new ApiError(400, 'Status inválido. Use agendado, concluido ou cancelado.');
  }
  return status;
}

function dados(body) {
  required(body, ['id_animal', 'id_servico', 'data_agendamento', 'horario']);
  return [
    parseInteger(body.id_animal, 'ID do animal', { min: 1 }),
    parseInteger(body.id_servico, 'ID do serviço', { min: 1 }),
    String(body.data_agendamento).trim(),
    String(body.horario).trim(),
    normalizarStatus(body.status),
    String(body.observacoes ?? '').trim() || null,
  ];
}

exports.listar = asyncHandler(async (req, res) => {
  const termo = `%${String(req.query.q || '').trim()}%`;
  const { rows } = await query(
    `SELECT ${CAMPOS}
       FROM agendamentos ag
       JOIN animais an ON an.id_animal = ag.id_animal
       JOIN clientes c ON c.id_cliente = an.id_cliente
       JOIN servicos s ON s.id_servico = ag.id_servico
      WHERE an.nome ILIKE $1 OR c.nome_completo ILIKE $1 OR s.nome ILIKE $1
      ORDER BY ag.data_agendamento, ag.horario`,
    [termo]
  );
  res.json(rows);
});

exports.buscar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do agendamento');
  const { rows } = await query(
    `SELECT ${CAMPOS}
       FROM agendamentos ag
       JOIN animais an ON an.id_animal = ag.id_animal
       JOIN clientes c ON c.id_cliente = an.id_cliente
       JOIN servicos s ON s.id_servico = ag.id_servico
      WHERE ag.id_agendamento = $1`,
    [id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Agendamento não encontrado.');
  res.json(rows[0]);
});

exports.criar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO agendamentos (id_animal, id_servico, data_agendamento, horario, status, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${CAMPOS_PROPRIOS}`,
    dados(req.body)
  );
  res.status(201).json(rows[0]);
});

exports.atualizar = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do agendamento');
  const { rows } = await query(
    `UPDATE agendamentos ag
        SET id_animal = $1, id_servico = $2, data_agendamento = $3,
            horario = $4, status = $5, observacoes = $6
      WHERE ag.id_agendamento = $7
      RETURNING ${CAMPOS_PROPRIOS}`,
    [...dados(req.body), id]
  );

  if (rows.length === 0) throw new ApiError(404, 'Agendamento não encontrado.');
  res.json(rows[0]);
});

exports.excluir = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'ID do agendamento');
  const { rowCount } = await query('DELETE FROM agendamentos WHERE id_agendamento = $1', [id]);

  if (rowCount === 0) throw new ApiError(404, 'Agendamento não encontrado.');
  res.status(204).send();
});
