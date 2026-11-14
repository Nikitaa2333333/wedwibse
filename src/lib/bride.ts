// УЧЁТКА НЕВЕСТЫ (12.11.2026, docs/cabinet/REVIEWS.md): вход, чтобы оставить
// отзыв, и «Мои отзывы» на /moy/. Три способа, как у подрядчика: почта
// с кодом, Telegram, MAX (кнопки — те же компоненты с role="bride").
// Учётка появляется только вместе с подписью согласия на обработку ПДн
// и Правил для молодожёнов (legal_docs: bride-pdn, bride-terms; тексты —
// src/data/legal/) — две галочки прямо на странице входа.
import { api, session, saveSession, ApiError } from './cabinet-api';

/**
 * Заявка с сайта (карточка, избранное). Вошедшая невеста шлёт её со своим
 * токеном — хук привязывает заявку к учётке, и она видна в кабинете (14.11).
 * Токен протух или чужой — повторяем без него: заявка важнее привязки.
 */
export async function postLead<T = any>(body: unknown): Promise<T> {
  if (session('bride')) {
    try {
      return await api<T>('bride', 'POST', '/api/wed/lead', body);
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) throw err;
    }
  }
  return api<T>(null, 'POST', '/api/wed/lead', body);
}

export const NEEDS_CONSENT = 'Отметьте обе галочки выше — без них учётку не создать.';
const RETURN_KEY = 'wed-bride-return';

export const brideSession = () => session('bride');

export function brideLogout() {
  saveSession('bride', null);
}

/** обе галочки на странице входа (Политика и Правила) */
export function brideConsent(): boolean {
  const boxes = [...document.querySelectorAll<HTMLInputElement>('[data-bride-consent]')];
  return boxes.length > 0 && boxes.every((b) => b.checked);
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

const DOC_PAGES: Record<string, string> = { 'bride-pdn': '/dokumenty/politika-konfidencialnosti/', 'bride-terms': '/dokumenty/pravila/' };
const BRIDE_KINDS = ['bride-terms', 'bride-pdn'];

/**
 * Документы невесты из базы (legal_docs: Правила и согласие по Политике) —
 * две галочки, у каждой ссылка на страницу документа. Подпись в базе —
 * дословно текст галочки. false — редакций в базе нет: новые учётки
 * закрыты (войти старой можно).
 */
export async function renderBrideConsent(el: HTMLElement): Promise<boolean> {
  const res = await api(null, 'GET', `/api/collections/legal_docs/records?sort=-created&perPage=20&filter=${encodeURIComponent(BRIDE_KINDS.map((k) => `kind = "${k}"`).join(' || '))}`);
  const latest = BRIDE_KINDS.map((k) => res.items?.find((d: any) => d.kind === k)).filter(Boolean);
  if (latest.length < BRIDE_KINDS.length) return false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  el.innerHTML = latest.map((d: any) => `
    <div class="auth__doc">
      <label class="check">
        <input class="check__input" type="checkbox" data-bride-consent />
        <span class="check__box"></span>
        <span>${esc(d.checkbox)} <a class="auth__doc-link" href="${DOC_PAGES[d.kind]}" target="_blank" rel="noopener">читать</a></span>
      </label>
    </div>`).join('');
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
