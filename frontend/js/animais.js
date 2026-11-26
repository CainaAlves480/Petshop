const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');
const ESPECIES = ['cachorro', 'gato', 'ave', 'coelho', 'peixe', 'outro'];
let clientes = [];

async function carregar() {
  try {
    const [animais, listaClientes] = await Promise.all([
      App.request('/animais?q=' + encodeURIComponent(busca.value.trim())),
      App.request('/clientes'),
    ]);
    clientes = listaClientes;
    contador.textContent = `${animais.length} registro(s)`;

    tbody.innerHTML = animais.length
      ? animais.map((a) => `
          <tr>
            <td class="strong">${App.escapeHtml(a.nome)}</td>
            <td><span class="badge info">${App.escapeHtml(a.especie)}</span></td>
            <td>${App.escapeHtml(a.raca || '-')}</td>
            <td>${App.date(a.data_nascimento)}</td>
            <td class="right">${a.peso ? Number(a.peso).toFixed(2).replace('.', ',') + ' kg' : '-'}</td>
            <td>${App.escapeHtml(a.cliente_nome)}</td>
            <td class="actions">
              <button class="btn btn-sm btn-ghost" data-editar="${a.id_animal}">Editar</button>
              <button class="btn btn-sm btn-danger" data-excluir="${a.id_animal}">Excluir</button>
            </td>
          </tr>`).join('')
      : App.emptyRow(7, 'Nenhum animal encontrado para a busca informada.');
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

function opcoes(lista, selecionado) {
  return lista.map((valor) =>
    `<option value="${valor}" ${valor === selecionado ? 'selected' : ''}>${valor}</option>`
  ).join('');
}

function formulario(a = {}) {
  return `
    <div class="form-grid">
      <div>
        <label for="nome">Nome do animal *</label>
        <input id="nome" name="nome" required maxlength="100" value="${App.escapeHtml(a.nome || '')}">
      </div>
      <div>
        <label for="especie">Espécie *</label>
        <select id="especie" name="especie" required>${opcoes(ESPECIES, a.especie)}</select>
      </div>
      <div>
        <label for="raca">Raça</label>
        <input id="raca" name="raca" maxlength="80" value="${App.escapeHtml(a.raca || '')}">
      </div>
      <div>
        <label for="data_nascimento">Data de nascimento</label>
        <input id="data_nascimento" type="date" name="data_nascimento" value="${App.escapeHtml(a.data_nascimento || '')}">
      </div>
      <div>
        <label for="peso">Peso (kg)</label>
        <input id="peso" type="number" step="0.01" min="0.01" name="peso" value="${App.escapeHtml(a.peso || '')}" placeholder="0,00">
      </div>
      <div>
        <label for="sexo">Sexo</label>
        <select id="sexo" name="sexo">
          <option value="" ${!a.sexo ? 'selected' : ''}>Não informado</option>
          <option value="M" ${a.sexo === 'M' ? 'selected' : ''}>Macho</option>
          <option value="F" ${a.sexo === 'F' ? 'selected' : ''}>Fêmea</option>
        </select>
      </div>
      <div class="form-field full">
        <label for="id_cliente">Cliente responsável *</label>
        <select id="id_cliente" name="id_cliente" required></select>
      </div>
    </div>`;
}

function prepararSelect(form, valorAtual) {
  App.fillSelect(form.elements.id_cliente, clientes, 'id_cliente', 'nome_completo', 'Selecione o cliente');
  if (valorAtual) form.elements.id_cliente.value = String(valorAtual);
}

document.addEventListener('DOMContentLoaded', () => {
  carregar();

  document.getElementById('btnNovo').addEventListener('click', () => {
    if (clientes.length === 0) {
      App.toast('Cadastre um cliente antes de adicionar animais.', 'warning');
      return;
    }
    App.openModal({
      title: 'Novo animal',
      body: formulario(),
      submitLabel: 'Cadastrar',
      onOpen: (form) => prepararSelect(form, null),
      onSubmit: async (dados) => {
        await App.request('/animais', { method: 'POST', body: dados });
        await carregar();
        return 'Animal cadastrado com sucesso.';
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
        const animal = await App.request('/animais/' + id);
        App.openModal({
          title: 'Editar animal',
          body: formulario(animal),
          onOpen: (form) => prepararSelect(form, animal.id_cliente),
          onSubmit: async (dados) => {
            await App.request('/animais/' + id, { method: 'PUT', body: dados });
            await carregar();
            return 'Animal atualizado com sucesso.';
          },
        });
      } catch (erro) {
        App.toast(erro.message, 'error');
      }
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.excluir);
      App.confirmAction({
        title: 'Excluir animal',
        message: 'Deseja realmente excluir este animal? Agendamentos vinculados também serão removidos.',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await App.request('/animais/' + id, { method: 'DELETE' });
          await carregar();
          return 'Animal excluído.';
        },
      });
    }
  });
});
