const { query } = require('../config/database');
const { asyncHandler } = require('../config/helpers');

exports.resumo = asyncHandler(async (req, res) => {
  const [indicadores, estoqueBaixo, proximos] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM clientes) AS clientes,
        (SELECT COUNT(*)::int FROM animais) AS animais,
        (SELECT COUNT(*)::int FROM produtos) AS produtos,
        (SELECT COUNT(*)::int FROM agendamentos WHERE status = 'concluido') AS servicos_realizados,
        (SELECT COUNT(*)::int FROM vendas WHERE status = 'finalizada') AS total_vendas,
        (SELECT COALESCE(SUM(valor_total), 0) FROM vendas WHERE status = 'finalizada') AS faturamento
    `),
    query(`
      SELECT id_produto, nome, quantidade_estoque, estoque_minimo
        FROM produtos
       WHERE quantidade_estoque <= estoque_minimo
       ORDER BY nome
    `),
    query(`
      SELECT ag.id_agendamento, ag.data_agendamento, ag.horario, ag.status,
             an.nome AS animal_nome, c.nome_completo AS cliente_nome, s.nome AS servico_nome
        FROM agendamentos ag
        JOIN animais an ON an.id_animal = ag.id_animal
        JOIN clientes c ON c.id_cliente = an.id_cliente
        JOIN servicos s ON s.id_servico = ag.id_servico
       WHERE ag.status = 'agendado' AND ag.data_agendamento >= CURRENT_DATE
       ORDER BY ag.data_agendamento, ag.horario
       LIMIT 5
    `),
  ]);

  const i = indicadores.rows[0];

  res.json({
    clientes: i.clientes,
    animais: i.animais,
    produtos: i.produtos,
    servicosRealizados: i.servicos_realizados,
    totalVendas: i.total_vendas,
    faturamento: Number(i.faturamento),
    estoqueBaixo: estoqueBaixo.rows,
    proximosAgendamentos: proximos.rows,
  });
});
