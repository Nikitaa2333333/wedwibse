// ДЕМО ДЛЯ ЗАКАЗЧИКА — первые 30 с промо (правки Никиты 08.11.2026 после раскадровки v1):
// меньше рамки телефона, больше крупных деталей интерфейса. Каждый элемент вырван
// из экрана и живёт на бумаге сам: карточка, плитки ленты, сердце, плашка «Добавлено
// в избранное», поля заявки, уведомление, заявка в кабинете. Без мелких служебных
// подписей («не выбрали — ничего страшного» и т. п.).
// Элементы сайта собраны в его системе (Onest, Cormorant в имени площадки, .pill, бумага),
// кабинета — в его (Inter, белые плашки), фото — настоящие кадры площадок.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BRAND, CAB } from './brand';
import { Chip, Glyph, LeadCard, Push } from './promo/cabinet';
import { easeInOut, easeOut, kf, press, prog, typed } from './promo/motion';
import { Logo, Tap, Words, useLayout, useTheme } from './promo/stage';

export const DEMO_DURATION = 900; // 30 с

const S = (p: string) => staticFile(p);
const HERO = 'venues/led/hero-main.webp'; // живой кадр LЁD: оранжерея в соснах, 3:4

// плитки ленты: [путь, высота/ширина]
const COLS: [string, number][][] = [
  [[HERO, 4 / 3], ['venues/villa-barvikha/p16.webp', 1.5], ['venues/spark-hall/hero-main.webp', 1.3], ['venues/due-to-love/p02.webp', 1.4]],
  [['venues/villa-barvikha/p21.webp', 1.5], ['venues/river-loft/gal/g13.webp', 1.3], ['venues/forest-dew/s4-evening.webp', 1.5], ['venues/led/gal/g16.webp', 1.4]],
];

