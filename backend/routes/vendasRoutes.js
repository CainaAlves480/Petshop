const express = require('express');
const controller = require('../controllers/vendasController');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id/detalhes', controller.detalhes);
router.get('/:id', controller.detalhes);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.post('/:id/itens', controller.adicionarItem);
router.delete('/:id/itens/:itemId', controller.removerItem);
router.post('/:id/finalizar', controller.finalizar);
router.post('/:id/cancelar', controller.cancelar);
router.delete('/:id', controller.excluir);

module.exports = router;
