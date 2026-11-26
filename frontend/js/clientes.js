const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');

async function carregar() {
  try {
    const clientes = await App.request('/clientes?q=' + encodeURIComponent(busca.value.trim()));
    contador.textContent = `${clientes.length} registro(s)`;

    tbody.innerHTML = clientes.length
      ? clientes.map((c) => `
          <tr>
            <td class="strong">${App.escapeHtml(c.nome_completo)}</td>
            <td>${App.escapeHtml(App.cpf(c.cpf))}</td>
            <td>${App.escapeHtml(c.telefone || '-')}</td>
            <td>${App.escapeHtml(c.email || '-')}</td>
            <td>${App.escapeHtml(c.endereco || '-')}</td>
            <td class="actions">
              <button class="btn btn-sm btn-ghost" data-editar="${c.id_cliente}">Editar</button>
              <button class="btn btn-sm btn-danger" data-excluir="${c.id_cliente}">Excluir</button>
            </td>
          </tr>`).join('')
      : App.emptyRow(6, 'Nenhum cliente encontrado para a busca informada.');
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

function formulario(c = {}) {
  return `
    <div class="form-grid">
      <div class="form-field full">
        <label for="nome_completo">Nome completo *</label>
        <input id="nome_completo" name="nome_completo" required maxlength="150" value="${App.escapeHtml(c.nome_completo || '')}">
      </div>
      <div>
        <label for="cpf">CPF *</label>
        <input id="cpf" name="cpf" required inputmode="numeric" maxlength="14" value="${App.escapeHtml(App.cpf(c.cpf))}" placeholder="000.000.000-00">
      </div>
      <div>
        <label for="telefone">Telefone</label>
        <input id="telefone" name="telefone" maxlength="20" value="${App.escapeHtml(c.telefone || '')}" placeholder="(11) 99999-0000">
      </div>
      <div class="form-field full">
        <label for="email">E-mail</label>
        <input id="email" type="email" name="email" maxlength="150" value="${App.escapeHtml(c.email || '')}" placeholder="nome@email.com">
      </div>
      <div class="form-field full">
        <label for="endereco">Endereço</label>
        <textarea id="endereco" name="endereco" rows="2">${App.escapeHtml(c.endereco || '')}</textarea>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  carregar();

  document.getElementById('btnNovo').addEventListener('click', () => {
    App.openModal({
      title: 'Novo cliente',
      body: formulario(),
      submitLabel: 'Cadastrar',
      onOpen: (form) => App.maskCpf(form.elements.cpf),
      onSubmit: async (dados) => {
        await App.request('/clientes', { method: 'POST', body: dados });
        await carregar();
        return 'Cliente cadastrado com sucesso.';
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
        const cliente = await App.request('/clientes/' + id);
        App.openModal({
          title: 'Editar cliente',
          body: formulario(cliente),
          onOpen: (form) => App.maskCpf(form.elements.cpf),
          onSubmit: async (dados) => {
            await App.request('/clientes/' + id, { method: 'PUT', body: dados });
            await carregar();
            return 'Cliente atualizado com sucesso.';
          },
        });
      } catch (erro) {
        App.toast(erro.message, 'error');
      }
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.excluir);
      App.confirmAction({
        title: 'Excluir cliente',
        message: 'Deseja realmente excluir este cliente? Animais vinculados também serão excluídos.',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await App.request('/clientes/' + id, { method: 'DELETE' });
          await carregar();
          return 'Cliente excluído.';
        },
      });
    }
  });
});
