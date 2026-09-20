import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ADMIN_USER,
  ADMIN_PASSWORD
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


  await loadData();

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


                  <div class="member-tip-actions">
                    <input class="member-tip-amount" data-tip-amount="${escapeHtml(member.id)}" type="number" min="0.01" step="0.01" value="20.00" inputmode="decimal" aria-label="Valor da gorjeta" />
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

              </article>

            `
          )
          .join('')

      : `

        <div class="empty-state">
          Nenhum membro encontrado ainda.
        </div>

      `;


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
