import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ADMIN_USER,
  ADMIN_PASSWORD,
  CALLS_API_URL
} from './config.js';


/* =========================================================
   SUPABASE
========================================================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   IDENTIFICAR PÁGINA
========================================================= */

const isAdmin =
  window.location.pathname.includes('/admin');


/* =========================================================
   ESTADO
========================================================= */

const state = {
  members: [],
  tips: [],
  slotsBattle: [],
  slotsBattleSize: 16,
  slotsBattleGenerated: false,
  slotsBattleWinners: {},
  chatCalls: [],
  chatCallHistory: [],
  chatCallRanking: null,
  filter: '',
  loading: false,
  tipLoading: false
};


/* =========================================================
   CONTROLE DO DASHBOARD
========================================================= */

let dashboardInitialized = false;


/* =========================================================
   HELPERS
========================================================= */

const $ = (selector) =>
  document.querySelector(selector);


const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[char]
  );


const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();


const AVATAR_COUNT = 10;


const avatarHash = (value = '') =>
  Array.from(String(value)).reduce(
    (total, character) =>
      ((total * 31) + character.charCodeAt(0)) >>> 0,
    0
  );


const memberAvatarUrl = (memberId = '') => {

  const memberIds = state.members
    .map((member) => String(member.id))
    .sort(
      (first, second) =>
        avatarHash(first) - avatarHash(second) ||
        first.localeCompare(second)
    );

  const memberPosition = memberIds.indexOf(String(memberId));

  const avatarNumber = String(
    (memberPosition >= 0 ? memberPosition : avatarHash(memberId)) %
      AVATAR_COUNT + 1
  );

  const paddedAvatarNumber = avatarNumber.padStart(2, '0');

  return `../images/avatar/avatar-${paddedAvatarNumber}.png`;

};


const feedback = (
  element,
  message,
  type = ''
) => {

  if (!element) return;

  element.textContent = message;

  element.className =
    `feedback ${type}`;

};


const sleep = (ms) =>
  new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );


/* =========================================================
   MÁSCARA DE TELEFONE
========================================================= */

function setupPhoneMask() {

  const phoneInput =
    $('#phone');

  if (!phoneInput) return;


  phoneInput.addEventListener(
    'input',
    (event) => {

      let value =
        event.target.value
          .replace(/\D/g, '');

      value =
        value.slice(0, 11);


      if (value.length > 0) {

        value =
          `(${value.slice(0, 2)}) ${value.slice(2)}`;

      }


      if (value.length > 10) {

        value =
          value.slice(0, 10) +
          '-' +
          value.slice(10);

      }


      event.target.value =
        value;

    }
  );


  phoneInput.addEventListener(
    'blur',
    (event) => {

      let value =
        event.target.value
          .replace(/\D/g, '');


      if (value.length > 11) {

        value =
          value.slice(0, 11);

      }


      if (value.length === 11) {

        event.target.value =
          `(${value.slice(0, 2)}) ` +
          `${value.slice(2, 7)}-` +
          `${value.slice(7)}`;

      }

    }
  );

}


/* =========================================================
   FORMATAÇÃO DE TELEFONE
========================================================= */

function formatPhone(
  phone,
  visible = false
) {

  const digits =
    String(phone || '')
      .replace(/\D/g, '');


  if (digits.length !== 11) {

    return digits;

  }


  const ddd =
    digits.slice(0, 2);

  const first =
    digits.slice(2, 7);

  const last =
    digits.slice(7, 11);


  return visible
    ? `(${ddd}) ${first}-${last}`
    : `(${ddd}) ${first}-****`;

}


/* =========================================================
   MOSTRAR / OCULTAR TELEFONE
========================================================= */

function setupPhoneVisibility() {

  document
    .querySelectorAll('.phone-toggle')
    .forEach((button) => {

      button.addEventListener(
        'click',
        () => {

          const container =
            button.closest(
              '.phone-protected'
            );


          const phoneElement =
            container?.querySelector(
              '.member-phone'
            );


          if (!phoneElement) return;


          const phone =
            phoneElement.dataset.phone ||
            '';


          const isVisible =
            phoneElement.dataset.visible ===
            'true';


          const nextVisible =
            !isVisible;


          phoneElement.dataset.visible =
            String(nextVisible);


          phoneElement.textContent =
            formatPhone(
              phone,
              nextVisible
            );


          button.textContent =
            nextVisible
              ? '🙈'
              : '👁';


          button.title =
            nextVisible
              ? 'Ocultar telefone'
              : 'Mostrar telefone';


          button.setAttribute(
            'aria-label',
            nextVisible
              ? 'Ocultar telefone'
              : 'Mostrar telefone'
          );

        }
      );

    });

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

if (isAdmin) {

  initAdmin();

} else {

  initMembers();

}


/* =========================================================
   ÁREA PÚBLICA
========================================================= */

function initMembers() {

  const form =
    $('#member-form');


  if (!form) return;


  setupPhoneMask();


  form.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();


      const button =
        form.querySelector('button');


      const original =
        button?.innerHTML ||
        'Enviar';


      if (button) {

        button.disabled = true;

        button.innerHTML =
          'Enviando...';

      }


      try {

        const values =
          Object.fromEntries(
            new FormData(form).entries()
          );


        const phone =
          String(
            values.phone || ''
          ).replace(/\D/g, '');


        const member = {

          full_name:
            String(
              values.full_name || ''
            ).trim(),

          phone,

          twitch_nick:
            String(
              values.twitch_nick || ''
            ).trim()

        };


        if (
          member.full_name.length < 2 ||
          member.full_name.length > 120
        ) {

          throw new Error(
            'O nome deve ter entre 2 e 120 caracteres.'
          );

        }


        if (
          !/^\d{11}$/.test(
            member.phone
          )
        ) {

          throw new Error(
            'O telefone deve conter exatamente 11 números.'
          );

        }


        if (
          member.twitch_nick.length < 2 ||
          member.twitch_nick.length > 50
        ) {

          throw new Error(
            'O nick da Twitch deve ter entre 2 e 50 caracteres.'
          );

        }


        const normalizedNick =
          member.twitch_nick
            .trim()
            .toLowerCase();


        /* =========================================
           VERIFICAR TELEFONE
        ========================================= */

        const phoneCheck =
          await supabase
            .from('members')
            .select('id, phone')
            .eq(
              'phone',
              member.phone
            )
            .limit(1);


        if (phoneCheck.error) {

          console.error(
            'Erro ao verificar telefone:',
            phoneCheck.error
          );

          throw new Error(
            'Não foi possível verificar o telefone. Tente novamente.'
          );

        }


        if (
          phoneCheck.data?.length
        ) {

          throw new Error(
            'Este número de telefone já possui um cadastro.'
          );

        }


        /* =========================================
           VERIFICAR TWITCH
        ========================================= */

        const twitchCheck =
          await supabase
            .from('members')
            .select('id, twitch_nick')
            .ilike(
              'twitch_nick',
              normalizedNick
            )
            .limit(1);


        if (twitchCheck.error) {

          console.error(
            'Erro ao verificar Twitch:',
            twitchCheck.error
          );

          throw new Error(
            'Não foi possível verificar o nick da Twitch. Tente novamente.'
          );

        }


        const twitchExists =
          twitchCheck.data?.some(
            (item) =>
              String(
                item.twitch_nick || ''
              )
                .trim()
                .toLowerCase() ===
              normalizedNick
          );


        if (twitchExists) {

          throw new Error(
            'Este nick da Twitch já possui um cadastro.'
          );

        }


        /* =========================================
           CADASTRAR
        ========================================= */

        const {
          data,
          error
        } = await supabase
          .from('members')
          .insert(member)
          .select()
          .single();


        if (error) {

          console.error(
            'Erro ao cadastrar membro:',
            error
          );


          if (
            error.code === '23505'
          ) {

            const errorText =
              String(
                error.message || ''
              ).toLowerCase();


            if (
              errorText.includes('phone')
            ) {

              throw new Error(
                'Este número de telefone já possui um cadastro.'
              );

            }


            if (
              errorText.includes('twitch')
            ) {

              throw new Error(
                'Este nick da Twitch já possui um cadastro.'
              );

            }


            throw new Error(
              'Este telefone ou nick da Twitch já está cadastrado.'
            );

          }


          throw new Error(
            error.message ||
            'Não foi possível cadastrar o membro.'
          );

        }


        console.log(
          'Membro cadastrado:',
          data
        );


        form.reset();


        feedback(
          $('#form-feedback'),
          'Cadastro realizado. Você já está na comunidade!',
          'success'
        );


      } catch (error) {

        console.error(
          'Erro no cadastro:',
          error
        );


        feedback(
          $('#form-feedback'),
          error.message ||
          'Não foi possível concluir agora. Tente novamente.',
          'error'
        );


      } finally {

        if (button) {

          button.disabled = false;

          button.innerHTML =
            original;

        }

      }

    }
  );

}


