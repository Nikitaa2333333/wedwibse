// Вход подрядчика по почте (CABINET.md §9, §21): регистрация с условиями,
// подтверждение почты кодом из письма, вход паролем, новый пароль по коду.
// Код шлёт сама база (request-otp), проверяют наши маршруты /api/wed/confirm
// и /api/wed/password-reset (pb_hooks/lib/cabinet.js) — штатный вход кодом
// подменил бы пароль новичка случайным.
import { api, saveSession, esc } from './cabinet-api';

const CODE_KEY = 'wed-cab-code';

export interface CodeStep {
  email: string;
  otpId: string;
  invite?: string;
  next?: string;
}

/** письмо с кодом на почту; база отвечает otpId, даже если учётки нет */
export async function sendCode(email: string): Promise<string> {
  const r = await api<{ otpId: string }>(null, 'POST', '/api/collections/vendors/request-otp', { email });
  return r.otpId;
}

export function saveCodeStep(s: CodeStep) {
  try { sessionStorage.setItem(CODE_KEY, JSON.stringify(s)); } catch {}
}

export function codeStep(): CodeStep | null {
  try {
    const raw = sessionStorage.getItem(CODE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** ответ базы со входом → сессия подрядчика */
export function keep(res: { token: string; record: Record<string, any> }) {
  saveSession('vendor', { token: res.token, record: res.record });
  try { sessionStorage.removeItem(CODE_KEY); } catch {}
}

export async function loginWithPassword(email: string, password: string) {
  try {
    keep(await api(null, 'POST', '/api/collections/vendors/auth-with-password', { identity: email, password }));
  } catch (err) {
    // база не говорит, что именно не так: неверный пароль и неподтверждённая
    // почта для неё одно и то же — подсказываем оба случая
    if ((err as { status?: number }).status === 400) {
      throw new Error('Неверная почта или пароль. Если вы только что зарегистрировались и не ввели код из письма — зарегистрируйтесь ещё раз той же почтой.');
    }
    throw err;
  }
}

/**
 * Условия из базы — две галочки в разметке макета (.check), под каждой
 * текст документа по нажатию. Подпись в базе — дословно этот текст галочки.
 * false — редакций в базе нет, регистрация закрыта.
 */
export async function renderTerms(el: HTMLElement): Promise<boolean> {
  const res = await api(null, 'GET', `/api/collections/legal_docs/records?sort=-created&perPage=50&filter=${encodeURIComponent('kind = "vendor-offer" || kind = "vendor-pdn"')}`);
  const latest = ['vendor-offer', 'vendor-pdn'].map((k) => res.items.find((d: any) => d.kind === k)).filter(Boolean);
  if (latest.length < 2) return false;
  // текст документа пишем мы сами в базе (редактор), поэтому как HTML
  el.innerHTML = latest.map((d: any) => `
    <div>
      <label class="check">
        <input class="check__input" type="checkbox" data-consent-box />
        <span class="check__box"></span>
        <span>${esc(d.checkbox)}</span>
      </label>
      <details class="auth__doc"><summary>${esc(d.title)}</summary><div class="auth__doc-text">${d.text}</div></details>
    </div>`).join('');
  return true;
}
