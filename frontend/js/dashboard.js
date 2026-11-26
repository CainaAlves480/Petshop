document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('hoje').textContent = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());

  try {
    const resumo = await App.request('/dashboard/resumo');

    document.getElementById('statClientes').textContent = resumo.clientes;
    document.getElementById('statAnimais').textContent = resumo.animais;
    document.getElementById('statProdutos').textContent = resumo.produtos;
    document.getElementById('statServicos').textContent = resumo.servicosRealizados;
    document.getElementById('statVendas').textContent = resumo.totalVendas;
    document.getElementById('statFaturamento').textContent = App.money(resumo.faturamento);

    const estoque = document.getElementById('tbodyEstoqueBaixo');
    estoque.innerHTML = resumo.estoqueBaixo.length
      ? resumo.estoqueBaixo.map((p) => `
          <tr>
            <td>${App.escapeHtml(p.nome)}</td>
            <td class="right"><span class="badge danger">${p.quantidade_estoque}</span></td>
            <td class="right muted">${p.estoque_minimo}</td>
          </tr>`).join('')
      : `<tr><td colspan="3"><div class="empty-state"><strong>Tudo em dia</strong>Nenhum produto abaixo do estoque mínimo.</div></td></tr>`;

    const agenda = document.getElementById('tbodyAgendamentos');
    agenda.innerHTML = resumo.proximosAgendamentos.length
      ? resumo.proximosAgendamentos.map((a) => `
          <tr>
            <td class="nowrap">${App.date(a.data_agendamento)}</td>
            <td>${App.escapeHtml(a.animal_nome)}<br><span class="muted">${App.escapeHtml(a.cliente_nome)}</span></td>
            <td>${App.escapeHtml(a.servico_nome)}</td>
            <td class="right nowrap">${App.escapeHtml(String(a.horario).slice(0, 5))}</td>
          </tr>`).join('')
      : `<tr><td colspan="4"><div class="empty-state"><strong>Agenda livre</strong>Nenhum agendamento futuro.</div></td></tr>`;
  } catch (erro) {
    App.toast(erro.message || 'Não foi possível carregar o dashboard.', 'error');
  }
});
