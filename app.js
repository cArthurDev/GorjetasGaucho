import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ADMIN_USER,
  ADMIN_PASSWORD
} from './config.js';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const isAdmin = window.location.pathname.includes('/admin');

const state = {
  members: [],
  tips: [],
  filter: ''
};

const $ = (selector) => document.querySelector(selector);

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

const feedback = (
  element,
  message,
  type = ''
) => {
  if (!element) return;

  element.textContent = message;
  element.className = `feedback ${type}`;
};


/* =========================================================
   MÁSCARA DE TELEFONE
   Exibe: (64) 99999-9999
   Salva no banco: 64999999999
========================================================= */

function setupPhoneMask() {
  const phoneInput = $('#phone');

  if (!phoneInput) return;

  phoneInput.addEventListener('input', (event) => {
    let value = event.target.value.replace(/\D/g, '');

    value = value.slice(0, 11);

    if (value.length > 0) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }

    if (value.length > 10) {
      value =
        value.slice(0, 10) +
        '-' +
        value.slice(10);
    }

    event.target.value = value;
  });

  phoneInput.addEventListener('blur', (event) => {
    let value = event.target.value.replace(/\D/g, '');

    if (value.length > 11) {
      value = value.slice(0, 11);
    }

    if (value.length === 11) {
      event.target.value =
        `(${value.slice(0, 2)}) ` +
        `${value.slice(2, 7)}-` +
        `${value.slice(7)}`;
    }
  });
}


/* =========================================================
   TELEFONE NO PAINEL
   Exibe: (64) 99999-****
   Botão permite mostrar/ocultar
========================================================= */

function formatPhone(phone, visible = false) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length !== 11) {
    return digits;
  }

  const ddd = digits.slice(0, 2);
  const first = digits.slice(2, 7);
  const last = digits.slice(7, 11);

  return visible
    ? `(${ddd}) ${first}-${last}`
    : `(${ddd}) ${first}-****`;
}


function setupPhoneVisibility() {
  document.querySelectorAll('.phone-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const container = button.closest('.phone-protected');
      const phoneElement =
        container?.querySelector('.member-phone');

      if (!phoneElement) return;

      const phone = phoneElement.dataset.phone || '';

      const isVisible =
        phoneElement.dataset.visible === 'true';

      const nextVisible = !isVisible;

      phoneElement.dataset.visible =
        String(nextVisible);

      phoneElement.textContent =
        formatPhone(phone, nextVisible);

      button.textContent =
        nextVisible ? '🙈' : '👁';

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
    });
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
   ÁREA PÚBLICA - CADASTRO
========================================================= */