/* =========================================================
   ADMIN
========================================================= */

function initAdmin() {

  if (
    sessionStorage.getItem(
      'gaucho_admin'
    ) === 'true'
  ) {

    showDashboard();

  }


  $('#login-form')?.addEventListener(
    'submit',
    (event) => {

      event.preventDefault();


      const values =
        Object.fromEntries(
          new FormData(
            event.currentTarget
          ).entries()
        );


      if (
        values.username ===
          ADMIN_USER &&
        values.password ===
          ADMIN_PASSWORD
      ) {

        sessionStorage.setItem(
          'gaucho_admin',
          'true'
        );


        showDashboard();


      } else {

        feedback(
          $('#login-feedback'),
          'Login ou senha incorretos.',
          'error'
        );

      }

    }
  );


  $('#logout-button')
    ?.addEventListener(
      'click',
      () => {

        sessionStorage.removeItem(
          'gaucho_admin'
        );

        location.reload();

      }
    );


  $('#delete-all-members')
    ?.addEventListener(
      'click',
      deleteAllMembers
    );


  $('#refresh-dashboard')
    ?.addEventListener(
      'click',
      refreshDashboard
    );

}


/* =========================================================
   DASHBOARD
========================================================= */

async function showDashboard() {

  $('#login-view')
    ?.classList
    .add('hidden');


  $('#dashboard-view')
    ?.classList
    .remove('hidden');


  if (
    dashboardInitialized
  ) {

    await loadData();

    return;

  }


  dashboardInitialized =
    true;

  loadSlotsBattleEntries();
  loadChatCalls();


  document
    .querySelectorAll('.nav-item')
    .forEach((item) => {

      item.addEventListener(
        'click',
        () =>
          switchTab(
            item.dataset.tab
          )
      );

    });


  $('#member-search')
    ?.addEventListener(
      'input',
      (event) => {

        state.filter =
          event.target.value
            .toLowerCase()
            .trim();

        renderMembers();

      }
    );


  $('#spin-button')
    ?.addEventListener(
      'click',
      spinRoulette
    );

  $('#slots-draw')?.addEventListener('click', drawSlotsMember);
  $('#slots-add')?.addEventListener('click', addSlotsBattleEntry);
  $('#slots-generate')?.addEventListener('click', generateSlotsBracket);
  $('#slots-clear')?.addEventListener('click', clearSlotsBattle);
  $('#slots-size')?.addEventListener('change', changeSlotsBattleSize);
  $('#slots-name')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addSlotsBattleEntry();
  });
  $('#chat-call-form')?.addEventListener('submit', addChatCall);
  $('#chat-call-list')?.addEventListener('click', handleChatCallAction);


  await loadData();

}


/* =========================================================
   CALL DO CHAT
========================================================= */

const CHAT_CALL_STORAGE_KEY = 'gaucho_chat_calls';
const CHAT_CALL_HISTORY_STORAGE_KEY = 'gaucho_chat_call_history';

function loadChatCalls() {
  try {
    state.chatCalls = JSON.parse(localStorage.getItem(CHAT_CALL_STORAGE_KEY) || '[]');
    state.chatCallHistory = JSON.parse(localStorage.getItem(CHAT_CALL_HISTORY_STORAGE_KEY) || '[]');
  } catch {
    state.chatCalls = [];
    state.chatCallHistory = [];
  }

  renderChatCalls();

  if (!CALLS_API_URL) return;
  fetch(CALLS_API_URL)
    .then((response) => {
      if (!response.ok) throw new Error('Falha ao carregar calls');
      return response.json();
    })
    .then((data) => {
      state.chatCalls = (data.calls || []).map((call) => ({
        id: call.id,
        name: call.usuario,
        game: call.call
      }));
      state.chatCallRanking = Array.isArray(data.ranking) ? data.ranking : [];
      renderChatCalls();
    })
    .catch(() => {
      // A tela continua operando com as chamadas salvas localmente se a API estiver indisponível.
    });
}

function saveChatCalls() {
  localStorage.setItem(CHAT_CALL_STORAGE_KEY, JSON.stringify(state.chatCalls));
  localStorage.setItem(CHAT_CALL_HISTORY_STORAGE_KEY, JSON.stringify(state.chatCallHistory));
}

function renderChatCalls() {
  const list = $('#chat-call-list');
  const count = state.chatCalls.length;
  const countLabel = `${count} ${count === 1 ? 'chamada' : 'chamadas'}`;

  if ($('#chat-call-count')) $('#chat-call-count').textContent = countLabel;
  if ($('#nav-chat-call-count')) $('#nav-chat-call-count').textContent = count;
  if (!list) return;

  if (!count) {
    list.innerHTML = '<div class="chat-call-empty">Nenhuma chamada ativa. Adicione a primeira pelo formulário ao lado.</div>';
  } else {
    list.innerHTML = state.chatCalls.map((call, index) => `
      <article class="chat-call-item">
        <span class="chat-call-position">${index + 1}</span>
        <div class="chat-call-person"><strong>${escapeHtml(call.name)}</strong><span>${escapeHtml(call.game)}</span></div>
        <div class="chat-call-actions">
          <button class="chat-call-action" type="button" data-chat-call-action="complete" data-chat-call-id="${call.id}">Concluir</button>
          <button class="chat-call-action remove" type="button" data-chat-call-action="remove" data-chat-call-id="${call.id}">Excluir</button>
        </div>
      </article>`).join('');
  }

  const ranking = state.chatCallHistory
    .filter((entry) => Date.now() - entry.completedAt < 7 * 24 * 60 * 60 * 1000)
    .reduce((total, entry) => {
      total[entry.name] = (total[entry.name] || 0) + Number(entry.bonusAmount || 0);
      return total;
    }, {});
  const leaders = state.chatCallRanking
    ? state.chatCallRanking.map((entry) => [entry.usuario, entry.totalBonus])
    : Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rankingElement = $('#chat-call-ranking');
  if (rankingElement) rankingElement.innerHTML = leaders.length
    ? leaders.map(([name, total], index) => `<div class="chat-call-rank ${index < 3 ? `podium place-${index + 1}` : 'other-place'}"><b>${index + 1}</b><span>${escapeHtml(name)}</span><small>R$ ${Number(total).toFixed(2).replace('.', ',')}</small></div>`).join('')
    : '<p class="chat-call-no-ranking">Sem chamadas concluídas nesta semana.</p>';
}

async function addChatCall(event) {
  event.preventDefault();
  const name = $('#chat-call-name')?.value.trim();
  const game = $('#chat-call-game')?.value.trim();
  if (!name || !game) return;

  let entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, game };
  if (CALLS_API_URL) {
    try {
      const response = await fetch(CALLS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: name, call: game })
      });
      if (!response.ok) throw new Error('Não foi possível salvar a chamada.');
      const data = await response.json();
      entry = { id: data.call.id, name: data.call.usuario, game: data.call.call };
    } catch (error) {
      showDashboardMessage(error.message, 'error');
      return;
    }
  }
  state.chatCalls.push(entry);
  saveChatCalls();
  event.currentTarget.reset();
  renderChatCalls();
}

