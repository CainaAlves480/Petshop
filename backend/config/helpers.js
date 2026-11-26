class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envelopa controllers assíncronos e encaminha erros para o middleware do server.js.
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseId(valor, nome = 'ID') {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `${nome} inválido.`);
  }
  return id;
}

function required(body, campos) {
  for (const campo of campos) {
    const valor = body[campo];
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      throw new ApiError(400, `O campo "${campo}" é obrigatório.`);
    }
  }
}

function parseNumber(valor, nome, { min = 0, allowEmpty = false } = {}) {
  if (allowEmpty && (valor === undefined || valor === null || valor === '')) {
    return null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < min) {
    throw new ApiError(400, `${nome} deve ser um número maior ou igual a ${min}.`);
  }
  return numero;
}

function parseInteger(valor, nome, { min = 0, allowEmpty = false } = {}) {
  const numero = parseNumber(valor, nome, { min, allowEmpty });
  if (numero === null) return null;
  if (!Number.isInteger(numero)) {
    throw new ApiError(400, `${nome} deve ser um número inteiro.`);
  }
  return numero;
}

module.exports = { ApiError, asyncHandler, parseId, required, parseNumber, parseInteger };
