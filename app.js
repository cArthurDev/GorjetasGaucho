import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_USER, ADMIN_PASSWORD } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const isAdmin = window.location.pathname.includes('/admin');
const state = { members: [], tips: [], filter: '' };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const initials = (name) => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const feedback = (element, message, type = '') => { element.textContent = message; element.className = `feedback ${type}`; };

if (isAdmin) initAdmin(); else initMembers();

function initMembers() {
  const form = $('#member-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button'); const original = button.innerHTML;
    button.disabled = true; button.innerHTML = 'Enviando...';
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = await supabase.from('members').insert(values);
    button.disabled = false; button.innerHTML = original;
    if (error) { feedback($('#form-feedback'), 'Não foi possível concluir agora. Tente novamente em instantes.', 'error'); return; }
    form.reset(); feedback($('#form-feedback'), 'Cadastro realizado. Você já está na comunidade!', 'success');
  });
}

function initAdmin() {
  if (sessionStorage.getItem('gaucho_admin') === 'true') showDashboard();
  $('#login-form')?.addEventListener('submit', (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (values.username === ADMIN_USER && values.password === ADMIN_PASSWORD) { sessionStorage.setItem('gaucho_admin', 'true'); showDashboard(); }
    else feedback($('#login-feedback'), 'Login ou senha incorretos.', 'error');
  });
  $('#logout-button')?.addEventListener('click', () => { sessionStorage.removeItem('gaucho_admin'); location.reload(); });
}

async function showDashboard() {
  $('#login-view').classList.add('hidden'); $('#dashboard-view').classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => switchTab(item.dataset.tab)));
  $('#member-search').addEventListener('input', (event) => { state.filter = event.target.value.toLowerCase(); renderMembers(); });
  $('#spin-button').addEventListener('click', spinRoulette);
  await loadData();
}

async function loadData() {
  const [{ data: members, error: membersError }, { data: tips, error: tipsError }] = await Promise.all([
    supabase.from('members').select('*').order('created_at', { ascending: false }),
    supabase.from('tips').select('*, members(full_name, twitch_nick)').order('created_at', { ascending: false })
  ]);
  if (membersError || tipsError) showDashboardMessage('Crie as tabelas do Supabase usando o arquivo supabase-schema.sql para carregar os dados.');
  state.members = members || []; state.tips = tips || []; renderAll();
}

function renderAll() { renderMembers(); renderRoulette(); renderTips(); $('#nav-member-count').textContent = state.members.length; $('#nav-tip-count').textContent = state.tips.length; }
function renderMembers() {
  const filtered = state.members.filter((member) => `${member.full_name} ${member.twitch_nick}`.toLowerCase().includes(state.filter));
  $('#members-grid').innerHTML = filtered.length ? filtered.map((member) => `<article class="member-card"><div class="member-top"><div><h3 class="member-name">${escapeHtml(member.full_name)}</h3><div class="member-nick">@${escapeHtml(member.twitch_nick)}</div></div><div class="member-avatar">${escapeHtml(initials(member.full_name))}</div></div><div class="member-meta"><span>${escapeHtml(member.phone)}</span><button class="card-tip" data-tip-member="${member.id}">Dar gorjeta ✦</button></div></article>`).join('') : '<div class="empty-state">Nenhum membro encontrado ainda.</div>';
  document.querySelectorAll('[data-tip-member]').forEach((button) => button.addEventListener('click', () => registerTip(button.dataset.tipMember, 'Painel')));
}
function renderRoulette() { $('#roulette-count').textContent = state.members.length; $('#roulette-list').innerHTML = state.members.length ? state.members.map((member) => `<div class="roulette-person"><strong>${escapeHtml(member.full_name)}</strong><span>@${escapeHtml(member.twitch_nick)}</span></div>`).join('') : '<div class="empty-state">Cadastre membros para liberar a roleta.</div>'; }
function renderTips() {
  $('#tip-total').textContent = state.tips.length;
  $('#tips-list').innerHTML = state.tips.length ? state.tips.map((tip) => `<div class="tip-row"><div class="tip-winner">${escapeHtml(tip.members?.full_name || tip.member_name || 'Membro')}<small>@${escapeHtml(tip.members?.twitch_nick || tip.twitch_nick || '')}</small></div><div class="tip-detail">Gorjeta registrada</div><div class="tip-kind">${escapeHtml(tip.source || 'Painel')}</div><div class="tip-date">${new Date(tip.created_at).toLocaleDateString('pt-BR')}</div></div>`).join('') : '<div class="empty-state">Nenhuma gorjeta registrada ainda.</div>';
}
function switchTab(tab) { document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.tab === tab)); document.querySelectorAll('.tab-content').forEach((content) => content.classList.toggle('active', content.id === `${tab}-tab`)); $('#page-title').textContent = tab === 'members' ? 'Membros' : tab === 'roulette' ? 'Roleta' : 'Gorjetas'; }
async function registerTip(memberId, source) { const member = state.members.find((item) => String(item.id) === String(memberId)); if (!member) return; const { error } = await supabase.from('tips').insert({ member_id: member.id, source }); if (error) { showDashboardMessage('Não foi possível registrar a gorjeta.'); return; } state.tips.unshift({ members: member, source, created_at: new Date().toISOString() }); renderAll(); showDashboardMessage(`Gorjeta registrada para ${member.full_name}.`); }
async function spinRoulette() { if (!state.members.length) { showDashboardMessage('Cadastre pelo menos um membro antes de girar.'); return; } const button = $('#spin-button'); button.disabled = true; const result = $('#roulette-result'); let chosen; for (let index = 0; index < 14; index += 1) { chosen = state.members[Math.floor(Math.random() * state.members.length)]; result.innerHTML = `<span>${escapeHtml(initials(chosen.full_name))}</span><strong>${escapeHtml(chosen.full_name)}</strong><small>Sorteando...</small>`; await new Promise((resolve) => setTimeout(resolve, 80 + index * 14)); } result.querySelector('small').textContent = 'Ganhador da rodada'; await registerTip(chosen.id, 'Roleta'); button.disabled = false; }
function showDashboardMessage(message) { const element = $('#dashboard-feedback'); element.textContent = message; window.clearTimeout(window.gauchoMessage); window.gauchoMessage = window.setTimeout(() => { element.textContent = ''; }, 5000); }