async function handleChatCallAction(event) {
  const button = event.target.closest('[data-chat-call-action]');
  if (!button) return;
  const id = button.dataset.chatCallId;
  const call = state.chatCalls.find((entry) => entry.id === id);
  if (!call) return;

  if (button.dataset.chatCallAction === 'remove' && CALLS_API_URL) {
    try {
      const response = await fetch(`${CALLS_API_URL}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível excluir a chamada.');
      state.chatCalls = state.chatCalls.filter((entry) => entry.id !== id);
      saveChatCalls();
      renderChatCalls();
      loadChatCalls();
      return;
    } catch (error) {
      showDashboardMessage(error.message, 'error');
      return;
    }
  }

  if (button.dataset.chatCallAction === 'complete') {
    const value = window.prompt(`Qual valor de bônus ${call.name} pagou?`, '');
    if (value === null) return;
    const bonusAmount = Number(value.replace(',', '.'));
    if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) {
      showDashboardMessage('Informe um valor de bônus maior que zero.', 'error');
      return;
    }
    if (CALLS_API_URL) {
      try {
        button.disabled = true;
        const response = await fetch(CALLS_API_URL, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, bonusAmount })
        });
        if (!response.ok) throw new Error('Não foi possível concluir a chamada.');
        state.chatCalls = state.chatCalls.filter((entry) => entry.id !== id);
        saveChatCalls();
        loadChatCalls();
        return;
      } catch (error) {
        button.disabled = false;
        showDashboardMessage(error.message, 'error');
        return;
      }
    }
    state.chatCallHistory.push({ name: call.name, bonusAmount, completedAt: Date.now() });
  }
  state.chatCalls = state.chatCalls.filter((entry) => entry.id !== id);
  saveChatCalls();
  renderChatCalls();
}


/* =========================================================
   ATUALIZAR DASHBOARD
========================================================= */

async function refreshDashboard() {

  if (state.loading) return;


  const button =
    $('#refresh-dashboard');


  const original =
    button?.innerHTML ||
    'Atualizar';


  try {

    state.loading = true;


    if (button) {

      button.disabled = true;

      button.classList.add(
        'is-refreshing'
      );

    }


    showDashboardMessage(
      'Atualizando dados...'
    );


    const success =
      await loadData();

    // Atualiza as chamadas somente quando o botão global for acionado.
    loadChatCalls();


    if (success) {

      showDashboardMessage(
        'Dados atualizados com sucesso.'
      );

    }


  } catch (error) {

    console.error(
      'Erro ao atualizar:',
      error
    );


    showDashboardMessage(
      `Não foi possível atualizar: ${
        error.message ||
        'erro desconhecido'
      }`
    );


  } finally {

    state.loading = false;


    if (button) {

      button.disabled = false;

      button.innerHTML =
        original;

      button.classList.remove(
        'is-refreshing'
      );

    }

  }

}


/* =========================================================
   CARREGAR DADOS
========================================================= */

async function loadData() {

  try {

    const [
      membersResult,
      tipsResult
    ] = await Promise.all([

      supabase
        .from('members')
        .select('*')
        .order(
          'created_at',
          {
            ascending: false
          }
        ),

      supabase
        .from('tips')
        .select(`
          *,
          members (
            full_name,
            twitch_nick,
            phone
          )
        `)
        .order(
          'created_at',
          {
            ascending: false
          }
        )

    ]);


    if (
      membersResult.error
    ) {

      console.error(
        'Erro ao carregar membros:',
        membersResult.error
      );

      throw membersResult.error;

    }


    if (
      tipsResult.error
    ) {

      console.error(
        'Erro ao carregar gorjetas:',
        tipsResult.error
      );

      throw tipsResult.error;

    }


    state.members =
      membersResult.data || [];


    state.tips =
      tipsResult.data || [];


    renderAll();


    return true;


  } catch (error) {

    console.error(
      'Erro ao carregar dados:',
      error
    );


    showDashboardMessage(
      `Não foi possível carregar os dados: ${
        error.message ||
        'erro desconhecido'
      }`
    );


    return false;

  }

}


/* =========================================================
   RENDERIZAÇÃO GERAL
========================================================= */

function renderAll() {

  renderMembers();

  renderRoulette();

  renderTips();

  renderSlotsBattle();


  if (
    $('#nav-member-count')
  ) {

    $('#nav-member-count')
      .textContent =
      state.members.length;

  }


  if (
    $('#nav-tip-count')
  ) {

    $('#nav-tip-count')
      .textContent =
      state.tips.length;

  }

  if ($('#nav-slots-count')) {
    $('#nav-slots-count').textContent = state.slotsBattle.length;
  }

}


/* =========================================================
   BATALHA DE SLOTS
========================================================= */

const SLOTS_BATTLE_STORAGE_KEY = 'gaucho_slots_battle_entries';
const SLOTS_BATTLE_SETTINGS_KEY = 'gaucho_slots_battle_settings';

function loadSlotsBattleEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(SLOTS_BATTLE_STORAGE_KEY) || '[]');
    state.slotsBattle = Array.isArray(saved) ? saved : [];
    const settings = JSON.parse(localStorage.getItem(SLOTS_BATTLE_SETTINGS_KEY) || '{}');
    state.slotsBattleSize = [2, 4, 8, 16].includes(Number(settings.size)) ? Number(settings.size) : 16;
    state.slotsBattleGenerated = Boolean(settings.generated);
    state.slotsBattleWinners = settings.winners && typeof settings.winners === 'object' ? settings.winners : {};
  } catch {
    state.slotsBattle = [];
    state.slotsBattleSize = 16;
    state.slotsBattleGenerated = false;
    state.slotsBattleWinners = {};
  }
}

function saveSlotsBattleEntries() {
  localStorage.setItem(SLOTS_BATTLE_STORAGE_KEY, JSON.stringify(state.slotsBattle));
  localStorage.setItem(SLOTS_BATTLE_SETTINGS_KEY, JSON.stringify({
    size: state.slotsBattleSize,
    generated: state.slotsBattleGenerated,
    winners: state.slotsBattleWinners
  }));
}

function slotsBattleMessage(message = '') {
  const status = $('#slots-status');
  if (status) status.textContent = message;
}

function renderSlotsBattle() {
  const memberSelect = $('#slots-member');
  const bracket = $('#slots-bracket');
  const entrants = $('#slots-entrants');
  const addButton = $('#slots-add');
  const drawButton = $('#slots-draw');
  if (!memberSelect || !bracket || !entrants) return;

  const sizeSelect = $('#slots-size');
  if (sizeSelect) sizeSelect.value = String(state.slotsBattleSize);

  const selectedId = memberSelect.value;
  const usedIds = new Set(state.slotsBattle.map((entry) => String(entry.memberId)));
  const availableMembers = state.members.filter((member) => !usedIds.has(String(member.id)));
  const isFull = state.slotsBattle.length >= state.slotsBattleSize;

  if (addButton) {
    addButton.disabled = isFull;
    addButton.textContent = isFull ? 'Vagas preenchidas' : 'Adicionar à copa';
  }

  if (drawButton) drawButton.disabled = isFull || !availableMembers.length;
  memberSelect.innerHTML = availableMembers.length
    ? `<option value="">Selecione um membro</option>${availableMembers.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.full_name)}${member.twitch_nick ? ` (@${escapeHtml(member.twitch_nick)})` : ''}</option>`).join('')}`
    : '<option value="">Nenhum membro disponível</option>';
  if (availableMembers.some((member) => String(member.id) === selectedId)) memberSelect.value = selectedId;

  entrants.innerHTML = state.slotsBattle.length
    ? state.slotsBattle.map((entry, index) => `<div class="slots-entry"><div><p>${escapeHtml(entry.memberName)}</p><span>Slot: ${escapeHtml(entry.slotName)}</span></div><button class="slots-remove" type="button" data-slots-remove="${index}">Remover</button></div>`).join('')
    : '<div class="empty-state">Adicione membros e os respectivos slots para montar a chave.</div>';
  entrants.querySelectorAll('[data-slots-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      state.slotsBattle.splice(Number(button.dataset.slotsRemove), 1);
      state.slotsBattleGenerated = false;
      state.slotsBattleWinners = {};
      saveSlotsBattleEntries();
      slotsBattleMessage('Participante removido da copa.');
      renderAll();
    });
  });

  if (isFull && !state.slotsBattleGenerated) {
    slotsBattleMessage(`Todas as ${state.slotsBattleSize} vagas foram preenchidas. Clique em “Gerar chaveamento”.`);
  }

  if (!state.slotsBattleGenerated) {
    bracket.innerHTML = `<div class="empty-state">Cadastre ${state.slotsBattleSize} participante(s) e clique em “Gerar chaveamento”. (${state.slotsBattle.length}/${state.slotsBattleSize})</div>`;
    return;
  }

  const roundTitles = {
    2: ['Final'],
    4: ['Semifinal', 'Final'],
    8: ['Quartas de final', 'Semifinal', 'Final'],
    16: ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']
  };
  let roundEntries = state.slotsBattle;
  const columns = roundTitles[state.slotsBattleSize].map((title, roundIndex) => {
    const matches = state.slotsBattleSize / (2 ** (roundIndex + 1));
    const entriesForRound = roundEntries;
    let nextEntries = [];
    const matchesHtml = Array.from({ length: matches }, (_, matchIndex) => {
      const first = entriesForRound[matchIndex * 2];
      const second = entriesForRound[(matchIndex * 2) + 1];
      const winnerId = state.slotsBattleWinners[`${roundIndex}-${matchIndex}`];
      const winner = [first, second].find((entry) => String(entry?.memberId) === String(winnerId));
      nextEntries.push(winner);
      const contender = (entry, seed) => entry
        ? `<button class="slots-contender ${String(entry.memberId) === String(winnerId) ? 'selected' : ''}" type="button" data-slots-winner="${roundIndex}-${matchIndex}" data-member-id="${escapeHtml(entry.memberId)}"><span class="slots-seed">${seed}</span><div><strong>${escapeHtml(entry.memberName)}</strong><small>${escapeHtml(entry.slotName)}</small></div></button>`
        : '<div class="slots-contender empty">A definir</div>';
      return `<div class="slots-match">${contender(first, (matchIndex * 2) + 1)}${contender(second, (matchIndex * 2) + 2)}</div>`;
    }).join('');
    roundEntries = nextEntries;
    return `<div class="slots-round"><h3>${title}</h3>${matchesHtml}</div>`;
  });
  bracket.innerHTML = columns.join('');

  bracket.querySelectorAll('[data-slots-winner]').forEach((button) => {
    button.addEventListener('click', () => chooseSlotsWinner(button.dataset.slotsWinner, button.dataset.memberId));
  });
}

