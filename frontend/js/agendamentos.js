const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const contador = document.getElementById('contador');
const STATUS = ['agendado', 'concluido', 'cancelado'];
let animais = [];
let servicos = [];

function dataInput(valor) {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return String(valor).slice(0, 10);
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toISOString().slice(0, 10);
}

function badgeStatus(status) {
  const classe = status === 'concluido' ? 'success' : status === 'cancelado' ? 'danger' : 'info';
  return `<span class="badge ${classe}">${App.escapeHtml(status)}</span>`;
}

async function carregarAuxiliares() {
  [animais, servicos] = await Promise.all([
    App.request('/animais'),
    App.request('/servicos'),
  ]);
}

async function carregar() {
  try {
    await carregarAuxiliares();

    const agendamentos = await App.request('/agendamentos?q=' + encodeURIComponent(busca.value.trim()));
    contador.textContent = `${agendamentos.length} registro(s)`;

    tbody.innerHTML = agendamentos.length
      ? agendamentos.map((a) => `
          <tr>
            <td class="nowrap">${App.date(a.data_agendamento)}</td>
            <td class="nowrap">${App.escapeHtml(String(a.horario).slice(0, 5))}</td>
            <td class="strong">${App.escapeHtml(a.animal_nome)}</td>
            <td>${App.escapeHtml(a.cliente_nome)}</td>
            <td>${App.escapeHtml(a.servico_nome)}</td>
            <td>${badgeStatus(a.status)}</td>
            <td class="actions">
              <button class="btn btn-sm btn-ghost" data-editar="${a.id_agendamento}">Editar</button>
              <button class="btn btn-sm btn-danger" data-excluir="${a.id_agendamento}">Excluir</button>
            </td>
          </tr>`).join('')
      : App.emptyRow(7, 'Nenhum agendamento encontrado.');
  } catch (erro) {
    App.toast(erro.message, 'error');
  }
}

function opcoesStatus(selecionado) {
  return STATUS.map((s) =>
    `<option value="${s}" ${s === selecionado ? 'selected' : ''}>${s}</option>`
  ).join('');
}

function formulario(a = {}) {
  return `
    <div class="form-grid">
      <div>
        <label for="id_animal">Animal *</label>
        <select id="id_animal" name="id_animal" required></select>
      </div>
      <div>
        <label for="id_servico">Serviço *</label>
        <select id="id_servico" name="id_servico" required></select>
      </div>
      <div>
        <label for="data_agendamento">Data *</label>
        <input id="data_agendamento" type="date" name="data_agendamento" required value="${App.escapeHtml(dataInput(a.data_agendamento))}">
      </div>
      <div>
        <label for="horario">Horário *</label>
        <input id="horario" type="time" name="horario" required value="${App.escapeHtml(String(a.horario || '').slice(0, 5))}">
      </div>
      <div>
        <label for="status">Status</label>
        <select id="status" name="status">${opcoesStatus(a.status || 'agendado')}</select>
      </div>
      <div class="form-field full">
        <label for="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" rows="2">${App.escapeHtml(a.observacoes || '')}</textarea>
      </div>
    </div>`;
}

function prepararSelects(form, atual = {}) {
  App.fillSelect(
    form.elements.id_animal,
    animais.map((a) => ({ id_animal: a.id_animal, label: `${a.nome} - ${a.cliente_nome}` })),
    'id_animal', 'label', 'Selecione o animal'
  );
  App.fillSelect(form.elements.id_servico, servicos, 'id_servico', 'nome', 'Selecione o serviço');

  if (atual.id_animal) form.elements.id_animal.value = String(atual.id_animal);
  if (atual.id_servico) form.elements.id_servico.value = String(atual.id_servico);
}

document.addEventListener('DOMContentLoaded', () => {
  carregar();

  document.getElementById('btnNovo').addEventListener('click', () => {
    if (animais.length === 0 || servicos.length === 0) {
      App.toast('Cadastre animais e serviços antes de agendar.', 'warning');
      return;
    }
    App.openModal({
      title: 'Novo agendamento',
      body: formulario(),
      submitLabel: 'Agendar',
      onOpen: (form) => prepararSelects(form),
      onSubmit: async (dados) => {
        await App.request('/agendamentos', { method: 'POST', body: dados });
        await carregar();
        return 'Agendamento criado com sucesso.';
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
        const agendamento = await App.request('/agendamentos/' + id);
        App.openModal({
          title: 'Editar agendamento',
          body: formulario(agendamento),
          onOpen: (form) => prepararSelects(form, agendamento),
          onSubmit: async (dados) => {
            await App.request('/agendamentos/' + id, { method: 'PUT', body: dados });
            await carregar();
            return 'Agendamento atualizado com sucesso.';
          },
        });
      } catch (erro) {
        App.toast(erro.message, 'error');
      }
    }

    if (botaoExcluir) {
      const id = Number(botaoExcluir.dataset.excluir);
      App.confirmAction({
        title: 'Excluir agendamento',
        message: 'Deseja realmente excluir este agendamento?',
        confirmLabel: 'Excluir',
        onConfirm: async () => {
          await App.request('/agendamentos/' + id, { method: 'DELETE' });
          await carregar();
          return 'Agendamento excluído.';
        },
      });
    }
  });
});
