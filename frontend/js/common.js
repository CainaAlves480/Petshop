(function () {
  const BASE = '/api';

  async function request(path, options = {}) {
    const { method = 'GET', body } = options;
    const resposta = await fetch(BASE + path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (resposta.status === 204) return null;

    let dados;
    try {
      dados = await resposta.json();
    } catch (_) {
      dados = null;
    }

    if (!resposta.ok) {
      throw new Error((dados && dados.error) || `Erro HTTP ${resposta.status}`);
    }

    return dados;
  }

  function escapeHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(Number(valor || 0));
  }

  function date(valor, comHora = false) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor).slice(0, 10).split('-').reverse().join('/');
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(comHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(d);
  }

  function cpf(valor) {
    const d = String(valor || '').replace(/\D/g, '');
    return d.replace(/^(\d{3})(\d)/, '$1.$2')
            .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  function maskCpf(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      input.value = cpf(input.value);
      const novoPos = pos >= 14 ? 14 : pos;
      input.setSelectionRange(novoPos, novoPos);
    });
  }

  function debounce(fn, espera = 250) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), espera);
    };
  }

  function toast(mensagem, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.textContent = mensagem;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function closeModals() {
    document.getElementById('modal').hidden = true;
    document.getElementById('confirmModal').hidden = true;
  }

  function fillSelect(select, itens, valueKey, labelKey, placeholder = 'Selecione...') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + itens.map((item) =>
      `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`
    ).join('');
  }

  function openModal({ title, body, submitLabel = 'Salvar', onSubmit, onOpen, wide = false }) {
    const modal = document.getElementById('modal');
    const dialog = modal.querySelector('.modal-dialog');
    const form = document.getElementById('modalForm');

    dialog.classList.toggle('wide', wide);
    document.getElementById('modalTitle').textContent = title;
    form.innerHTML = body + `
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
      </div>`;

    form.onsubmit = async (event) => {
      event.preventDefault();
      const botao = form.querySelector('button[type="submit"]');
      const textoOriginal = botao.textContent;
      botao.disabled = true;
      botao.textContent = 'Salvando...';

      try {
        const dados = Object.fromEntries(new FormData(form).entries());
        const resultado = await onSubmit(dados, form);
        if (resultado !== false) {
          closeModals();
          if (typeof resultado === 'string') toast(resultado);
        }
      } catch (erro) {
        toast(erro.message || 'Não foi possível salvar.', 'error');
      } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
      }
    };

    modal.hidden = false;
    if (onOpen) onOpen(form);
    const primeiro = form.querySelector('input:not([type="hidden"]), select, textarea');
    if (primeiro) primeiro.focus();
  }

  function confirmAction({ title = 'Confirmar ação', message, confirmLabel = 'Confirmar', onConfirm }) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = message;

    const botao = document.getElementById('confirmYes');
    botao.textContent = confirmLabel;
    botao.onclick = async () => {
      botao.disabled = true;
      botao.textContent = 'Aguarde...';
      try {
        const resultado = await onConfirm();
        closeModals();
        if (typeof resultado === 'string') toast(resultado);
      } catch (erro) {
        closeModals();
        toast(erro.message || 'Não foi possível concluir.', 'error');
      } finally {
        botao.disabled = false;
        botao.textContent = confirmLabel;
      }
    };

    modal.hidden = false;
    botao.focus();
  }

  function emptyRow(colspan, mensagem = 'Nenhum registro encontrado.') {
    return `<tr><td colspan="${colspan}"><div class="empty-state"><strong>Nada por aqui</strong>${escapeHtml(mensagem)}</div></td></tr>`;
  }

  function injectShell() {
    if (!document.getElementById('modal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal" id="modal" hidden>
          <div class="modal-backdrop" data-close-modal></div>
          <div class="modal-dialog">
            <div class="modal-header">
              <h2 id="modalTitle"></h2>
              <button type="button" class="icon-btn" data-close-modal aria-label="Fechar">&times;</button>
            </div>
            <form id="modalForm" class="modal-form"></form>
          </div>
        </div>`);
    }

    if (!document.getElementById('confirmModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal" id="confirmModal" hidden>
          <div class="modal-backdrop" data-close-modal></div>
          <div class="modal-dialog confirm-dialog">
            <div class="modal-header">
              <h2 id="confirmTitle">Confirmar ação</h2>
              <button type="button" class="icon-btn" data-close-modal aria-label="Fechar">&times;</button>
            </div>
            <p class="confirm-text" id="confirmText"></p>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
              <button type="button" class="btn btn-danger" id="confirmYes">Confirmar</button>
            </div>
          </div>
        </div>`);
    }

    if (!document.getElementById('toastContainer')) {
      document.body.insertAdjacentHTML('beforeend', '<div class="toast-container" id="toastContainer"></div>');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectShell();

    document.addEventListener('click', (evento) => {
      if (evento.target.closest('[data-close-modal]')) closeModals();
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') closeModals();
    });

    const toggle = document.getElementById('menuToggle');
    if (toggle) {
      toggle.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));
    }

    const pagina = document.body.dataset.page;
    if (pagina) {
      document.querySelector(`.nav a[data-page="${pagina}"]`)?.classList.add('active');
    }
  });

  window.App = {
    request, escapeHtml, money, date, cpf, maskCpf, debounce, toast,
    openModal, confirmAction, closeModals, fillSelect, emptyRow,
  };
})();