function changeSlotsBattleSize(event) {
  const size = Number(event.target.value);
  if (state.slotsBattle.length > size) {
    slotsBattleMessage(`Já existem ${state.slotsBattle.length} participantes. Remova alguns antes de reduzir as vagas.`);
    event.target.value = String(state.slotsBattleSize);
    return;
  }
  state.slotsBattleSize = size;
  state.slotsBattleGenerated = false;
  state.slotsBattleWinners = {};
  saveSlotsBattleEntries();
  slotsBattleMessage(`Copa configurada para ${size} participantes.`);
  renderAll();
}

function generateSlotsBracket() {
  if (state.slotsBattle.length !== state.slotsBattleSize) {
    slotsBattleMessage(`Cadastre exatamente ${state.slotsBattleSize} participantes para gerar o chaveamento. (${state.slotsBattle.length}/${state.slotsBattleSize})`);
    return;
  }
  for (let index = state.slotsBattle.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [state.slotsBattle[index], state.slotsBattle[randomIndex]] = [state.slotsBattle[randomIndex], state.slotsBattle[index]];
  }
  state.slotsBattleGenerated = true;
  state.slotsBattleWinners = {};
  saveSlotsBattleEntries();
  slotsBattleMessage('Chaveamento gerado com os participantes sorteados.');
  renderAll();
}

function clearSlotsBattle() {
  if (!state.slotsBattle.length) {
    slotsBattleMessage('Não há participantes para remover.');
    return;
  }

  if (!window.confirm(`Remover todos os ${state.slotsBattle.length} participantes e reiniciar a Batalha de Slots?`)) return;

  state.slotsBattle = [];
  state.slotsBattleGenerated = false;
  state.slotsBattleWinners = {};
  saveSlotsBattleEntries();
  slotsBattleMessage('Batalha de Slots reiniciada.');
  renderAll();
}

async function chooseSlotsWinner(matchKey, memberId) {
  const roundIndex = Number(matchKey.split('-')[0]);
  const isFinal = roundIndex === Math.log2(state.slotsBattleSize) - 1;
  state.slotsBattleWinners[matchKey] = memberId;
  Object.keys(state.slotsBattleWinners).forEach((key) => {
    if (Number(key.split('-')[0]) > roundIndex) delete state.slotsBattleWinners[key];
  });
  saveSlotsBattleEntries();
  slotsBattleMessage(isFinal ? 'Campeão definido!' : 'Vencedor definido e avançado para a próxima fase.');
  renderAll();
  if (isFinal) {
    const champion = state.slotsBattle.find((entry) => String(entry.memberId) === String(memberId));
    if (champion) {
      const registered = await registerTip(champion.memberId, 'members', false, 20);
      slotsBattleMessage(
        registered
          ? 'Campeão definido e gorjeta de R$ 20,00 registrada!'
          : 'Campeão definido, mas não foi possível registrar a gorjeta.'
      );
      showSlotsChampionCelebration(champion);
    }
  }
}

