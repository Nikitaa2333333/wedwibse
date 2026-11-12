// ДОКУМЕНТЫ САЙТА (12.11.2026): тексты юриста от Никиты, страницы /dokumenty/<slug>/.
// Исходник — .docx; HTML собирает scripts/legal-docx.py (src/data/legal/<slug>.html),
// список и редакции — src/data/legal/docs.json (его же читает legal-seed).
// Новая редакция: перегнать docx тем же скриптом, поправить date, затем
// node scripts/legal-seed.mjs — та же редакция уходит в legal_docs базы
// (подпись невесты хранит хеш именно этого текста).

import docs from './legal/docs.json';

export interface LegalDoc {
  slug: string;
  title: string;
  /** редакция, как в документе */
  date: string;
  /** вид в legal_docs, если документ подписывают галочкой */
  kind?: 'bride-pdn' | 'bride-terms';
  /** дословный текст галочки — он же уходит в подпись */
  checkbox?: string;
  description: string;
}

export const LEGAL_DOCS: LegalDoc[] = docs as LegalDoc[];

const files = import.meta.glob<string>('./legal/*.html', { eager: true, query: '?raw', import: 'default' });

export function legalHtml(slug: string): string {
  return files[`./legal/${slug}.html`] ?? '';
}

export const legalUrl = (slug: string) => `/dokumenty/${slug}/`;
