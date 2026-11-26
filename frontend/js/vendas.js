const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');
const corpoDetalhe = document.getElementById('detalheCorpo');
const acoesDetalhe = document.getElementById('detalheAcoes');
const subtituloDetalhe = document.getElementById('detalheSubtitulo');

let vendas = [];
let clientes = [];
let produtos = [];
let selecionada = null;
let detalhe = null;

function badgeStatus(status) {
  const classe = status === 'finalizada' ? 'success' : status === 'cancelada' ? 'danger' : 'warning';
  return `<span class="badge ${classe}">${App.escapeHtml(status)}</span>`;
}

async function carregarAuxiliares() {
  [clientes, produtos] = await Promise.all([
    App.request('/clientes'),
    App.request('/produtos'),
  ]);
}

async function carregarVendas() {
  const lista = await App.request('/vendas?q=' + encodeURIComponent(busca.value.trim()));
  vendas = lista;
  contador.textContent = `${vendas.length} venda(s)`;

  tbody.innerHTML = vendas.length
    ? vendas.map((v) => `
        <tr data-id="${v.id_venda}" style="cursor:pointer;" class="${v.id_venda === selecionada ? 'strong' : ''}">
          <td>#${v.id_venda}</td>
          <td class="nowrap">${App.date(v.data_venda, true)}</td>
          <td>${App.escapeHtml(v.cliente_nome)}</td>
          <td class="right">${App.money(v.valor_total)}</td>
          <td>${badgeStatus(v.status)}</td>
        </tr>`).join('')
    : App.emptyRow(5, 'Nenhuma venda encontrada.');
}

function renderDetalheVazio() {
  subtituloDetalhe.textContent = 'Selecione uma venda na lista';
  acoesDetalhe.innerHTML = '';
  corpoDetalhe.innerHTML = `
    <div class="empty-state">
      <strong>Nenhuma venda selecionada</strong>
      Clique em uma venda para ver os itens e as ações disponíveis.
    </div>`;
}

function renderDetalhe() {
  if (!detalhe) return renderDetalheVazio();

  const pendente = detalhe.status === 'pendente';
  subtituloDetalhe.textContent = `Venda #${detalhe.id_venda} · ${App.date(detalhe.data_venda, true)}`;

  acoesDetalhe.innerHTML = pendente ? `
    <button class="btn btn-sm btn-primary" id="btnAddItem">+ Item</button>
    <button class="btn btn-sm btn-ghost" id="btnEditarVenda">Editar</button>
    <button class="btn btn-sm btn-warning" id="btnFinalizar">Finalizar</button>
    <button class="btn btn-sm btn-ghost" id="btnCancelar">Cancelar</button>
    <button class="btn btn-sm btn-danger" id="btnExcluirVenda">Excluir</button>` : '';

  const itens = detalhe.itens.length
    ? detalhe.itens.map((item) => `
        <tr>
          <td>${App.escapeHtml(item.produto_nome)}</td>
          <td class="right">${item.quantidade}</td>
          <td class="right">${App.money(item.preco_unitario)}</td>
          <td class="right strong">${App.money(item.subtotal)}</td>
          ${pendente ? `<td class="actions"><button class="btn btn-sm btn-danger" data-remover="${item.id_item}">Remover</button></td>` : ''}
        </tr>`).join('')
    : App.emptyRow(pendente ? 5 : 4, 'Nenhum item adicionado ainda.');

  corpoDetalhe.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><span>Cliente</span><strong>${App.escapeHtml(detalhe.cliente_nome)}</strong></div>
      <div class="detail-item"><span>Status</span><strong>${badgeStatus(detalhe.status)}</strong></div>
      <div class="detail-item"><span>Itens</span><strong>${detalhe.itens.length}</strong></div>
      <div class="detail-item"><span>Observações</span><strong>${App.escapeHtml(detalhe.observacoes || '-')}</strong></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Produto</th><th class="right">Qtd.</th><th class="right">Preço unit.</th><th class="right">Subtotal</th>${pendente ? '<th></th>' : ''}</tr></thead>
        <tbody>${itens}</tbody>
      </table>
    </div>

    <div class="total-line">
      <span class="muted">Total calculado pela FUNCTION do banco:</span>
      <strong>${App.money(detalhe.valor_total)}</strong>
    </div>`;

  document.getElementById('btnAddItem')?.addEventListener('click', abrirItem);
  document.getElementById('btnEditarVenda')?.addEventListener('click', editarVenda);
  document.getElementById('btnFinalizar')?.addEventListener('click', finalizarVenda);
  document.getElementById('btnCancelar')?.addEventListener('click', cancelarVenda);
  document.getElementById('btnExcluirVenda')?.addEventListener('click', excluirVenda);
}

async function selecionarVenda(id) {
  selecionada = id;
  try {
    detalhe = await App.request('/vendas/' + id + '/detalhes');
    await carregarVendas();
    renderDetalhe();
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

async function atualizarTudo() {
  await carregarAuxiliares();
  await carregarVendas();
  if (selecionada) await selecionarVenda(selecionada);
  else renderDetalheVazio();
}

function formularioVenda(v = {}) {
  return `
    <div class="form-grid">
      <div class="form-field full">
        <label for="id_cliente">Cliente *</label>
        <select id="id_cliente" name="id_cliente" required></select>
      </div>
      <div class="form-field full">
        <label for="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" rows="2">${App.escapeHtml(v.observacoes || '')}</textarea>
      </div>
    </div>`;
}

function novaVenda() {
  App.openModal({
    title: 'Nova venda',
    body: formularioVenda(),
    submitLabel: 'Criar venda',
    onOpen: (form) => App.fillSelect(form.elements.id_cliente, clientes, 'id_cliente', 'nome_completo', 'Selecione o cliente'),
    onSubmit: async (dados) => {
      const venda = await App.request('/vendas', { method: 'POST', body: dados });
      await atualizarTudo();
      await selecionarVenda(venda.id_venda);
      return `Venda #${venda.id_venda} criada. Adicione os produtos.`;
    },
  });
}

