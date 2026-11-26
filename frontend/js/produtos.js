const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');
const soBaixo = document.getElementById('soBaixo');

async function carregar() {
  try {
    const termo = busca.value.trim();
    let produtos = await App.request(
      soBaixo.checked ? '/produtos/estoque-baixo' : '/produtos?q=' + encodeURIComponent(termo)
    );

    if (soBaixo.checked && termo) {
      const alvo = termo.toLowerCase();
      produtos = produtos.filter((p) =>
        p.nome.toLowerCase().includes(alvo) || (p.categoria || '').toLowerCase().includes(alvo)
      );
    }

    contador.textContent = `${produtos.length} registro(s)`;
    tbody.innerHTML = produtos.length
      ? produtos.map((p) => `
          <tr>
            <td class="strong">${App.escapeHtml(p.nome)}<br><span class="muted">${App.escapeHtml(p.descricao || '')}</span></td>
            <td>${App.escapeHtml(p.categoria || '-')}</td>
            <td class="right">${App.money(p.preco_venda)}</td>
            <td class="right ${p.estoque_baixo ? 'strong' : ''}">${p.quantidade_estoque}</td>
            <td class="right muted">${p.estoque_minimo}</td>
            <td><span class="badge ${p.estoque_baixo ? 'warning' : 'success'}">${p.estoque_baixo ? 'Estoque baixo' : 'Normal'}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-ghost" data-editar="${p.id_produto}">Editar</button>
              <button class="btn btn-sm btn-danger" data-excluir="${p.id_produto}">Excluir</button>
            </td>
          </tr>`).join('')
      : App.emptyRow(7, 'Nenhum produto encontrado.');
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

function formulario(p = {}) {
  return `
    <div class="form-grid">
      <div class="form-field full">
        <label for="nome">Nome do produto *</label>
        <input id="nome" name="nome" required maxlength="150" value="${App.escapeHtml(p.nome || '')}">
      </div>
      <div>
        <label for="categoria">Categoria</label>
        <input id="categoria" name="categoria" maxlength="80" value="${App.escapeHtml(p.categoria || '')}" placeholder="Alimentação, Higiene...">
      </div>
      <div>
        <label for="preco_venda">Preço de venda (R$) *</label>
        <input id="preco_venda" type="number" step="0.01" min="0" name="preco_venda" required value="${App.escapeHtml(p.preco_venda ?? '')}">
      </div>
      <div>
        <label for="quantidade_estoque">Quantidade em estoque *</label>
        <input id="quantidade_estoque" type="number" step="1" min="0" name="quantidade_estoque" required value="${App.escapeHtml(p.quantidade_estoque ?? 0)}">
      </div>
      <div>
        <label for="estoque_minimo">Estoque mínimo *</label>
        <input id="estoque_minimo" type="number" step="1" min="0" name="estoque_minimo" required value="${App.escapeHtml(p.estoque_minimo ?? 0)}">
      </div>
      <div class="form-field full">
        <label for="descricao">Descrição</label>
        <textarea id="descricao" name="descricao" rows="2">${App.escapeHtml(p.descricao || '')}</textarea>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  carregar();

  document.getElementById('btnNovo').addEventListener('click', () => {
    App.openModal({
      title: 'Novo produto',
      body: formulario(),
      submitLabel: 'Cadastrar',
      onSubmit: async (dados) => {
        await App.request('/produtos', { method: 'POST', body: dados });
        await carregar();
        return 'Produto cadastrado com sucesso.';
      },
    });
  });

  busca.addEventListener('input', App.debounce(carregar));
  soBaixo.addEventListener('change', carregar);

  tbody.addEventListener('click', async (evento) => {
    const botaoEditar = evento.target.closest('[data-editar]');
    const botaoExcluir = evento.target.closest('[data-excluir]');

    if (botaoEditar) {
      const id = Number(botaoEditar.dataset.editar);
      try {
        const produto = await App.request('/produtos/' + id);
        App.openModal({
          title: 'Editar produto',
          body: formulario(produto),
          onSubmit: async (dados) => {
            await App.request('/produtos/' + id, { method: 'PUT', body: dados });
            await carregar();
            return 'Produto atualizado. Movimentação de estoque registrada se a quantidade mudou.';
          },
        });
      } catch (erro) {
        App.toast(erro.message, 'error');
      }
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.excluir);
      App.confirmAction({
        title: 'Excluir produto',
        message: 'Deseja realmente excluir este produto?',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await App.request('/produtos/' + id, { method: 'DELETE' });
          await carregar();
          return 'Produto excluído.';
        },
      });
    }
  });
});