const HEART = 'M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z';
const Heart: React.FC<{ size: number; fill: number; color?: string; stroke?: number }> = ({ size, fill, color = '#fff', stroke = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d={HEART} fill={fill > 0 ? color : 'rgba(0,0,0,0.35)'} fillOpacity={fill > 0 ? fill : 1} stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
  </svg>
);

type Rect = { x: number; y: number; w: number; h: number };
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { W, H, wide } = L;
  const th = useTheme([[388, 0], [398, 1], [478, 1], [488, 0], [598, 0], [608, 1], [716, 1], [726, 0]]);
  const ink = th.ink;

  // ——— область сцены: вертикаль — под фразой, горизонталь — справа от неё ———
  const area = wide ? { x: 1010, y: 0, w: 890, h: H } : { x: 0, y: 610, w: W, h: H - 610 };
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;

  // ——— 1. логотип ———
  const logoIn = prog(f, 2, 26);
  const logoOut = prog(f, 32, 50, easeInOut);

  // ——— 2. живой кадр → карточка ———
  const cardW = wide ? 560 : 760;
  const cardPhoto: Rect = { x: cx - cardW / 2, y: wide ? 96 : 640, w: cardW, h: cardW * (4 / 3) };
  const full: Rect = { x: 0, y: 0, w: W, h: H };
  const toCard = prog(f, 100, 140, easeInOut);
  const push = interpolate(f, [44, 140], [1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });

  // ——— 3. лента: плитки ———
  const gap = 16;
  const colW = (area.w - gap * 3) / 2;
  const tilesIn = (i: number) => prog(f, 158 + i * 4, 176 + i * 4);
  const scroll = kf(f, [[176, 0], [262, wide ? 420 : 640]]);
  const tiles: (Rect & { src: string; i: number })[] = [];
  COLS.forEach((col, c) => {
    let y = area.y + (wide ? 40 : 10) + (c === 1 ? 70 : 0);
    col.forEach(([src, r], k) => {
      const h = colW * r;
      tiles.push({ x: area.x + gap + c * (colW + gap), y, w: colW, h, src, i: c + k * 2 });
      y += h + gap;
    });
  });
  const led = tiles[0];
  const toTile = prog(f, 150, 178, easeInOut);
  // 4. наезд на плитку LЁD: камера ленты
  const zoom = prog(f, 268, 300, easeInOut) * (1 - prog(f, 382, 392, easeInOut));
  const zs = 1 + zoom * ((cardW * 0.9) / led.w - 1);
  const ledCY = led.y - scroll + led.h / 2;
  const tz = { x: (cx - (led.x + led.w / 2)) * zoom, y: (cy - 40 - ledCY) * zoom };
  const gridT = `translate(${tz.x}px, ${tz.y}px) translate(${led.x + led.w / 2}px, ${ledCY}px) scale(${zs}) translate(${-(led.x + led.w / 2)}px, ${-ledCY}px)`;

  // карточка/плитка LЁD, пока она «одна»
  const heroRect = f < 140 ? lerpRect(full, cardPhoto, toCard) : lerpRect(cardPhoto, { ...led }, toTile);
  const heroRadius = f < 140 ? 32 * toCard : 32 + (24 - 32) * toTile;
  const caption = prog(f, 126, 146) * (1 - prog(f, 150, 160));

  const saved = prog(f, 318, 326);
  const toast = prog(f, 326, 342) * (1 - prog(f, 378, 390));

  // ——— 5. кабинет: интерес пар ———
  const stat = prog(f, 398, 416) * (1 - prog(f, 470, 480));

  // ——— 6. заявка: кнопка и поля ———
  const bookIn = prog(f, 488, 502);
  const bookGone = prog(f, 510, 522, easeInOut);
  const fieldIn = (i: number) => prog(f, 514 + i * 5, 530 + i * 5);
  const fieldsOut = prog(f, 590, 602, easeInOut);

  // ——— 7. уведомление → заявка ———
  const pushIn = prog(f, 610, 626);
  const pushUp = prog(f, 652, 668, easeInOut);
  const leadIn = prog(f, 656, 674) * (1 - prog(f, 708, 718));

  // ——— 8. финал ———
  const endIn = prog(f, 800, 824);

  const fieldW = wide ? 760 : 900;
  const fx = cx - fieldW / 2;
  const fy = wide ? 210 : 760;
  const fieldBg = '#ece2d4';
  const pill: React.CSSProperties = { height: 112, borderRadius: 999, display: 'flex', alignItems: 'center', padding: '0 48px', fontSize: 44, fontFamily: BRAND.sans, fontWeight: 500, color: BRAND.chocolate, boxSizing: 'border-box' };
  const fieldRow = (i: number, child: React.ReactNode, y: number) => {
    const t = fieldIn(i);
    return (
      <div key={i} style={{ position: 'absolute', left: fx, top: y - fieldsOut * 160, width: fieldW, opacity: t * (1 - fieldsOut), transform: `translateX(${(1 - t) * 140}px)` }}>{child}</div>
    );
  };

  return (
    <AbsoluteFill style={{ background: th.bg, overflow: 'hidden' }}>
      {/* 1 */}
      {f < 52 && (
        <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: logoIn * (1 - logoOut), transform: `scale(${(0.9 + 0.1 * logoIn) * (1 + 6 * logoOut)})` }} />
        </AbsoluteFill>
      )}

      {/* 3–4: лента (плитки, кроме LЁD) */}
      {f >= 150 && f < 394 && (
        <div style={{ position: 'absolute', left: area.x, top: area.y, width: area.w, height: area.h, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -area.x, top: -area.y, width: W, height: H, transform: gridT, transformOrigin: '0 0' }}>
            {tiles.slice(1).map((t) => {
              const a = tilesIn(t.i);
              return (
                <div key={t.src} style={{ position: 'absolute', left: t.x, top: t.y - scroll, width: t.w, height: t.h, borderRadius: 24, overflow: 'hidden', opacity: a * (1 - zoom * 0.0), transform: `translateY(${(1 - a) * 80}px)` }}>
                  <Img src={S(t.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              );
            })}
            {f >= 178 && (
              <div style={{ position: 'absolute', left: led.x, top: led.y - scroll, width: led.w, height: led.h, borderRadius: 24, overflow: 'hidden' }}>
                <Img src={S(HERO)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* сердце .save на кадре — правый верхний угол, как на сайте */}
                <div style={{ position: 'absolute', right: 14, top: 14, transform: `scale(${1 + 1.2 * kf(f, [[318, 0], [324, 1], [336, 0]])})`, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}>
                  <Heart size={52} fill={saved} />
                </div>
                <div style={{ position: 'absolute', right: 14 + 26, top: 14 + 26 }}><Tap x={0} y={0} at={318} /></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2: живой кадр, сжимается в карточку и встаёт плиткой в ленту */}
      {f >= 40 && f < 178 && (
        <>
          <div style={{ position: 'absolute', left: heroRect.x, top: f < 140 ? heroRect.y : heroRect.y - 0, width: heroRect.w, height: heroRect.h, borderRadius: heroRadius, overflow: 'hidden', opacity: prog(f, 40, 52) }}>
            <Img src={S(HERO)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push})` }} />
          </div>
          <div style={{ position: 'absolute', left: cardPhoto.x, top: cardPhoto.y + cardPhoto.h + 28, width: cardW, opacity: caption, transform: `translateY(${(1 - caption) * 24}px)`, color: ink }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: BRAND.serif, fontSize: wide ? 64 : 84, lineHeight: 1, fontWeight: 500 }}>LЁD</div>
              <div style={{ fontFamily: BRAND.sans, fontSize: wide ? 28 : 34, fontWeight: 500 }}>★ 4,5 · 16 отзывов</div>
            </div>
            <div style={{ fontFamily: BRAND.sans, fontSize: wide ? 28 : 34, marginTop: 12 }}>Оранжерея · Новая Рига</div>
          </div>
        </>
      )}

      {/* 4: плашка «Добавлено в избранное» (lib/fav-toast.ts) */}
      {toast > 0 && (
        <div style={{ position: 'absolute', left: cx, top: wide ? 950 : 1780, transform: `translate(-50%, ${(1 - toast) * 60}px)`, opacity: toast,
          display: 'flex', alignItems: 'center', gap: 22, height: 104, padding: '0 40px', borderRadius: 999, background: BRAND.chocolate, color: BRAND.cream, fontFamily: BRAND.sans, fontSize: 38, fontWeight: 500, whiteSpace: 'nowrap' }}>
          <Heart size={40} fill={1} color={BRAND.cream} />Добавлено в избранное<span style={{ opacity: 1, textDecoration: 'underline', textUnderlineOffset: 8 }}>Открыть</span>
        </div>
      )}

      {/* 5: кабинет — интерес пар к карточке */}
      {stat > 0 && (
        <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${(wide ? 2.1 : 2.7) * (0.92 + 0.08 * stat)})`, opacity: stat }}>
          <div style={{ fontFamily: CAB.font, color: CAB.text, width: 340, background: CAB.card, borderRadius: CAB.sheetRadius, padding: 18, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Img src={S(HERO)} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 600 }}>LЁD</div><div style={{ fontSize: 13 }}>Площадка</div></div>
              <Chip kind="ok">На сайте</Chip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, background: CAB.bg, transform: `scale(${1 + 0.05 * kf(f, [[430, 0], [436, 1], [446, 0]])})` }}>
              <svg width={22} height={22} viewBox="0 0 24 24"><path d={HEART} fill={CAB.ink} /></svg>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Карточку сохранили в избранное</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: CAB.okText, opacity: prog(f, 432, 440), transform: `translateY(${(1 - prog(f, 432, 440)) * 8}px)` }}>+1</span>
            </div>
            <div style={{ fontSize: 12 }}>только что</div>
          </div>
        </div>
      )}

      {/* 6: «Забронировать» → поля заявки → «Отправить» */}
      {f >= 486 && f < 512 && (
        <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${(0.9 + 0.1 * bookIn) * press(f, 505) * (1 - 0.1 * bookGone)})`, opacity: bookIn * (1 - bookGone) }}>
          <div style={{ ...pill, height: 150, padding: '0 90px', fontSize: 62, border: `3px solid ${BRAND.chocolate}` }}>Забронировать</div>
          <Tap x={0} y={0} at={505} />
        </div>
      )}
      {f >= 512 && f < 604 && (
        <>
          {fieldRow(0, <div style={{ ...pill, background: fieldBg }}>{typed('Мария', f, 520, 534) || ' '}</div>, fy)}
          {fieldRow(1, <div style={{ ...pill, background: fieldBg }}>{typed('+7 916 204-18-36', f, 528, 546) || ' '}</div>, fy + 136)}
          {fieldRow(2, (
            <div style={{ display: 'flex', gap: 16 }}>
              {['Telegram', 'WhatsApp', 'Звонок'].map((w, i) => (
                <div key={w} style={{ ...pill, padding: '0 40px', background: i === 0 ? BRAND.chocolate : fieldBg, color: i === 0 ? BRAND.cream : BRAND.chocolate }}>{w}</div>
              ))}
            </div>
          ), fy + 272)}
          {fieldRow(3, <div style={{ ...pill, background: fieldBg }}>14 июня 2027</div>, fy + 408)}
          {fieldRow(4, (
            <div style={{ position: 'relative' }}>
              <div style={{ ...pill, justifyContent: 'center', background: BRAND.chocolate, color: BRAND.cream, transform: `scale(${press(f, 584)})` }}>Отправить</div>
              <Tap x={fieldW / 2} y={56} at={584} />
            </div>
          ), fy + 580)}
        </>
      )}

      {/* 7: уведомление → заявка в кабинете */}
      {f >= 608 && f < 720 && (
        <>
          <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, ${-50 - (1 - pushIn) * 120 - pushUp * 130}%) scale(${wide ? 2 : 2.5})`, opacity: pushIn * (1 - prog(f, 700, 714)) }}>
            <Push />
          </div>
          {leadIn > 0 && (
            <div style={{ position: 'absolute', left: cx, top: cy + (wide ? 130 : 200), transform: `translate(-50%, -50%) scale(${(wide ? 1.9 : 2.4) * (0.94 + 0.06 * leadIn)})`, opacity: leadIn }}>
              <div style={{ position: 'relative' }}>
                <LeadCard callScale={press(f, 694)} />
                <Tap x={18 + 86} y={18 + 52 + 14 + 24} at={694} />
              </div>
            </div>
          )}
        </>
      )}

      {/* фразы */}
      <Words text="Из живой площадки — карточка" from={136} to={186} ink={ink} size={wide ? 100 : 104} />
      <Words text="Пары выбирают глазами" from={190} to={266} ink={ink} />
      <Words text="И сохраняют в избранное" from={274} to={386} ink={ink} />
      <Words text="Вы видите интерес пар" from={398} to={478} ink={ink} />
      <Words text="Пара оставляет заявку" from={490} to={598} ink={ink} />
      <Words text="Новая заявка — в вашем кабинете" from={612} to={716} ink={ink} />
      <Words text="Ваша площадка — следующая" from={728} to={798} ink={ink} size={wide ? 150 : 150} centered />

      {/* 8: финал */}
      {f >= 798 && (
        <AbsoluteFill style={{ display: 'grid', placeContent: 'center', justifyItems: 'center', gap: wide ? 56 : 72, color: ink, fontFamily: BRAND.sans }}>
          <Logo src={S('logo-unicase.svg')} width={760} color={ink} style={{ opacity: endIn, transform: `scale(${0.94 + 0.06 * endIn})` }} />
          <div style={{ opacity: prog(f, 816, 838), transform: `translateY(${(1 - prog(f, 816, 838)) * 30}px)`, display: 'grid', justifyItems: 'center', gap: 28 }}>
            <div style={{ height: 104, padding: '0 56px', borderRadius: 999, border: `2px solid ${ink}`, display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 500 }}>Разместиться бесплатно</div>
            <div style={{ fontSize: 36, fontWeight: 500 }}>wed-secrets.ru/profi</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
