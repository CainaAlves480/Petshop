const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');

async function carregar() {
  try {
    const servicos = await App.request('/servicos?q=' + encodeURIComponent(busca.value.trim()));
    contador.textContent = `${servicos.length} registro(s)`;

    tbody.innerHTML = servicos.length
      ? servicos.map((s) => `
          <tr>
            <td class="strong">${App.escapeHtml(s.nome)}</td>
            <td>${App.escapeHtml(s.descricao || '-')}</td>
            <td class="right">${App.money(s.preco)}</td>
            <td class="right">${s.duracao_minutos} min</td>
            <td class="actions">
              <button class="btn btn-sm btn-ghost" data-editar="${s.id_servico}">Editar</button>
              <button class="btn btn-sm btn-danger" data-excluir="${s.id_servico}">Excluir</button>
            </td>
          </tr>`).join('')
      : App.emptyRow(5, 'Nenhum serviço encontrado.');
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

function formulario(s = {}) {
  return `
    <div class="form-grid">
      <div class="form-field full">
        <label for="nome">Nome do serviço *</label>
        <input id="nome" name="nome" required maxlength="100" value="${App.escapeHtml(s.nome || '')}" placeholder="Banho, Tosa, Consulta...">
      </div>
      <div>
        <label for="preco">Preço (R$) *</label>
        <input id="preco" type="number" step="0.01" min="0" name="preco" required value="${App.escapeHtml(s.preco ?? '')}">
      </div>
      <div>
        <label for="duracao_minutos">Duração estimada (min) *</label>
        <input id="duracao_minutos" type="number" step="1" min="1" name="duracao_minutos" required value="${App.escapeHtml(s.duracao_minutos ?? '')}">
      </div>
      <div class="form-field full">
        <label for="descricao">Descrição</label>
        <textarea id="descricao" name="descricao" rows="2">${App.escapeHtml(s.descricao || '')}</textarea>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  carregar();

  document.getElementById('btnNovo').addEventListener('click', () => {
    App.openModal({
      title: 'Novo serviço',
      body: formulario(),
      submitLabel: 'Cadastrar',
      onSubmit: async (dados) => {
        await App.request('/servicos', { method: 'POST', body: dados });
        await carregar();
        return 'Serviço cadastrado com sucesso.';
      },
    });
  });

  busca.addEventListener('input', App.debounce(carregar));

  tbody.addEventListener('click', async (evento) => {
    const botaoEditar = evento.target.closest('[data-editar]');
    const botaoExcluir = evento.target.closest('[data-excluir]');

    if (botaoEditar) {
      const id = Number(botaoEditar.dataset.editar);
      try {
        const servico = await App.request('/servicos/' + id);
        App.openModal({
          title: 'Editar serviço',
          body: formulario(servico),
          onSubmit: async (dados) => {
            await App.request('/servicos/' + id, { method: 'PUT', body: dados });
            await carregar();
            return 'Serviço atualizado com sucesso.';
          },
        });
      } catch (erro) {
        App.toast(erro.message, 'error');
      }
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.excluir);
      App.confirmAction({
        title: 'Excluir serviço',
        message: 'Deseja realmente excluir este serviço?',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await App.request('/servicos/' + id, { method: 'DELETE' });
          await carregar();
          return 'Serviço excluído.';
        },
      });
    }
  });
});
