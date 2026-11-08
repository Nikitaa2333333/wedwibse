// Экраны кабинета подрядчика для ролика — собраны в системе кабинета
// (src/components/admin/base.css, cabinet.css; скилл cabinet-ui): Inter, поле #eff2f7,
// белые плашки 24–28 px, статус плашкой, действие текстом. Тексты — с настоящих экранов
// (/profi/moi/zayavki, /profi/moi/kartochka, окно «Фото с Яндекс Диска»).
// Демо-данные кабинета (лиловые заглушки) в ролик не берём: фото — настоящие кадры LЁD.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { CAB } from '../brand';
import { SCREEN_H, SCREEN_W } from './stage';

const S = (p: string) => staticFile(p);

// тонкие значки плиток — по мотивам AdminIcon (stroke 1.6, скруглённые концы)
const IC: Record<string, string> = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-3.4 3.6-5 7-5s6.2 1.6 7 5',
  photo: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Zm0 7 4.5-4 4 3.5 2.5-2 5 4',
  video: 'M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm12 2.5 4-2.5v8l-4-2.5',
  halls: 'M6 7h12M5 10.5h14v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18v-7.5Z',
  chat: 'M12 20a8 8 0 1 0-7-4.2L4 20l4.2-1A8 8 0 0 0 12 20Zm-3.5-8h.01M12 12h.01M15.5 12h.01',
  doc: 'M7 4h10a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 17 20H7a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 7 4Zm2 5h6m-6 3.5h6M9 16h4',
  ask: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3.5-8 2.5 2.5 4.5-5',
  phone: 'M7 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2Z',
  check: 'M5 12.5 10 17l9-10',
  plus: 'M12 6v12M6 12h12',
  back: 'M14.5 6 8.5 12l6 6',
  cards: 'M12 4 3 8.5l9 4.5 9-4.5L12 4Zm-9 8 9 4.5 9-4.5M3 15.5 12 20l9-4.5',
  mail: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 .5 8 5.5 8-5.5',
  help: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-2.3-10a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1.1.9-1.1 1.6v.4M12 16.5h.01',
  profile: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3 2.7-5 6-5s6 2 6 5',
};
export const Glyph: React.FC<{ n: keyof typeof IC | string; size?: number; color?: string; w?: number }> = ({ n, size = 24, color = CAB.text, w = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d={IC[n]} /></svg>
);

const base: React.CSSProperties = { fontFamily: CAB.font, color: CAB.text, WebkitFontSmoothing: 'antialiased' };

export const CabScreen: React.FC<{ children: React.ReactNode; tab?: string; style?: React.CSSProperties }> = ({ children, tab, style }) => (
  <div style={{ ...base, position: 'absolute', inset: 0, background: CAB.bg, ...style }}>
    <div style={{ position: 'absolute', inset: 0, paddingTop: 54 }}>{children}</div>
    {tab && <Tabs active={tab} />}
  </div>
);

/** нижнее меню кабинета: Карточки · Заявки · Помощь · Профиль */
export const Tabs: React.FC<{ active: string }> = ({ active }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, background: CAB.card, borderTop: `1px solid ${CAB.line}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '6px 4px 22px' }}>
    {[['cards', 'Карточки'], ['mail', 'Заявки'], ['help', 'Помощь'], ['profile', 'Профиль']].map(([ic, t]) => (
      <div key={t} style={{ display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 3, borderRadius: 12, background: active === t ? CAB.bg : 'transparent', fontSize: 12, fontWeight: active === t ? 600 : 500 }}>
        <Glyph n={ic} size={22} /> {t}
      </div>
    ))}
  </div>
);

export const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 600, letterSpacing: '-0.02em', padding: '6px 20px 14px' }}>{children}</div>
);

export const Chip: React.FC<{ kind: 'ok' | 'info' | 'new'; children: React.ReactNode; style?: React.CSSProperties }> = ({ kind, children, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, fontSize: 13, fontWeight: 600,
    background: kind === 'info' ? CAB.infoBg : CAB.okBg, color: kind === 'info' ? CAB.infoStrong : CAB.okStrong, whiteSpace: 'nowrap', ...style }}>{children}</span>
);

export const Btn: React.FC<{ children: React.ReactNode; dark?: boolean; h?: number; style?: React.CSSProperties }> = ({ children, dark, h = 48, style }) => (
  <div style={{ height: h, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 600,
    background: dark ? CAB.ink : CAB.bg, color: dark ? '#fff' : CAB.text, ...style }}>{children}</div>
);

// ——— заявка (/profi/moi/zayavki): имя, дата и гости крупно, сразу «Позвонить» ———
export const LEAD_RECT = { x: 4, y: 102, w: 382, h: 178 };
export const LeadCard: React.FC<{ callScale?: number }> = ({ callScale = 1 }) => (
  <div style={{ ...base, width: LEAD_RECT.w, height: LEAD_RECT.h, boxSizing: 'border-box', background: CAB.card, borderRadius: CAB.sheetRadius, padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '4px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, lineHeight: '24px', fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: CAB.okDot }} />Мария
      </div>
      <Chip kind="ok">Новая</Chip>
      <div style={{ gridColumn: '1 / -1', fontSize: 16, lineHeight: '22px', fontWeight: 500 }}>14 июня 2027, 80 гостей</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <Btn dark style={{ transform: `scale(${callScale})` }}>Позвонить</Btn>
      <Btn>Написать</Btn>
    </div>
    <div style={{ fontSize: 12 }}>Заявка пришла сегодня в 14:20</div>
  </div>
);

export const LeadsScreen: React.FC<{ callScale?: number }> = ({ callScale }) => (
  <CabScreen tab="Заявки">
    <H1>Заявки</H1>
    <div style={{ position: 'absolute', left: LEAD_RECT.x, top: LEAD_RECT.y }}><LeadCard callScale={callScale} /></div>
    <div style={{ position: 'absolute', left: 4, top: LEAD_RECT.y + LEAD_RECT.h + 8, width: 382, boxSizing: 'border-box', background: CAB.card, borderRadius: CAB.sheetRadius, padding: 18, display: 'grid', gap: 14, color: '#8a93a3' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Ольга</div>
        <span style={{ height: 26, padding: '0 10px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: CAB.bg, display: 'inline-flex', alignItems: 'center' }}>Просмотрена</span>
        <div style={{ gridColumn: '1 / -1', fontSize: 16, fontWeight: 500 }}>2 августа 2027, 40 гостей</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Btn>Позвонить</Btn><Btn>Написать</Btn></div>
    </div>
  </CabScreen>
);

// ——— уведомление о заявке (баннер поверх экрана) ———
export const PUSH_RECT = { x: 10, y: 52, w: 370, h: 96 };
export const Push: React.FC<{ title?: string; body?: string }> = ({ title = 'Новая заявка', body = 'Мария · 14 июня 2027, 80 гостей' }) => (
  <div style={{ ...base, width: PUSH_RECT.w, height: PUSH_RECT.h, boxSizing: 'border-box', borderRadius: 26, padding: '14px 16px', background: 'rgba(250,250,252,0.97)', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', display: 'grid', gap: 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <div style={{ width: 92, height: 17, background: CAB.ink, WebkitMaskImage: `url(${S('logo-tag.svg')})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat' }} />
      <span>сейчас</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 600, lineHeight: '21px' }}>{title}</div>
    <div style={{ fontSize: 15, lineHeight: '20px' }}>{body}</div>
  </div>
);