function showSlotsChampionCelebration(champion) {
  document.querySelector('.slots-champion-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'slots-champion-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `<div class="slots-champion-card"><div class="slots-champion-trophy">🏆</div><h2>CAMPEÃO!</h2><p>${escapeHtml(champion.memberName)}</p><small>Venceu com o slot ${escapeHtml(champion.slotName)}</small><button class="slots-champion-close" type="button">Celebrar!</button></div>`;
  const colors = ['#ffda54', '#f07167', '#65c7d0', '#d889e8', '#fff'];
  for (let index = 0; index < 70; index++) {
    const confetti = document.createElement('span');
    confetti.className = 'slots-confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.setProperty('--confetti-x', `${-220 + Math.random() * 440}px`);
    confetti.style.setProperty('--confetti-color', colors[index % colors.length]);
    confetti.style.animationDelay = `${Math.random() * .55}s`;
    overlay.appendChild(confetti);
  }
  const close = () => overlay.remove();
  overlay.querySelector('.slots-champion-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
}

function drawSlotsMember() {
  const select = $('#slots-member');
  const usedIds = new Set(state.slotsBattle.map((entry) => String(entry.memberId)));
  const candidates = state.members.filter((member) => !usedIds.has(String(member.id)));
  if (!candidates.length) {
    slotsBattleMessage('Não há membros disponíveis para sortear.');
    return;
  }
  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  select.value = String(winner.id);
  slotsBattleMessage(`${winner.full_name} foi sorteado. Agora informe o nome do slot e adicione à copa.`);
}

function addSlotsBattleEntry() {
  const select = $('#slots-member');
  const slotInput = $('#slots-name');
  const member = state.members.find((item) => String(item.id) === String(select?.value));
  const slotName = slotInput?.value.trim();
  if (!member) {
    slotsBattleMessage('Selecione ou sorteie um membro cadastrado.');
    return;
  }
  if (!slotName) {
    slotsBattleMessage('Informe o nome do slot.');
    slotInput?.focus();
    return;
  }
  if (state.slotsBattle.some((entry) => String(entry.memberId) === String(member.id))) {
    slotsBattleMessage('Este membro já está na batalha.');
    return;
  }
  if (state.slotsBattle.length >= state.slotsBattleSize) {
    slotsBattleMessage(`A chave está completa: o limite é de ${state.slotsBattleSize} participantes.`);
    return;
  }
  state.slotsBattle.push({ memberId: member.id, memberName: member.full_name, slotName });
  state.slotsBattleGenerated = false;
  state.slotsBattleWinners = {};
  saveSlotsBattleEntries();
  slotInput.value = '';
  slotsBattleMessage(`${member.full_name} entrou na Batalha de Slots.`);
  renderAll();
}


/* =========================================================
   MEMBROS
========================================================= */

function renderMembers() {

  const filtered =
    state.members.filter(
      (member) =>
        `${member.full_name || ''} ${member.twitch_nick || ''}`
          .toLowerCase()
          .includes(
            state.filter
          )
    );


  const grid =
    $('#members-grid');


  if (!grid) return;


  grid.innerHTML =
    filtered.length

      ? filtered
          .map(
            (member) => `

              <article class="member-card">

                <div class="member-top">

                  <div class="member-identity">

                    <span class="member-status">Membro da comunidade</span>

                    <h3 class="member-name">
                      ${escapeHtml(
                        member.full_name
                      )}
                    </h3>

                    <div class="member-nick">
                      @${escapeHtml(
                        member.twitch_nick
                      )}
                    </div>

                  </div>


                  <div class="member-avatar">

                    <img
                      class="member-avatar-image"
                      src="${memberAvatarUrl(member.id)}"
                      alt=""
                    />

                    <span class="member-avatar-initials">

                    ${escapeHtml(
                      initials(
                        member.full_name
                      )
                    )}

                    </span>

                  </div>

                </div>


                <div class="member-meta">

                  <div class="member-contact">

                    <span class="member-detail-label">Contato</span>

                    <div class="phone-protected">

                    <span
                      class="member-phone"
                      data-phone="${escapeHtml(
                        member.phone
                      )}"
                      data-visible="false"
                    >
                      ${escapeHtml(
                        formatPhone(
                          member.phone,
                          false
                        )
                      )}
                    </span>


                    <button
                      type="button"
                      class="phone-toggle"
                      title="Mostrar telefone"
                      aria-label="Mostrar telefone"
                    >
                      👁
                    </button>

                    </div>

                    <label class="member-tip-value">
                      <span>Valor da gorjeta</span>
                      <input class="member-tip-amount" data-tip-amount="${escapeHtml(member.id)}" type="number" min="0.01" step="0.01" value="20.00" inputmode="decimal" aria-label="Valor da gorjeta" />
                    </label>

                  </div>


                  <div class="member-tip-actions">

                    <span class="member-detail-label">Nova gorjeta</span>

                    <div class="member-tip-controls">
                  <button
                    type="button"
                    class="card-tip"
                    data-tip-member="${escapeHtml(
                      member.id
                    )}"
                  >
                    Dar gorjeta ✦
                  </button>
                  </div>

                  </div>

                </div>

              </article>

            `
          )
          .join('')

      : `

        <div class="empty-state">
          Nenhum membro encontrado ainda.
        </div>

      `;


  grid
    .querySelectorAll('.member-avatar-image')
    .forEach(
      (image) => {

        image.addEventListener(
          'error',
          () => {

            image.parentElement?.classList.add('avatar-fallback');
            image.remove();

          },
          { once: true }
        );

      }
    );


  /* =========================================
     BOTÃO DE GORJETA
  ========================================= */

  document
    .querySelectorAll(
      '[data-tip-member]'
    )
    .forEach(
      (button) => {

        button.addEventListener(
          'click',
          async () => {

            if (
              state.tipLoading
            ) {

              return;

            }


            const memberId =
              button.dataset.tipMember;

            const amountInput = document.querySelector(`[data-tip-amount="${CSS.escape(memberId)}"]`);
            const amount = Number(amountInput?.value);


            if (!memberId) {

              return;

            }


            if (!Number.isFinite(amount) || amount <= 0) {
              showDashboardMessage('Informe um valor de gorjeta maior que zero.');
              amountInput?.focus();
              return;
            }

            await playCasinoTipAnimation(memberId, amount);

          }
        );

      }
    );


  setupPhoneVisibility();

}


/* =========================================================
   ROLETA
========================================================= */

function renderRoulette() {

  if (
    $('#roulette-count')
  ) {

    $('#roulette-count')
      .textContent =
      state.members.length;

  }


  const list =
    $('#roulette-list');


  if (!list) return;

  renderRouletteWheel();


  list.innerHTML =
    state.members.length

      ? state.members
          .map(
            (member) => `

              <div class="roulette-person">

                <strong>
                  ${escapeHtml(
                    member.full_name
                  )}
                </strong>

                <span>
                  @${escapeHtml(
                    member.twitch_nick
                  )}
                </span>

              </div>

            `
          )
          .join('')

      : `

        <div class="empty-state">
          Cadastre membros para liberar a roleta.
        </div>

      `;

}


function renderRouletteWheel() {

  const wheel = $('#roulette-wheel');

  if (!wheel) return;

  const total = state.members.length;

  wheel.querySelectorAll('.roulette-wheel-label').forEach(
    (label) => label.remove()
  );

  if (!total) {
    wheel.style.background = 'repeating-conic-gradient(#c69229 0deg 1deg, #292117 1deg 30deg)';
    return;
  }

  const colors = ['#bd7f23', '#5b8d70', '#965346', '#497a91', '#785a9d', '#b89137'];
  const slice = 360 / total;
  const segments = state.members.map((member, index) => {
    const start = (index * slice).toFixed(3);
    const end = ((index + 1) * slice).toFixed(3);
    return `${colors[index % colors.length]} ${start}deg ${end}deg`;
  });

  wheel.style.background = `conic-gradient(${segments.join(',')})`;

  state.members.forEach((member, index) => {

    const label = document.createElement('span');
    const angle = (index * slice) + (slice / 2) - 90;
    const fontSize = total > 18 ? 7 : total > 12 ? 8 : 9;

    label.className = 'roulette-wheel-label';
    label.textContent = member.full_name;
    label.title = member.full_name;
    label.style.fontSize = `${fontSize}px`;
    label.style.transform = `rotate(${angle}deg) translateX(38px)`;

    wheel.insertBefore(label, wheel.firstElementChild);

  });

}


/* =========================================================
   GORJETAS
========================================================= */

function renderTips() {

  if (
    $('#tip-total')
  ) {

    const total =
      state.tips.reduce(
        (sum, tip) =>
          sum +
          Number(
            tip.amount || 0
          ),
        0
      );


    $('#tip-total')
      .textContent =
      `R$ ${total
        .toFixed(2)
        .replace('.', ',')}`;

  }


  const list =
    $('#tips-list');


  if (!list) return;


  list.innerHTML =
    state.tips.length

      ? state.tips
          .map(
            (tip) => {

              const memberName =
                tip.members?.full_name ||
                tip.member_name ||
                'Membro';


              const twitchNick =
                tip.members?.twitch_nick ||
                tip.twitch_nick ||
                '';


              const phone = String(
                tip.members?.phone || ''
              ).replace(/\D/g, '');


              const whatsappUrl =
                phone.length === 11
                  ? `https://wa.me/55${phone}`
                  : '';


              let sourceLabel =
                'Membro';


              if (
                tip.source ===
                'roulette'
              ) {

                sourceLabel =
                  'Roleta';

              }


              if (
                tip.source ===
                'plinko'
              ) {

                sourceLabel =
                  'Plinko';

              }


              if (
                tip.source ===
                'battle_royale'
              ) {

                sourceLabel =
                  'Battle Royale';

              }


              return `

                <div class="tip-row">

                  <div class="tip-winner">

                    ${escapeHtml(
                      memberName
                    )}

                    <small>
                      @${escapeHtml(
                        twitchNick
                      )}
                    </small>

                  </div>


                  <div class="tip-detail">

                    R$ ${Number(
                      tip.amount || 0
                    )
                      .toFixed(2)
                      .replace(
                        '.',
                        ','
                      )}

                  </div>


                  <div class="tip-kind">

                    ${sourceLabel}

                  </div>


                  <div class="tip-date">

                    ${new Date(
                      tip.created_at
                    ).toLocaleDateString(
                      'pt-BR'
                    )}

                  </div>


                  ${
                    whatsappUrl
                      ? `
                        <a
                          class="whatsapp-tip-button"
                          href="${whatsappUrl}"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Abrir WhatsApp de ${escapeHtml(memberName)}"
                        >
                          WhatsApp
                        </a>
                      `
                      : ''
                  }


                  <button
                    type="button"
                    class="delete-tip-button"
                    data-tip-id="${escapeHtml(
                      tip.id
                    )}"
                    title="Excluir gorjeta"
                    aria-label="Excluir gorjeta"
                  >
                    🗑
                  </button>

                </div>

              `;

            }
          )
          .join('')

      : `

        <div class="empty-state">
          Nenhuma gorjeta registrada ainda.
        </div>

      `;


  setupTipDeleteButtons();

}


/* =========================================================
   BOTÕES DE EXCLUIR GORJETA
========================================================= */

function setupTipDeleteButtons() {

  document
    .querySelectorAll(
      '.delete-tip-button'
    )
    .forEach(
      (button) => {

        button.addEventListener(
          'click',
          () => {

            const tipId =
              button.dataset.tipId;


            if (!tipId) return;


            deleteTip(
              tipId
            );

          }
        );

      }
    );

}


/* =========================================================
   EXCLUIR GORJETA
========================================================= */

async function deleteTip(
  tipId
) {

  const tip =
    state.tips.find(
      (item) =>
        String(item.id) ===
        String(tipId)
    );


  if (!tip) {

    showDashboardMessage(
      'Gorjeta não encontrada.'
    );

    return;

  }


  const memberName =
    tip.members?.full_name ||
    tip.member_name ||
    'Membro';


  const confirmed =
    window.confirm(
      `Excluir esta gorjeta?\n\n` +
      `Membro: ${memberName}\n\n` +
      `Valor: R$ ${Number(
        tip.amount || 0
      ).toFixed(2).replace(
        '.',
        ','
      )}\n\n` +
      `Origem: ${
        tip.source === 'plinko'
          ? 'Plinko'
          : tip.source === 'battle_royale'
          ? 'Battle Royale'
          : tip.source === 'roulette'
          ? 'Roleta'
          : 'Membro'
      }\n\n` +
      `Essa ação não pode ser desfeita.`
    );


  if (!confirmed) return;


  try {

    const {
      error
    } = await supabase
      .from('tips')
      .delete()
      .eq(
        'id',
        tipId
      );


    if (error) {

      throw error;

    }


    state.tips =
      state.tips.filter(
        (item) =>
          String(item.id) !==
          String(tipId)
      );


    renderAll();


    showDashboardMessage(
      'Gorjeta excluída com sucesso.'
    );


  } catch (error) {

    console.error(
      'Erro ao excluir gorjeta:',
      error
    );


    showDashboardMessage(
      `Não foi possível excluir a gorjeta: ${
        error.message ||
        'erro desconhecido'
      }`
    );

  }

}


/* =========================================================
   EXCLUIR TODOS OS MEMBROS
========================================================= */

async function deleteAllMembers() {

  if (
    !state.members.length
  ) {

    showDashboardMessage(
      'Não existem membros para excluir.'
    );

    return;

  }


  const confirmed =
    window.confirm(
      `ATENÇÃO!\n\n` +
      `Você está prestes a excluir TODOS os ${state.members.length} membros.\n\n` +
      `As gorjetas relacionadas também serão excluídas.\n\n` +
      `Essa ação não pode ser desfeita.\n\n` +
      `Deseja continuar?`
    );


  if (!confirmed) return;


  const doubleConfirmed =
    window.confirm(
      'CONFIRMAÇÃO FINAL:\n\n' +
      'Você realmente deseja excluir TODOS os cadastros?'
    );


  if (!doubleConfirmed) return;


  try {

    const {
      error
    } = await supabase
      .from('members')
      .delete()
      .neq(
        'id',
        '00000000-0000-0000-0000-000000000000'
      );


    if (error) {

      console.error(
        'Erro ao excluir membros:',
        error
      );

      throw error;

    }


    state.members = [];

    state.tips = [];


    renderAll();


    showDashboardMessage(
      'Todos os cadastros foram excluídos com sucesso.'
    );


  } catch (error) {

    console.error(
      'Erro ao excluir todos os membros:',
      error
    );


    showDashboardMessage(
      `Não foi possível excluir os cadastros: ${
        error.message ||
        'erro desconhecido'
      }`
    );

  }

}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function switchTab(
  tab
) {

  document
    .querySelectorAll('.nav-item')
    .forEach(
      (item) => {

        item.classList.toggle(
          'active',
          item.dataset.tab ===
          tab
        );

      }
    );


  document
    .querySelectorAll('.tab-content')
    .forEach(
      (content) => {

        content.classList.toggle(
          'active',
          content.id ===
          `${tab}-tab`
        );

      }
    );


  let title =
    'Membros';


  if (
    tab === 'roulette'
  ) {

    title =
      'Roleta';

  }


  if (
    tab === 'plinko'
  ) {

    title =
      'Plinko';

  }


  if (
    tab === 'battle'
  ) {

    title =
      'Battle Royale';

  }

  if (tab === 'slots') {
    title = 'Batalha de Slots';
  }

  if (
    tab === 'cash'
  ) {

    title =
      'Cash Gaúcho';

  }

  if (
    tab === 'bonus'
  ) {

    title =
      'RECOLHE O POTE';

  }


  if (
    tab === 'tips'
  ) {

    title =
      'Gorjetas';

  }

  if (
    tab === 'race'
  ) {

    title =
      'Corrida Gaúcha';

  }

  if (
    tab === 'chat-call'
  ) {

    title =
      'Call do Chat';

  }


  const pageTitle =
    $('#page-title');


  if (pageTitle) {

    pageTitle.textContent =
      title;

  }

}


/* =========================================================
   ESTILOS DA ANIMAÇÃO
========================================================= */

function injectCasinoStyles() {

  if (
    document.getElementById(
      'casino-tip-animation-styles'
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'casino-tip-animation-styles';


  style.textContent = `

    #gaucho-casino-overlay {

      position: fixed;

      inset: 0;

      z-index: 999999;

      display: flex;

      align-items: center;

      justify-content: center;

      padding: 20px;

      background:
        radial-gradient(
          circle at center,
          rgba(255, 193, 7, .15),
          transparent 35%
        ),
        rgba(0, 0, 0, .90);

      backdrop-filter: blur(8px);

      opacity: 0;

      visibility: hidden;

      pointer-events: none;

      transition:
        opacity .3s ease,
        visibility .3s ease;

    }


    #gaucho-casino-overlay.active {

      opacity: 1;

      visibility: visible;

      pointer-events: auto;

    }


    .gaucho-casino-box {

      position: relative;

      width: min(580px, 94vw);

      padding: 35px 25px;

      overflow: hidden;

      text-align: center;

      border-radius: 25px;

      background:
        radial-gradient(
          circle at top,
          rgba(255,215,0,.15),
          transparent 35%
        ),
        linear-gradient(
          145deg,
          #180303,
          #480606,
          #120101
        );

      border: 3px solid #d4af37;

      box-shadow:
        0 0 20px rgba(255,215,0,.45),
        0 0 70px rgba(255,0,0,.20),
        0 30px 100px rgba(0,0,0,.9);

      transform:
        scale(.65)
        rotate(-4deg);

      transition:
        transform .55s
        cubic-bezier(.2,1.5,.4,1);

    }


    #gaucho-casino-overlay.active
    .gaucho-casino-box {

      transform:
        scale(1)
        rotate(0);

    }


    .gaucho-casino-border {

      position: absolute;

      inset: 8px;

      border: 2px dotted #ffd700;

      border-radius: 18px;

      pointer-events: none;

      animation:
        casinoBorderFlash
        .6s
        linear
        infinite;

    }


    @keyframes casinoBorderFlash {

      0% {
        box-shadow:
          0 0 8px #ffd700;
      }

      50% {
        box-shadow:
          0 0 25px #ff3030;
      }

      100% {
        box-shadow:
          0 0 8px #ffd700;
      }

    }


    .gaucho-casino-label {

      position: relative;

      color: #ffd700;

      font-size: 13px;

      font-weight: 900;

      letter-spacing: 4px;

      margin-bottom: 8px;

    }


    .gaucho-casino-title {

      position: relative;

      margin: 0 0 18px;

      color: white;

      font-size:
        clamp(42px, 10vw, 72px);

      line-height: .9;

      font-weight: 1000;

      font-style: italic;

      text-transform: uppercase;

      text-shadow:
        0 4px 0 #8b0000,
        0 0 12px #ffd700,
        0 0 35px rgba(255,215,0,.9);

      animation:
        jackpotPulse
        .65s
        ease-in-out
        infinite
        alternate;

    }


    @keyframes jackpotPulse {

      from {
        transform: scale(1);
      }

      to {
        transform: scale(1.06);
      }

    }


    .gaucho-casino-subtitle {

      color:
        rgba(255,255,255,.75);

      font-size: 14px;

      margin-bottom: 18px;

    }


    .gaucho-reels {

      position: relative;

      display: flex;

      justify-content: center;

      gap: 10px;

      margin: 20px 0;

    }


    .gaucho-reel {

      width: 105px;

      height: 105px;

      display: flex;

      align-items: center;

      justify-content: center;

      border-radius: 15px;

      border: 4px solid #d4af37;

      background:
        linear-gradient(
          #ffffff,
          #eeeeee,
          #cccccc
        );

      box-shadow:
        inset 0 0 20px rgba(0,0,0,.35),
        0 0 18px rgba(255,215,0,.35);

      font-size: 55px;

    }


    .gaucho-reel.spinning {

      animation:
        reelShake
        .08s
        linear
        infinite;

    }


    @keyframes reelShake {

      0% {
        transform:
          translateY(-4px);
      }

      50% {
        transform:
          translateY(4px);
      }

      100% {
        transform:
          translateY(-4px);
      }

    }


    .gaucho-reel.winner {

      animation:
        winnerPop
        .45s
        ease-in-out
        3;

      border-color: white;

      box-shadow:
        0 0 20px #ffd700,
        0 0 55px rgba(255,215,0,.9);

    }


    @keyframes winnerPop {

      0%,100% {
        transform: scale(1);
      }

      50% {
        transform:
          scale(1.15)
          rotate(4deg);
      }

    }


    .gaucho-casino-amount {

      display: inline-block;

      padding: 10px 25px;

      border-radius: 999px;

      background:
        linear-gradient(
          #ffd700,
          #b8860b
        );

      color: #220000;

      font-size: 28px;

      font-weight: 1000;

      box-shadow:
        0 0 25px
        rgba(255,215,0,.5);

    }


    .gaucho-casino-member {

      margin-top: 15px;

      color: white;

      font-size: 17px;

      font-weight: 800;

    }


    .gaucho-casino-status {

      margin-top: 14px;

      color:
        rgba(255,255,255,.75);

      font-size: 14px;

      font-weight: 700;

    }


    .gaucho-casino-status.success {

      color: #62ff87;

      font-size: 17px;

      text-shadow:
        0 0 15px
        rgba(98,255,135,.8);

    }


    .gaucho-casino-status.error {

      color: #ff5555;

      font-size: 17px;

    }


    .gaucho-coin {

      position: absolute;

      top: -50px;

      pointer-events: none;

      font-size: 25px;

      z-index: 10;

      animation:
        coinFall
        2.4s
        linear
        forwards;

    }


    @keyframes coinFall {

      from {

        transform:
          translateY(0)
          rotate(0deg);

        opacity: 1;

      }

      to {

        transform:
          translateY(700px)
          rotate(720deg);

        opacity: 0;

      }

    }


    @media(max-width:600px) {

      .gaucho-reel {

        width: 82px;

        height: 82px;

        font-size: 42px;

      }


      .gaucho-casino-box {

        padding:
          30px 15px;

      }


      .gaucho-casino-label {

        font-size: 10px;

        letter-spacing: 2px;

      }

    }

  `;


  document.head.appendChild(
    style
  );

}


/* =========================================================
   CRIAR OVERLAY DA ANIMAÇÃO
========================================================= */

function createCasinoOverlay(
  member,
  amount
) {

  injectCasinoStyles();


  const oldOverlay =
    document.getElementById(
      'gaucho-casino-overlay'
    );


  if (oldOverlay) {

    oldOverlay.remove();

  }


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'gaucho-casino-overlay';


  overlay.setAttribute(
    'aria-hidden',
    'true'
  );


  overlay.innerHTML = `

    <div class="gaucho-casino-box">

      <div
        class="gaucho-casino-border"
      ></div>


      <div class="gaucho-casino-label">

        🎰 GORJETA DO GAÚCHO 🎰

      </div>


      <div class="gaucho-casino-title">

        JACKPOT!

      </div>


      <div class="gaucho-casino-subtitle">

        Preparando sua gorjeta...

      </div>


      <div class="gaucho-reels">

        <div class="gaucho-reel spinning">
          💰
        </div>

        <div class="gaucho-reel spinning">
          💎
        </div>

        <div class="gaucho-reel spinning">
          7️⃣
        </div>

      </div>


      <div class="gaucho-casino-amount">

        R$ ${Number(amount)
          .toFixed(2)
          .replace('.', ',')}

      </div>


      <div class="gaucho-casino-member">

        ✦ ${escapeHtml(
          member.full_name
        )} ✦

      </div>


      <div class="gaucho-casino-status">

        🎰 Girando...

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );

  return overlay;

}


/* =========================================================
   MOEDAS
========================================================= */

function createCasinoCoins(
  overlay
) {

  const box =
    overlay.querySelector(
      '.gaucho-casino-box'
    );


  if (!box) return;


  box
    .querySelectorAll(
      '.gaucho-coin'
    )
    .forEach(
      (coin) =>
        coin.remove()
    );


  const coins = [
    '🪙',
    '💰',
    '💎',
    '✨',
    '🤑'
  ];


  for (
    let i = 0;
    i < 35;
    i++
  ) {

    const coin =
      document.createElement(
        'span'
      );


    coin.className =
      'gaucho-coin';


    coin.textContent =
      coins[
        Math.floor(
          Math.random() *
          coins.length
        )
      ];


    coin.style.left =
      `${Math.random() * 100}%`;


    coin.style.animationDelay =
      `${Math.random() * .8}s`;


    coin.style.fontSize =
      `${18 + Math.random() * 18}px`;


    box.appendChild(
      coin
    );

  }

}


/* =========================================================
   ANIMAÇÃO DE GORJETA
========================================================= */

async function playCasinoTipAnimation(
  memberId,
  amount = 20
) {

  if (
    state.tipLoading
  ) {

    return false;

  }


  const member =
    state.members.find(
      (item) =>
        String(item.id) ===
        String(memberId)
    );


  if (!member) {

    showDashboardMessage(
      'Membro não encontrado.'
    );

    return false;

  }


  state.tipLoading =
    true;


  const buttons =
    document.querySelectorAll(
      '[data-tip-member]'
    );


  buttons.forEach(
    (button) => {

      button.disabled =
        true;

      button.classList.add(
        'processing'
      );

    }
  );


  let overlay =
    null;


  const symbols = [
    '💰',
    '💎',
    '🪙',
    '🍒',
    '⭐',
    '7️⃣'
  ];


  const intervals = [];


  try {

    /* =========================================
       CRIAR OVERLAY
    ========================================= */

    overlay =
      createCasinoOverlay(
        member,
        amount
      );


    /* =========================================
       MOSTRAR
    ========================================= */

    requestAnimationFrame(
      () => {

        if (!overlay) return;

        overlay.classList.add(
          'active'
        );

        overlay.setAttribute(
          'aria-hidden',
          'false'
        );

      }
    );


    const reels =
      overlay.querySelectorAll(
        '.gaucho-reel'
      );


    const subtitle =
      overlay.querySelector(
        '.gaucho-casino-subtitle'
      );


    const status =
      overlay.querySelector(
        '.gaucho-casino-status'
      );


    /* =========================================
       MOEDAS
    ========================================= */

    createCasinoCoins(
      overlay
    );


    /* =========================================
       GIRAR ROLETAS
    ========================================= */

    reels.forEach(
      (reel, index) => {

        const interval =
          setInterval(
            () => {

              reel.textContent =
                symbols[
                  Math.floor(
                    Math.random() *
                    symbols.length
                  )
                ];

            },
            75 + index * 20
          );


        intervals.push(
          interval
        );

      }
    );


    await sleep(
      1400
    );


    if (subtitle) {

      subtitle.textContent =
        '🔥 QUASE LÁ...';

    }


    await sleep(
      600
    );


    /* =========================================
       PARAR ROLETAS
    ========================================= */

    for (
      let index = 0;
      index < reels.length;
      index++
    ) {

      clearInterval(
        intervals[index]
      );


      reels[index].classList.remove(
        'spinning'
      );


      reels[index].textContent =
        '7️⃣';


      reels[index].classList.add(
        'winner'
      );


      await sleep(
        450
      );

    }


    if (subtitle) {

      subtitle.textContent =
        '💰 GORJETA PREMIADA!';

    }


    if (status) {

      status.textContent =
        'Registrando gorjeta...';

    }


    /* =========================================
       SALVAR NO SUPABASE
    ========================================= */

    const success =
      await registerTip(
        member.id,
        'members',
        true,
        amount
      );


    if (!success) {

      throw new Error(
        'Não foi possível registrar a gorjeta.'
      );

    }


    /* =========================================
       SUCESSO
    ========================================= */

    if (status) {

      status.textContent =
        '🎉 GORJETA REGISTRADA!';

      status.classList.add(
        'success'
      );

    }


    createCasinoCoins(
      overlay
    );


    await sleep(
      1800
    );


    overlay.classList.remove(
      'active'
    );


    overlay.setAttribute(
      'aria-hidden',
      'true'
    );


    await sleep(
      400
    );


    overlay.remove();


    return true;


  } catch (error) {

    console.error(
      'Erro na animação:',
      error
    );


    if (overlay) {

      const status =
        overlay.querySelector(
          '.gaucho-casino-status'
        );


      if (status) {

        status.textContent =
          '❌ ERRO AO REGISTRAR';

        status.classList.add(
          'error'
        );

      }


      await sleep(
        1800
      );


      overlay.classList.remove(
        'active'
      );


      overlay.setAttribute(
        'aria-hidden',
        'true'
      );


      await sleep(
        400
      );


      overlay.remove();

    }


    showDashboardMessage(
      `Não foi possível registrar a gorjeta: ${
        error.message ||
        'erro desconhecido'
      }`
    );


    return false;


  } finally {

    intervals.forEach(
      (interval) => {

        clearInterval(
          interval
        );

      }
    );


    state.tipLoading =
      false;


    buttons.forEach(
      (button) => {

        button.disabled =
          false;

        button.classList.remove(
          'processing'
        );

      }
    );

  }

}


/* =========================================================
   REGISTRAR GORJETA
========================================================= */

async function registerTip(
  memberId,
  source = 'members',
  fromAnimation = false,
  tipAmount = 20
) {

  if (
    state.tipLoading &&
    !fromAnimation
  ) {

    return false;

  }


  const member =
    state.members.find(
      (item) =>
        String(item.id) ===
        String(memberId)
    );


  if (!member) {

    console.error(
      'Membro não encontrado:',
      memberId
    );


    return false;

  }


  const validSources = [
    'members',
    'roulette',
    'plinko'
  ];


  const validSource =
    validSources.includes(
      source
    )
      ? source
      : 'members';


  const amount = Number(tipAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    showDashboardMessage('Informe um valor de gorjeta maior que zero.');
    return false;
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from('tips')
      .insert({
        member_id:
          member.id,

        amount,

        source:
          validSource
      })
      .select(`
        *,
        members (
          full_name,
          twitch_nick,
          phone
        )
      `)
      .single();


    if (error) {

      console.error(
        'Erro ao registrar gorjeta:',
        error
      );


      throw error;

    }


    state.tips.unshift(
      data
    );


    renderAll();


    const sourceLabel =
      validSource === 'roulette'
        ? 'Roleta'
        : validSource === 'plinko'
        ? 'Plinko'
        : 'Membro';


    showDashboardMessage(
      `Gorjeta de R$ 20,00 registrada para ${member.full_name} via ${sourceLabel}.`
    );


    return true;


  } catch (error) {

    console.error(
      'Erro na gorjeta:',
      error
    );


    showDashboardMessage(
      `Não foi possível registrar a gorjeta: ${
        error.message ||
        'erro desconhecido'
      }`
    );


    return false;

  }

}


/* =========================================================
   ROLETA
========================================================= */

async function spinRoulette() {

  if (
    !state.members.length
  ) {

    showDashboardMessage(
      'Cadastre pelo menos um membro antes de girar.'
    );

    return;

  }


  if (
    state.tipLoading
  ) {

    return;

  }


  const button =
    $('#spin-button');


  const result =
    $('#roulette-result');

  const amount = Number($('#roulette-tip-amount')?.value);


  if (
    !button ||
    !result
  ) {

    return;

  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showDashboardMessage('Informe um valor de gorjeta maior que zero.');
    $('#roulette-tip-amount')?.focus();
    return;
  }


  button.disabled =
    true;


  let chosen =
    state.members[
      Math.floor(
        Math.random() * state.members.length
      )
    ];

  const wheel = $('#roulette-wheel');

  let spinFinished = Promise.resolve();


  try {

    if (wheel) {

      const winnerIndex = state.members.findIndex(
        (member) => member.id === chosen.id
      );
      const slice = 360 / state.members.length;
      const landingAngle =
        (360 - ((winnerIndex + .5) * slice)) % 360;

      const finalRotation = (360 * 7) + landingAngle;

      wheel.getAnimations().forEach(
        (animation) => animation.cancel()
      );
      wheel.classList.remove('spinning');
      wheel.style.transform = 'rotate(0deg)';
      void wheel.offsetWidth;

      const animation = wheel.animate(
        [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${finalRotation}deg)` }
        ],
        {
          duration: 4100,
          easing: 'cubic-bezier(.12, .75, .1, 1)',
          fill: 'forwards'
        }
      );

      spinFinished = animation.finished.catch(
        () => undefined
      );

    }

    result.innerHTML = `

      <span>✦</span>

      <strong>Roleta girando...</strong>

      <small>O resultado será definido pelo ponteiro.</small>

    `;

    await spinFinished;

    result.innerHTML = `

      <span>${escapeHtml(initials(chosen.full_name))}</span>

      <strong>${escapeHtml(chosen.full_name)}</strong>

      <small>Ganhador da rodada</small>

    `;


    if (chosen) {

      await registerTip(
        chosen.id,
        'roulette',
        false,
        amount
      );

    }


  } finally {

    button.disabled =
      false;

  }

}


/* =========================================================
   MENSAGEM DO DASHBOARD
========================================================= */

function showDashboardMessage(
  message
) {

  const element =
    $('#dashboard-feedback');


  if (!element) return;


  element.textContent =
    message;


  window.clearTimeout(
    window.gauchoMessage
  );


  window.gauchoMessage =
    window.setTimeout(
      () => {

        element.textContent =
          '';

      },
      5000
    );

}
