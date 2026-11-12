// УЧЁТКА НЕВЕСТЫ (12.11.2026, docs/cabinet/REVIEWS.md): вход, чтобы оставить
// отзыв, и «Мои отзывы» на /moy/. Три способа, как у подрядчика: почта
// с кодом, Telegram, MAX (кнопки — те же компоненты с role="bride").
// Учётка появляется только вместе с подписью согласия на обработку ПДн
// (legal_docs, kind = bride-pdn) — галочка стоит прямо на странице входа.
import { api, session, saveSession } from './cabinet-api';

export const NEEDS_CONSENT = 'Отметьте согласие выше — без него учётку не создать.';
const RETURN_KEY = 'wed-bride-return';

export const brideSession = () => session('bride');

export function brideLogout() {
  saveSession('bride', null);
}

/** галочка согласия на странице входа */
export function brideConsent(): boolean {
  return !!document.querySelector<HTMLInputElement>('[data-bride-consent]')?.checked;
}

/** только свои адреса: ?next= не уводит на чужой сайт */
function safeNext(next: string | null | undefined): string {
  return next && /^\/(moy|moskva)\//.test(next) ? next : '/moy/';
}

/** не вошла — на вход с возвратом сюда же */
export function requireBride(): boolean {
  if (brideSession()) return true;
  location.replace(`/moy/vhod/?next=${encodeURIComponent(location.pathname + location.search)}`);
  return false;
}

export function brideAfterLogin() {
  const q = new URLSearchParams(location.search);
  let next = q.get('next');
  // MAX: вкладка могла перезагрузиться без ?next — адрес помним отдельно
  try { next ||= sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch {}
  location.href = safeNext(next);
}

export function rememberReturn() {
  const next = new URLSearchParams(location.search).get('next');
  try { if (next) sessionStorage.setItem(RETURN_KEY, next); } catch {}
}

/**
 * Согласие из базы — галочка с текстом документа по нажатию «читать».
 * false — редакции в базе нет: новые учётки закрыты (войти старой можно).
 */
export async function renderBrideConsent(el: HTMLElement): Promise<boolean> {
  const res = await api(null, 'GET', `/api/collections/legal_docs/records?sort=-created&perPage=1&filter=${encodeURIComponent('kind = "bride-pdn"')}`);
  const d = res.items?.[0];
  if (!d) return false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  // текст документа пишем мы сами в базе (редактор), поэтому как HTML
  el.innerHTML = `
    <div class="auth__doc">
      <label class="check">
        <input class="check__input" type="checkbox" data-bride-consent />
        <span class="check__box"></span>
        <span>${esc(d.checkbox)} <button class="auth__doc-link" type="button" aria-expanded="false" aria-controls="bride-doc" data-doc-toggle>читать</button></span>
      </label>
      <div class="auth__doc-text" id="bride-doc" hidden>${d.text}</div>
    </div>`;
  const b = el.querySelector<HTMLButtonElement>('[data-doc-toggle]')!;
  b.addEventListener('click', (ev) => {
    ev.preventDefault();
    const text = document.getElementById('bride-doc')!;
    text.hidden = !text.hidden;
    b.setAttribute('aria-expanded', String(!text.hidden));
    b.textContent = text.hidden ? 'читать' : 'скрыть';
  });
  return true;
}

/** шаг 1: учётка готова (или нужна галочка) и письмо с кодом ушло → otpId */
export async function brideSendCode(email: string): Promise<string> {
  const res = await api(null, 'POST', '/api/wed/bride/email', { email, accept: brideConsent() });
  if (res?.status === 'needs-accept') throw new Error(NEEDS_CONSENT);
  const r = await api<{ otpId: string }>(null, 'POST', '/api/collections/brides/request-otp', { email });
  return r.otpId;
}

/** шаг 2: код из письма → вход */
export async function brideCheckCode(otpId: string, code: string) {
  const res = await api(null, 'POST', '/api/collections/brides/auth-with-otp', { otpId, password: code });
  saveSession('bride', { token: res.token, record: res.record });
}