function editarVenda() {
  if (!detalhe || detalhe.status !== 'pendente') return;

  App.openModal({
    title: 'Editar venda',
    body: formularioVenda(detalhe),
    submitLabel: 'Salvar',
    onOpen: (form) => {
      App.fillSelect(form.elements.id_cliente, clientes, 'id_cliente', 'nome_completo', 'Selecione o cliente');
      form.elements.id_cliente.value = String(detalhe.id_cliente);
    },
    onSubmit: async (dados) => {
      await App.request('/vendas/' + selecionada, { method: 'PUT', body: dados });
      await atualizarTudo();
      return 'Venda atualizada.';
    },
  });
}

function abrirItem() {
  if (!detalhe || detalhe.status !== 'pendente') return;

  const opcoes = produtos.map((p) => ({
    id_produto: p.id_produto,
    label: `${p.nome} - ${App.money(p.preco_venda)} (estoque: ${p.quantidade_estoque})`,
  }));

  App.openModal({
    title: 'Adicionar produto à venda',
    body: `
      <div class="form-grid">
        <div class="form-field full">
          <label for="id_produto">Produto *</label>
          <select id="id_produto" name="id_produto" required></select>
        </div>
        <div>
          <label for="quantidade">Quantidade *</label>
          <input id="quantidade" type="number" min="1" step="1" name="quantidade" value="1" required>
        </div>
      </div>`,
    submitLabel: 'Adicionar',
    onOpen: (form) => App.fillSelect(form.elements.id_produto, opcoes, 'id_produto', 'label', 'Selecione o produto'),
    onSubmit: async (dados) => {
      await App.request('/vendas/' + selecionada + '/itens', { method: 'POST', body: dados });
      await atualizarTudo();
      return 'Item adicionado e total recalculado.';
    },
  });
}

function finalizarVenda() {
  App.confirmAction({
    title: 'Finalizar venda',
    message: 'A PROCEDURE finalizar_venda vai validar o estoque, baixar os produtos e calcular o total. Deseja continuar?',
    confirmLabel: 'Finalizar',
    onConfirm: async () => {
      const resposta = await App.request('/vendas/' + selecionada + '/finalizar', { method: 'POST' });
      await atualizarTudo();
      return resposta.message || 'Venda finalizada.';
    },
  });
}

function cancelarVenda() {
  App.confirmAction({
    title: 'Cancelar venda',
    message: 'Deseja cancelar esta venda? O estoque não será alterado.',
    confirmLabel: 'Cancelar venda',
    onConfirm: async () => {
      await App.request('/vendas/' + selecionada + '/cancelar', { method: 'POST' });
      await atualizarTudo();
      return 'Venda cancelada.';
    },
  });
}

function excluirVenda() {
  App.confirmAction({
    title: 'Excluir venda',
    message: 'Deseja excluir esta venda pendente e todos os seus itens?',
    confirmLabel: 'Excluir',
    onConfirm: async () => {
      await App.request('/vendas/' + selecionada, { method: 'DELETE' });
      selecionada = null;
      detalhe = null;
      await carregarVendas();
      renderDetalheVazio();
      return 'Venda excluída.';
    },
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await atualizarTudo();
  } catch (erro) {
    App.toast(erro.message, 'error');
  }

  document.getElementById('btnNovaVenda').addEventListener('click', () => {
    if (clientes.length === 0) {
      App.toast('Cadastre um cliente antes de registrar uma venda.', 'warning');
      return;
    }
    novaVenda();
  });

  busca.addEventListener('input', App.debounce(async () => {
    try {
      await carregarVendas();
    } catch (erro) {
      App.toast(erro.message, 'error');
    }
  }));

  tbody.addEventListener('click', (evento) => {
    const linha = evento.target.closest('tr[data-id]');
    if (linha) selecionarVenda(Number(linha.dataset.id));
  });

  corpoDetalhe.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-remover]');
    if (!botao) return;

    const idItem = Number(botao.dataset.remover);
    App.confirmAction({
      title: 'Remover item',
      message: 'Deseja remover este item da venda?',
      confirmLabel: 'Remover',
      onConfirm: async () => {
        await App.request('/vendas/' + selecionada + '/itens/' + idItem, { method: 'DELETE' });
        await atualizarTudo();
        return 'Item removido.';
      },
    });
  });
});
