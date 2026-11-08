// ПРОМО ДЛЯ ПОДРЯДЧИКОВ (бриф Никиты 08.11.2026): ~46 с, вертикаль и горизонталь.
// Круг: логотип → сайт глазами пары (лента, площадка, заявка) → кабинет подрядчика
// (заявка пришла, перезвонил, завёл карточку: фото с Яндекс Диска, описание, обложка,
// «Отправить на проверку») → карточка уже на сайте → логотип и призыв.
// Не скринкаст: камера наезжает на нужное, элементы вырываются из экрана крупно.
// Фон — бумага, в кабинете переключается на тёмный. Фразы — Onest, крупно.
// Тексты фраз — с промо-страницы /profi/ и экранов кабинета, цифр не выдумываем.
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import R from '../public/ui/rects.json';
import { BRAND } from './brand';
import {
  ADD_RECT, AddDisk, BottomBar, Btn, CabScreen, Chip, EditorHead, FieldCard, LEAD_RECT, LeadCard, LeadsScreen,
  PILL_RECT, PUSH_RECT, PhotoGrid, ProgressPill, Push, SUBMIT_RECT, Tile, TileState, YdDialog, tileRect,
} from './promo/cabinet';
import { easeInOut, kf, press, prog, typed } from './promo/motion';
import { CAM0, Cam, Fill, Logo, Phone, Pull, SCREEN_H, SCREEN_W, Tap, Words, useLayout, useTheme } from './promo/stage';
import { CAB } from './brand';

export const DURATION = 1380; // 46 с при 30 к/с

const S = (p: string) => staticFile(p);
const LED = ['g15', 'g16', 'g18', 'g14', 'g2', 'g9', 'g7', 'g8', 'g10'].map((g) => `venues/led/gal/${g}.webp`);
const LED_TEXT = 'Стеклянная оранжерея в сосновом лесу на Новой Риге: зал на 60 гостей, отдельная веранда и своя территория в тридцати минутах от центра Москвы.';
const DISK_URL = 'disk.yandex.ru/d/led-svadby';

// лента: докуда долистать, чтобы плитка Villa Barvikha встала в середину экрана
const tileCY = R.feedTile.y + R.feedTile.h / 2;
const FEED_END = tileCY - SCREEN_H / 2;
const tile = { x: R.feedTile.x, y: R.feedTile.y - FEED_END, w: R.feedTile.w, h: R.feedTile.h };
const book = { x: R.bookBtn.x + R.bookBtn.w / 2, y: R.bookBtn.y + R.bookBtn.h / 2 };
const send = { x: R.sendBtn.x + R.sendBtn.w / 2, y: R.sendBtn.y + R.sendBtn.h / 2 };