// ——— анкета карточки: плитки разделов (/profi/moi/kartochka) ———
export interface TileState { key: string; title: string; ic: string; sub: string; done?: boolean; optional?: boolean }
export const TILE = { w: 189, h: 140, gap: 4, top: 104 };
export const tileRect = (i: number) => ({ x: 4 + (i % 2) * (TILE.w + TILE.gap), y: TILE.top + Math.floor(i / 2) * (TILE.h + TILE.gap), w: TILE.w, h: TILE.h });

export const Tile: React.FC<{ t: TileState; style?: React.CSSProperties }> = ({ t, style }) => (
  <div style={{ ...base, position: 'relative', width: TILE.w, height: TILE.h, boxSizing: 'border-box', background: CAB.card, borderRadius: CAB.tileRadius, padding: 16, ...style }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: CAB.bg, display: 'grid', placeItems: 'center' }}><Glyph n={t.ic} /></div>
    {t.done && <div style={{ position: 'absolute', right: 16, top: 16 }}><Glyph n="check" size={20} color={CAB.okText} w={2} /></div>}
    <div style={{ marginTop: 20, fontSize: 17, fontWeight: 600, color: t.optional ? '#8a93a3' : CAB.text }}>{t.title}</div>
    <div style={{ marginTop: 4, fontSize: 13, lineHeight: '17px' }}>{t.sub}</div>
  </div>
);

export const EditorHead: React.FC<{ title: string; back?: string }> = ({ title, back = 'Мои карточки' }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 14px', fontSize: 16, fontWeight: 500 }}><Glyph n="back" size={20} />{back}</div>
    <H1>{title}</H1>
  </>
);

export const SUBMIT_RECT = { x: 4, y: 692, w: 382, h: 52 };

