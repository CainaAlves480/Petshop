require('dotenv').config();

const express = require('express');
const path = require('path');

const { ApiError } = require('./config/helpers');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/clientes', require('./routes/clientesRoutes'));
app.use('/api/animais', require('./routes/animaisRoutes'));
app.use('/api/produtos', require('./routes/produtosRoutes'));
app.use('/api/servicos', require('./routes/servicosRoutes'));
app.use('/api/agendamentos', require('./routes/agendamentosRoutes'));
app.use('/api/vendas', require('./routes/vendasRoutes'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota da API não encontrada.' });
});

// Tradução dos códigos de erro do PostgreSQL para mensagens amigáveis.
app.use((err, req, res, next) => {
  console.error('[ERRO]', err);

  let status = err instanceof ApiError ? err.status : 500;
  let message = err.message || 'Erro interno do servidor.';

  if (err.code === '23505') {
    status = 409;
    message = 'Já existe um registro com estes dados (campo único duplicado).';
  } else if (err.code === '23503' || err.code === '23001') {
    status = 409;
    message = 'Não foi possível concluir: existem registros relacionados a este item.';
  } else if (err.code === '23514' || err.code === '23502') {
    status = 400;
    message = 'Um dos valores informados não atende às regras de validação do banco.';
  } else if (err.code === '22P02' || err.code === '22003') {
    status = 400;
    message = 'Valor numérico ou identificador inválido.';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    status = 503;
    message = 'Não foi possível conectar ao PostgreSQL. Verifique as configurações do banco.';
  }

  res.status(status).json({ error: message });
});

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pet Shop rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