/** слой экрана, въезжающий сбоку (переход между экранами кабинета) */
const Slide: React.FC<{ f: number; at: number; from?: 1 | -1; children: React.ReactNode; z?: number }> = ({ f, at, from = 1, children, z = 1 }) => {
  if (f < at) return null;
  const t = prog(f, at, at + 14, easeInOut);
  return <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - t) * 100 * from}%)`, zIndex: z }}>{children}</div>;
};

const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const Promo: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  const th = useTheme([[425, 0], [455, 1], [1166, 1], [1196, 0]]);
  const ps = (v: number, w: number) => (L.wide ? w : v); // масштаб «вырванного» элемента под формат

  // ——— камера ———
  const cam: Cam = {
    ...CAM0,
    z: kf(f, [[300, 1], [328, 1.9], [362, 1.9], [382, 1.12], [402, 1.12], [418, 1.7], [430, 1.7], [452, 1], [962, 1], [986, 1.35], [1044, 1.35], [1062, 1], [1180, 1], [1270, 1.07]]),
    fx: kf(f, [[300, 195], [328, book.x], [362, book.x], [382, 195], [418, send.x], [452, 195]]),
    fy: kf(f, [[300, 422], [328, book.y], [362, book.y], [382, 470], [402, 470], [418, send.y], [430, send.y], [452, 422], [962, 422], [986, 250], [1044, 250], [1062, 422]]),
    dy: kf(f, [[90, 1500], [136, 0], [430, 0], [452, 1500], [454, 1500], [482, 0], [1272, 0], [1302, 1700]]),
    dx: 0,
  };

  // ——— экран телефона ———
  const scroll = kf(f, [[124, 0], [184, 2300], [198, 2420], [282, FEED_END]]);
  const open = prog(f, 294, 322, easeInOut); // площадка раскрывается из плитки
  const sheet = prog(f, 360, 386, easeInOut);
  const pushIn = prog(f, 486, 498);
  const pushOut = prog(f, 566, 574);
  const ydUp = prog(f, 762, 778, easeInOut) - prog(f, 940, 956, easeInOut);
  const picks = Math.max(0, Math.min(9, Math.floor((f - 813) / 3)));
  const pct = kf(f, [[860, 0], [922, 100]]);
  const tilesIn = (i: number) => prog(f, 636 + i * 3, 650 + i * 3);
  const allDone = f >= 1096;

  const tiles: TileState[] = [
    { key: 'main', title: 'Основное', ic: 'user', sub: f >= 668 ? 'LЁD, Новая Рига' : 'пусто', done: f >= 668 },
    { key: 'photo', title: 'Фото', ic: 'photo', sub: allDone ? '9 фото' : 'пусто', done: allDone },
    { key: 'video', title: 'Видео', ic: 'video', sub: 'по желанию', optional: true },
    { key: 'halls', title: 'Залы', ic: 'halls', sub: allDone ? '1 зал, до 60 гостей' : 'пусто', done: allDone },
    { key: 'terms', title: 'Условия', ic: 'chat', sub: allDone ? 'Кухня, алкоголь' : 'пусто', done: allDone },
    { key: 'desc', title: 'Описание', ic: 'doc', sub: allDone ? 'заполнено' : 'пусто', done: allDone },
    { key: 'ask', title: 'Вопросы', ic: 'ask', sub: allDone ? '4 ответа' : 'пусто', done: allDone },
    { key: 'cont', title: 'Контакты', ic: 'phone', sub: allDone ? 'телефон' : 'пусто', done: allDone },
  ];

  const submit = (
    <div style={{ width: SUBMIT_RECT.w, height: SUBMIT_RECT.h, position: 'relative', display: 'grid', placeItems: 'center' }}>
      {f < 1134 ? (
        <Btn dark h={SUBMIT_RECT.h} style={{ width: '100%', transform: `scale(${press(f, 1130)})`, fontFamily: CAB.font }}>Отправить на проверку</Btn>
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: 999, background: CAB.card, display: 'grid', placeItems: 'center' }}>
          {f < 1152 ? <Chip kind="info" style={{ fontFamily: CAB.font, transform: `scale(${0.8 + 0.2 * prog(f, 1134, 1144)})` }}>На проверке</Chip>
            : <Chip kind="ok" style={{ fontFamily: CAB.font, transform: `scale(${0.8 + 0.2 * prog(f, 1152, 1162)})` }}>На сайте</Chip>}
        </div>
      )}
      <Tap x={SUBMIT_RECT.w / 2} y={SUBMIT_RECT.h / 2} at={1130} />
    </div>
  );

  const editor = (
    <CabScreen>
      <EditorHead title="LЁD" />
      {tiles.map((t, i) => {
        const r = tileRect(i);
        const a = allDone ? 1 : tilesIn(i);
        return <div key={t.key} style={{ position: 'absolute', left: r.x, top: r.y, opacity: a, transform: `translateY(${(1 - a) * 24}px) scale(${i === 1 ? press(f, 688) : 1})` }}><Tile t={t} /></div>;
      })}
      <div style={{ position: 'absolute', left: SUBMIT_RECT.x, top: SUBMIT_RECT.y, opacity: allDone ? 1 : 0.4 }}>{submit}</div>
      {!allDone && <Tap {...center(tileRect(1))} at={688} />}
    </CabScreen>
  );

  const photos = (cover: boolean) => (
    <CabScreen>
      <EditorHead title="Фото" back="LЁD" />
      <div style={{ position: 'absolute', left: ADD_RECT.x, top: ADD_RECT.y }}><AddDisk /></div>
      <div style={{ position: 'absolute', left: 20, top: 216, width: 340, fontSize: 14, lineHeight: '19px' }}>Много фото — удобнее ссылкой на папку: выберите кадры, мы заберём оригиналы</div>
      <PhotoGrid photos={LED} top={276} visible={cover ? 9 : Math.max(0, Math.floor((f - 944) / 1.5))} cover={1} coverT={cover ? prog(f, 1074, 1084) : 0} />
      {cover && <Tap x={4 + 124 + 5 + 62} y={276 + 62} at={1072} />}
    </CabScreen>
  );

  const screen = (
    <>
      {/* сайт: лента → площадка → шторка заявки (снимки настоящего сайта) */}
      {f < 300 && (
        <div style={{ position: 'absolute', inset: 0, background: BRAND.cream }}>
          <Img src={S('ui/feed.jpg')} style={{ position: 'absolute', left: 0, top: -scroll, width: SCREEN_W }} />
          <div style={{ position: 'absolute', left: tile.x, top: tile.y, width: tile.w, height: tile.h, borderRadius: 16, boxShadow: `0 0 0 ${3 * prog(f, 284, 290)}px ${BRAND.chocolate}`, opacity: 1 - prog(f, 296, 300) }} />
          <Tap x={tile.x + tile.w / 2} y={tile.y + tile.h / 2} at={290} />
        </div>
      )}
      {f >= 292 && f < 452 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Img src={S('ui/venue-villa-barvikha.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H,
            clipPath: `inset(${tile.y * (1 - open)}px ${(SCREEN_W - tile.x - tile.w) * (1 - open)}px ${(SCREEN_H - tile.y - tile.h) * (1 - open)}px ${tile.x * (1 - open)}px round ${16 * (1 - open)}px)` }} />
          <Tap x={book.x} y={book.y} at={352} />
          {sheet > 0 && <Img src={S('ui/booking.png')} style={{ position: 'absolute', inset: 0, width: SCREEN_W, height: SCREEN_H, clipPath: 'inset(64px 0 0 0)', transform: `translateY(${(1 - sheet) * 790}px)` }} />}
          <Tap x={send.x} y={send.y} at={422} />
        </div>
      )}
      {/* кабинет подрядчика */}
      {f >= 452 && f < 650 && <LeadsScreen />}
      {f >= 486 && f < 574 && <div style={{ position: 'absolute', left: PUSH_RECT.x, top: PUSH_RECT.y, transform: `translateY(${(pushIn - 1) * 160}px)`, opacity: 1 - pushOut, zIndex: 5 }}><Push /></div>}
      {f >= 628 && f < 712 && <Slide f={f} at={628}>{editor}</Slide>}
      {f >= 690 && f < 972 && (
        <Slide f={f} at={690}>
          {photos(false)}
          {ydUp > 0 && (
            <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - ydUp) * 800}px)` }}>
              <YdDialog
                url={typed(DISK_URL, f, 782, 804)}
                bar={f >= 813 && (
                  <div style={{ position: 'absolute', left: 4, right: 4, top: PILL_RECT.y - 70 }}>
                    {f < 852 ? <Btn dark h={52} style={{ transform: `scale(${press(f, 850)})` }}>Добавить {picks} фото</Btn> : <div style={{ marginLeft: 12 }}><ProgressPill pct={pct} /></div>}
                    <Tap x={191} y={26} at={850} />
                  </div>
                )}
              >
                <PhotoGrid photos={LED} top={206} cell={120} visible={Math.max(0, Math.floor((f - 806) / 1.2))} pickedAt={(i) => (i < picks ? i + 1 : null)} />
              </YdDialog>
            </div>
          )}
        </Slide>
      )}
      {f >= 956 && f < 1064 && (
        <Slide f={f} at={956} z={2}>
          <CabScreen>
            <EditorHead title="Описание" back="LЁD" />
            <FieldCard label="О площадке" h={300} style={{ position: 'absolute', left: 4, top: 104, width: 382 }}>
              <div style={{ fontSize: 17, lineHeight: '25px', color: f < 978 ? CAB.placeholder : CAB.text }}>
                {f < 978 ? 'Что за место, чем запоминается, кому подойдёт' : typed(LED_TEXT, f, 978, 1040)}
                {f >= 978 && Math.floor(f / 8) % 2 === 0 && <span style={{ display: 'inline-block', width: 2, height: 21, background: CAB.ink, marginLeft: 1, verticalAlign: -4 }} />}
              </div>
            </FieldCard>
          </CabScreen>
        </Slide>
      )}
      {f >= 1050 && f < 1110 && <Slide f={f} at={1050} from={-1} z={3}>{photos(true)}</Slide>}
      {f >= 1096 && f < 1200 && <Slide f={f} at={1096} from={-1} z={4}>{editor}</Slide>}
      {/* снова сайт: карточка LЁD уже в каталоге */}
      {f >= 1176 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 6, transform: `translateY(${(1 - prog(f, 1176, 1198, easeInOut)) * 100}%)` }}>
          <Img src={S('ui/venue-led.png')} style={{ width: SCREEN_W, height: SCREEN_H }} />
        </div>
      )}
    </>
  );

  // ——— «вырванные» элементы ———
  const tPush = kf(f, [[500, 0], [518, 1], [548, 1], [566, 0]]);
  const tLead = kf(f, [[574, 0], [592, 1], [614, 1], [630, 0]]);
  const tAdd = kf(f, [[712, 0], [730, 1], [754, 1], [768, 0]]);
  const tPill = kf(f, [[856, 0], [872, 1], [926, 1], [942, 0]]);
  const tSubmit = kf(f, [[1110, 0], [1126, 1], [1160, 1], [1176, 0]]);

  // ——— логотип: в начале и в конце ———
  const logoIn = prog(f, 4, 34);
  const logoOut = prog(f, 64, 98, easeInOut);
  const endIn = prog(f, 1292, 1318);
  const logoW = L.wide ? 760 : 760;

  return (
    <Fill bg={th.bg}>
      {f < 100 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <Logo src={S('logo-unicase.svg')} width={logoW} color={th.ink} style={{ opacity: logoIn * (1 - logoOut), transform: `scale(${(0.9 + 0.1 * logoIn) * (1 + 7 * logoOut)})` }} />
        </div>
      )}

      <Words text="Свадебный каталог Москвы и области" from={100} to={182} ink={th.ink} />
      <Words text="Пары выбирают глазами" from={186} to={292} ink={th.ink} />
      <Words text="Новая заявка — сразу в кабинете" from={458} to={556} ink={th.ink} />
      <Words text="Остаётся перезвонить" from={572} to={628} ink={th.ink} />
      <Words text="Заведите карточку" sub="Всё сохраняется само" from={636} to={702} ink={th.ink} />
      <Words text="Фото — ссылкой на Яндекс Диск" from={708} to={800} ink={th.ink} />
      <Words text="Сервер заберёт оригиналы сам" from={852} to={942} ink={th.ink} />
      <Words text="Расскажите о площадке" from={962} to={1046} ink={th.ink} />
      <Words text="Выберите обложку" from={1054} to={1102} ink={th.ink} />
      <Words text="Проверим за сутки" from={1108} to={1172} ink={th.ink} />
      <Words text="Ваша карточка — на сайте" sub="В каталоге, Яндексе и Google" from={1188} to={1272} ink={th.ink} />

      {f >= 90 && f < 1310 && <Phone cam={cam}>{screen}</Phone>}

      <Pull cam={cam} rect={PUSH_RECT} t={tPush} scale={ps(2.5, 2.0)} radius={26}><Push /></Pull>
      <Pull cam={cam} rect={LEAD_RECT} t={tLead} scale={ps(2.5, 1.9)} radius={CAB.sheetRadius}>
        <LeadCard callScale={press(f, 604)} />
        <Tap x={18 + 86} y={18 + 52 + 14 + 24} at={604} />
      </Pull>
      <Pull cam={cam} rect={ADD_RECT} t={tAdd} scale={ps(3, 2.3)} radius={999}>
        <div style={{ transform: `scale(${press(f, 748)})` }}><AddDisk /></div>
        <Tap x={28} y={24} at={748} />
      </Pull>
      <Pull cam={cam} rect={PILL_RECT} t={tPill} scale={ps(2.6, 2.0)} radius={22}><ProgressPill pct={pct} /></Pull>
      <Pull cam={cam} rect={SUBMIT_RECT} t={tSubmit} scale={ps(2.4, 1.8)} radius={999}>{submit}</Pull>

      {f >= 1288 && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: L.wide ? 56 : 72, color: th.ink, fontFamily: BRAND.sans }}>
          <Logo src={S('logo-unicase.svg')} width={logoW} color={th.ink} style={{ opacity: endIn, transform: `scale(${0.94 + 0.06 * endIn})` }} />
          <div style={{ opacity: prog(f, 1308, 1330), transform: `translateY(${(1 - prog(f, 1308, 1330)) * 30}px)`, display: 'grid', justifyItems: 'center', gap: 28 }}>
            <div style={{ height: 104, padding: '0 56px', borderRadius: 999, border: `2px solid ${th.ink}`, display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 500, letterSpacing: '-0.01em' }}>Разместиться бесплатно</div>
            <div style={{ fontSize: 36, fontWeight: 500 }}>wed-secrets.ru/profi</div>
          </div>
        </div>
      )}
    </Fill>
  );
};