// ——— фото раздела: кнопка Диска, сетка кадров ———
export const ADD_RECT = { x: 6, y: 160, w: 300, h: 48 };
export const AddDisk: React.FC = () => (
  <div style={{ ...base, width: ADD_RECT.w, height: ADD_RECT.h, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', boxSizing: 'border-box', fontSize: 16, fontWeight: 500, background: CAB.card, borderRadius: 999 }}>
    <span style={{ width: 32, height: 32, borderRadius: 16, background: CAB.line, display: 'grid', placeItems: 'center' }}><Glyph n="plus" size={18} w={2} /></span>
    Добавить с Яндекс Диска
    <Img src={S('profi/yandex-disk.png')} style={{ width: 22, height: 22 }} />
  </div>
);

export const PhotoGrid: React.FC<{ photos: string[]; top: number; visible?: number; cover?: number; coverT?: number; pickedAt?: (i: number) => number | null; cell?: number }> = ({ photos, top, visible = photos.length, cover = -1, coverT = 0, pickedAt, cell = 124 }) => (
  <div style={{ position: 'absolute', left: 4, top, width: 382, display: 'grid', gridTemplateColumns: `repeat(3, ${cell}px)`, gap: 5 }}>
    {photos.map((p, i) => {
      const n = pickedAt?.(i) ?? null;
      const shown = i < visible;
      return (
        <div key={p} style={{ position: 'relative', width: cell, height: cell, borderRadius: 14, overflow: 'hidden', opacity: shown ? 1 : 0, transform: `scale(${shown ? 1 : 0.92})`, outline: n ? `3px solid ${CAB.ink}` : 'none', outlineOffset: -3 }}>
          <Img src={S(p)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {pickedAt && <span style={{ position: 'absolute', right: 7, top: 7, width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: n ? CAB.ink : 'rgba(255,255,255,0.75)', color: '#fff', boxShadow: n ? 'none' : 'inset 0 0 0 1.5px #fff' }}>{n ?? ''}</span>}
          {i === cover && coverT > 0 && (
            <span style={{ ...base, position: 'absolute', left: 7, bottom: 7, height: 24, padding: '0 9px', borderRadius: 999, background: CAB.card, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', opacity: coverT, transform: `translateY(${(1 - coverT) * 8}px)` }}>Обложка</span>
          )}
        </div>
      );
    })}
  </div>
);

// ——— капсула долгой операции (base.css .c-progress-pill): текст с процентом, полоса, «Прервать» ———
export const PILL_RECT = { x: 16, y: 744, w: 358, h: 52 };
export const ProgressPill: React.FC<{ pct: number }> = ({ pct }) => (
  <div style={{ ...base, position: 'relative', width: PILL_RECT.w, height: PILL_RECT.h, boxSizing: 'border-box', borderRadius: 22, overflow: 'hidden', isolation: 'isolate', background: CAB.ink, color: '#fff',
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 18px', fontSize: 15, fontWeight: 500 }}>
    <i style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(255,255,255,0.16)', zIndex: -1 }} />
    <span style={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}>{pct < 100 ? `Забираем фото с Диска · ${Math.round(pct)} %` : 'Фото в карточке'}</span>
    <span style={{ height: 32, padding: '0 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontWeight: 600, display: 'grid', placeItems: 'center' }}>{pct < 100 ? 'Прервать' : 'Готово'}</span>
  </div>
);

// ——— окно «Фото с Яндекс Диска» ———
export const YdDialog: React.FC<{ url: string; children?: React.ReactNode; bar?: React.ReactNode }> = ({ url, children, bar }) => (
  <div style={{ ...base, position: 'absolute', left: 0, right: 0, top: 70, height: SCREEN_H - 70, background: CAB.card, borderRadius: '28px 28px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.12)' }}>
    <div style={{ padding: '22px 20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
        <Img src={S('profi/yandex-disk.png')} style={{ width: 28, height: 28 }} />Фото с Яндекс Диска
      </div>
      <div style={{ fontSize: 15, lineHeight: '21px', marginTop: 10 }}>Вставьте ссылку на папку. Доступ к ней должен быть открыт всем, у кого есть ссылка</div>
      <div style={{ marginTop: 14, height: 48, borderRadius: 14, background: CAB.bg, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 16, color: url ? CAB.text : CAB.placeholder }}>
        {url || 'https://disk.yandex.ru/d/…'}
      </div>
    </div>
    {children}
    {bar}
  </div>
);

/** полоса снизу окна/экрана с кнопкой */
export const BottomBar: React.FC<{ children: React.ReactNode; top: number }> = ({ children, top }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top, padding: '0 4px' }}>{children}</div>
);

export const FieldCard: React.FC<{ label: string; children: React.ReactNode; h: number; style?: React.CSSProperties }> = ({ label, children, h, style }) => (
  <div style={{ ...base, background: CAB.card, borderRadius: CAB.sheetRadius, padding: '16px 18px', height: h, boxSizing: 'border-box', ...style }}>
    <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{label}</div>
    {children}
  </div>
);

export { SCREEN_W };