function initMembers() {
  const form = $('#member-form');

  if (!form) return;

  setupPhoneMask();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = form.querySelector('button');
    const original =
      button?.innerHTML || 'Enviar';

    if (button) {
      button.disabled = true;
      button.innerHTML = 'Enviando...';
    }

    try {
      const values = Object.fromEntries(
        new FormData(form).entries()
      );

      const phone = String(
        values.phone || ''
      ).replace(/\D/g, '');

      const member = {
        full_name: String(
          values.full_name || ''
        ).trim(),

        phone: phone,

        twitch_nick: String(
          values.twitch_nick || ''
        ).trim()
      };

      console.log(
        'Enviando membro:',
        member
      );

      /* =========================
         VALIDAÇÃO DO NOME
      ========================= */

      if (
        member.full_name.length < 2 ||
        member.full_name.length > 120
      ) {
        throw new Error(
          'O nome deve ter entre 2 e 120 caracteres.'
        );
      }

      /* =========================
         VALIDAÇÃO DO TELEFONE
      ========================= */

      if (!/^\d{11}$/.test(member.phone)) {
        throw new Error(
          'O telefone deve conter exatamente 11 números.'
        );
      }

      /* =========================
         VALIDAÇÃO DO TWITCH
      ========================= */

      if (
        member.twitch_nick.length < 2 ||
        member.twitch_nick.length > 50
      ) {
        throw new Error(
          'O nick da Twitch deve ter entre 2 e 50 caracteres.'
        );
      }

      /* =========================
         VERIFICAR DUPLICADOS
      ========================= */

      const normalizedNick =
        member.twitch_nick
          .trim()
          .toLowerCase();

      const { data: existingMembers, error: checkError } =
        await supabase
          .from('members')
          .select('id, phone, twitch_nick')
          .or(
            `phone.eq.${member.phone},twitch_nick.ilike.${normalizedNick}`
          );

      if (checkError) {
        console.error(
          'Erro ao verificar cadastro:',
          checkError
        );

        throw new Error(
          'Não foi possível verificar seus dados. Tente novamente.'
        );
      }

      /* =========================
         VERIFICAR TELEFONE
      ========================= */

      const phoneExists =
        existingMembers?.some(
          item =>
            String(item.phone || '') ===
            member.phone
        );

      if (phoneExists) {
        throw new Error(
          'Este número de telefone já possui um cadastro.'
        );
      }

      /* =========================
         VERIFICAR TWITCH
      ========================= */

      const twitchExists =
        existingMembers?.some(
          item =>
            String(item.twitch_nick || '')
              .trim()
              .toLowerCase() ===
            normalizedNick
        );

      if (twitchExists) {
        throw new Error(
          'Este nick da Twitch já possui um cadastro.'
        );
      }

      /* =========================
         ENVIO PARA SUPABASE
      ========================= */

      const { data, error } =
        await supabase
          .from('members')
          .insert(member)
          .select()
          .single();

      console.log(
        'Resposta Supabase:',
        {
          data,
          error
        }
      );

      /* =========================
         TRATAMENTO DE ERRO
      ========================= */

      if (error) {
        console.error(
          'Erro ao cadastrar membro:',
          error
        );

        /*
         * 23505 = violação de UNIQUE
         * Isso protege contra duas pessoas
         * cadastrando o mesmo dado ao mesmo tempo.
         */

        if (error.code === '23505') {

          if (
            error.message
              ?.toLowerCase()
              .includes('phone')
          ) {
            throw new Error(
              'Este número de telefone já possui um cadastro.'
            );
          }

          if (
            error.message
              ?.toLowerCase()
              .includes('twitch')
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

      /* =========================
         SUCESSO
      ========================= */

      console.log(
        'Membro cadastrado com sucesso:',
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
        button.innerHTML = original;
      }
    }
  });
}

/* =========================================================
   ADMIN
========================================================= */

function initAdmin() {

  if (
    sessionStorage.getItem('gaucho_admin') === 'true'
  ) {
    showDashboard();
  }

  $('#login-form')?.addEventListener(
    'submit',
    (event) => {

      event.preventDefault();

      const values = Object.fromEntries(
        new FormData(
          event.currentTarget
        ).entries()
      );

      if (
        values.username === ADMIN_USER &&
        values.password === ADMIN_PASSWORD
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

  $('#logout-button')?.addEventListener(
    'click',
    () => {

      sessionStorage.removeItem(
        'gaucho_admin'
      );

      location.reload();
    }
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

async function showDashboard() {

  $('#login-view')?.classList.add('hidden');

  $('#dashboard-view')?.classList.remove('hidden');

  document
    .querySelectorAll('.nav-item')
    .forEach((item) => {

      item.addEventListener(
        'click',
        () => switchTab(item.dataset.tab)
      );
    });

  $('#member-search')?.addEventListener(
    'input',
    (event) => {

      state.filter =
        event.target.value.toLowerCase();

      renderMembers();
    }
  );

  $('#spin-button')?.addEventListener(
    'click',
    spinRoulette
  );

  await loadData();
}


/* =========================================================
   CARREGAR DADOS
========================================================= */

async function loadData() {

  try {

    const membersResult = await supabase
      .from('members')
      .select('*')
      .order('created_at', {
        ascending: false
      });

    if (membersResult.error) {

      console.error(
        'Erro ao carregar membros:',
        membersResult.error
      );

      throw membersResult.error;
    }

    const tipsResult = await supabase
      .from('tips')
      .select(`
        *,
        members (
          full_name,
          twitch_nick
        )
      `)
      .order('created_at', {
        ascending: false
      });

    if (tipsResult.error) {

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

  } catch (error) {

    console.error(
      'Erro ao carregar dashboard:',
      error
    );

    showDashboardMessage(
      `Erro ao carregar dados: ${
        error.message ||
        'Erro desconhecido'
      }`
    );
  }
}


/* =========================================================
   RENDERIZAÇÃO
========================================================= */

function renderAll() {

  renderMembers();
  renderRoulette();
  renderTips();

  if ($('#nav-member-count')) {
    $('#nav-member-count').textContent =
      state.members.length;
  }

  if ($('#nav-tip-count')) {
    $('#nav-tip-count').textContent =
      state.tips.length;
  }
}


/* =========================================================
   MEMBROS
========================================================= */

function renderMembers() {

  const filtered =
    state.members.filter(
      (member) =>
        `${member.full_name} ${member.twitch_nick}`
          .toLowerCase()
          .includes(state.filter)
    );

  if (!$('#members-grid')) return;

  $('#members-grid').innerHTML =
    filtered.length
      ? filtered
          .map(
            (member) => `
              <article class="member-card">

                <div class="member-top">

                  <div>

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
                    ${escapeHtml(
                      initials(
                        member.full_name
                      )
                    )}
                  </div>

                </div>

                <div class="member-meta">

                  <div class="phone-protected">

                    <span
                      class="member-phone"
                      data-phone="${escapeHtml(member.phone)}"
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

                  <button
                    class="card-tip"
                    data-tip-member="${member.id}"
                  >
                    Dar gorjeta ✦
                  </button>

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

  document
    .querySelectorAll(
      '[data-tip-member]'
    )
    .forEach((button) => {

      button.addEventListener(
        'click',
        () =>
          registerTip(
            button.dataset.tipMember,
            'members'
          )
      );
    });

  setupPhoneVisibility();
}


/* =========================================================
   ROLETA
========================================================= */

function renderRoulette() {

  if ($('#roulette-count')) {

    $('#roulette-count').textContent =
      state.members.length;
  }

  if (!$('#roulette-list')) return;

  $('#roulette-list').innerHTML =
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


/* =========================================================
   GORJETAS
========================================================= */

function renderTips() {

  if ($('#tip-total')) {

    $('#tip-total').textContent =
      state.tips.length;
  }

  if (!$('#tips-list')) return;

  $('#tips-list').innerHTML =
    state.tips.length
      ? state.tips
          .map(
            (tip) => `
              <div class="tip-row">

                <div class="tip-winner">

                  ${escapeHtml(
                    tip.members?.full_name ||
                    tip.member_name ||
                    'Membro'
                  )}

                  <small>
                    @${escapeHtml(
                      tip.members?.twitch_nick ||
                      tip.twitch_nick ||
                      ''
                    )}
                  </small>

                </div>

                <div class="tip-detail">
                  Gorjeta registrada
                </div>

                <div class="tip-kind">
                  ${
                    tip.source === 'roulette'
                      ? 'Roleta'
                      : 'Membro'
                  }
                </div>

                <div class="tip-date">
                  ${new Date(
                    tip.created_at
                  ).toLocaleDateString(
                    'pt-BR'
                  )}
                </div>

              </div>
            `
          )
          .join('')
      : `
        <div class="empty-state">
          Nenhuma gorjeta registrada ainda.
        </div>
      `;
}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function switchTab(tab) {

  document
    .querySelectorAll('.nav-item')
    .forEach((item) => {

      item.classList.toggle(
        'active',
        item.dataset.tab === tab
      );
    });

  document
    .querySelectorAll('.tab-content')
    .forEach((content) => {

      content.classList.toggle(
        'active',
        content.id === `${tab}-tab`
      );
    });

  if ($('#page-title')) {

    $('#page-title').textContent =
      tab === 'members'
        ? 'Membros'
        : tab === 'roulette'
        ? 'Roleta'
        : 'Gorjetas';
  }
}


/* =========================================================
   REGISTRAR GORJETA
========================================================= */

async function registerTip(
  memberId,
  source = 'members'
) {

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

    return;
  }

  const validSource =
    source === 'roulette'
      ? 'roulette'
      : 'members';

  try {

    const { data, error } =
      await supabase
        .from('tips')
        .insert({
          member_id: member.id,
          amount: 50.00,
          source: validSource
        })
        .select(`
          *,
          members (
            full_name,
            twitch_nick
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

    state.tips.unshift(data);

    renderAll();

    showDashboardMessage(
      `Gorjeta registrada para ${member.full_name}.`
    );

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
  }
}


/* =========================================================
   ROLETA
========================================================= */

async function spinRoulette() {

  if (!state.members.length) {

    showDashboardMessage(
      'Cadastre pelo menos um membro antes de girar.'
    );

    return;
  }

  const button =
    $('#spin-button');

  const result =
    $('#roulette-result');

  if (!button || !result) return;

  button.disabled = true;

  let chosen = null;

  for (
    let index = 0;
    index < 14;
    index += 1
  ) {

    chosen =
      state.members[
        Math.floor(
          Math.random() *
          state.members.length
        )
      ];

    result.innerHTML = `
      <span>
        ${escapeHtml(
          initials(
            chosen.full_name
          )
        )}
      </span>

      <strong>
        ${escapeHtml(
          chosen.full_name
        )}
      </strong>

      <small>
        Sorteando...
      </small>
    `;

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          80 + index * 14
        )
    );
  }

  const small =
    result.querySelector('small');

  if (small) {
    small.textContent =
      'Ganhador da rodada';
  }

  await registerTip(
    chosen.id,
    'roulette'
  );

  button.disabled = false;
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
        element.textContent = '';
      },
      5000
    );
}