export const meta = {
  name: 'venue-pages',
  description: 'Три площадки из гугл-таблицы: исследование сайта (Haiku) → факты (Haiku) → концепция и venue.json (Sonnet) → проверка скриптом и Haiku → правки',
  phases: [
    { title: 'Исследование', detail: 'Firecrawl по сайту и картам, сырьё в research/<slug>/site', model: 'haiku' },
    { title: 'Материалы', detail: 'фото с сайта, пережатие, манифест', model: 'haiku' },
    { title: 'Факты', detail: 'facts.json по схеме, неизвестно = null', model: 'haiku' },
    { title: 'Концепция и текст', detail: 'concept.md + src/data/venues/<slug>.json блоками', model: 'sonnet' },
    { title: 'Проверка', detail: 'verify-venue.mjs + сверка утверждений с фактами', model: 'haiku' },
    { title: 'Правки', detail: 'исправление по отчёту проверки', model: 'sonnet' },
  ],
}

const SKILL = '.claude/skills/venue-page/SKILL.md'
const venues = args

const RESEARCH_SCHEMA = { type: 'object', properties: { pages: { type: 'array', items: { type: 'string' } }, mapsOk: { type: 'boolean' }, imageUrls: { type: 'number' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['pages', 'mapsOk', 'imageUrls', 'problems'] }
const MATERIALS_SCHEMA = { type: 'object', properties: { photos: { type: 'number' }, portrait: { type: 'number' }, landscape: { type: 'number' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['photos', 'problems'] }
const FACTS_SCHEMA = { type: 'object', properties: { written: { type: 'boolean' }, gaps: { type: 'array', items: { type: 'string' } }, uniqueClaims: { type: 'array', items: { type: 'string' } } }, required: ['written', 'gaps', 'uniqueClaims'] }
const WRITE_SCHEMA = { type: 'object', properties: { written: { type: 'boolean' }, blockOrder: { type: 'array', items: { type: 'string' } }, concept: { type: 'string' } }, required: ['written', 'blockOrder', 'concept'] }
const VERIFY_SCHEMA = { type: 'object', properties: { scriptOk: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['scriptOk', 'errors'] }

const researchPrompt = (v) => `Ты — исследователь конвейера venue-page. Сначала прочитай ${SKILL} (раздел «Фаза 1»). Площадка: «${v.name}», slug ${v.slug}. Сайт: ${v.site}. Яндекс.Карты: ${v.maps}.
Загрузи инструменты через ToolSearch: "select:mcp__firecrawl__firecrawl_map,mcp__firecrawl__firecrawl_scrape".
1) firecrawl_map по сайту (limit 60). Выбери страницы про зал/залы, территорию, кухню и меню, цены и условия, контакты, вопросы, «о нас». ${v.siteHint ?? ''}
2) Каждую выбранную страницу (не больше 12) — firecrawl_scrape formats ["markdown"], onlyMainContent true → сохрани Write в research/${v.slug}/site/<короткое-имя>.md как есть, первой строкой URL. Пересказывать нельзя.
3) Ссылку карт — firecrawl_scrape formats ["markdown","links"], waitFor 3000 → research/${v.slug}/site/maps.md (адрес, рейтинг, число оценок/отзывов, часы, телефон, отзывы с текстом). Если карты не открылись — файл с одной строкой «карты не отдали данные».
${v.needSiteImages ? `4) Фото площадки берём с сайта: собери ссылки на большие фотографии (галереи, слайдеры; formats ["links","html"] на страницах с фото; отбрось иконки, логотипы, превью до 400px, чужие площадки). Запиши в research/${v.slug}/image-urls.txt по одной ссылке в строке (абсолютные URL). Цель — 25–60 ссылок.` : '4) Фото уже скачаны, ссылки на картинки не собирай.'}
Ничего не выдумывай и ничего не пиши в src/. Верни: список сохранённых файлов, открылись ли карты, сколько ссылок на фото, проблемы.`

const materialsPrompt = (v) => `Конвейер venue-page, фаза 0 для площадки ${v.slug}. Прочитай ${SKILL} (раздел «Фаза 0»).
${v.needSiteImages
  ? `Выполни: node scripts/fetch-urls.mjs research/${v.slug}/image-urls.txt research/${v.slug}/raw-site — затем node scripts/prep-photos.mjs ${v.slug}. Если fetch-urls скачал меньше 10 файлов, скажи об этом в problems.`
  : `Фото уже пережаты: research/${v.slug}/photos.json существует (если его нет — подожди, Bash "sleep 30", до 20 раз). Ничего не запускай.`}
Прочитай research/${v.slug}/photos.json и верни число кадров, сколько portrait/landscape, проблемы (битые файлы, мало кадров).`

const factsPrompt = (v) => `Конвейер venue-page, фаза 2 (факты) для площадки «${v.name}», slug ${v.slug}. Прочитай ${SKILL} (раздел «Фаза 2» и схему facts.json). Прочитай ВСЕ файлы research/${v.slug}/site/*.md и research/${v.slug}/notes.md.
Составь research/${v.slug}/facts.json строго по схеме из скилла. Каждый факт с полем source (имя файла). Неизвестно — null, выдумывать запрещено. В uniqueClaims — 5–8 вещей, которые площадка сама называет своим главным, цитатами. В gaps — чего в источниках нет (цены, вместимость, адрес…). Отзывы: если maps.md содержит отзывы с текстом — 3–6 в reviews.items {author, date, rating, text}, тексты дословно.
Верни: written, gaps, uniqueClaims.`

const writePrompt = (v, facts) => `Ты пишешь карточку площадки для WED Secrets — конвейер venue-page, фаза 3. Прочитай ЦЕЛИКОМ ${SKILL} и следуй ему буквально. Площадка «${v.name}», slug ${v.slug}.
Прочитай: research/${v.slug}/facts.json, research/${v.slug}/photos.json, research/${v.slug}/notes.md, и как образец ТОНА (не структуры) объект riverLoft в src/data/venues.ts (строки 116–454) и тип Venue/VenueBlock там же (строки 1–160).
Если research/${v.slug}/photos.json ещё нет — подожди: Bash "sleep 60" и проверка, до 20 раз.
Рейтинг и число отзывов бери из src/data/reviews/${v.slug}.json (поля rating, ratings, total — это данные Яндекс.Карт), а не из facts.json; в stats можно поставить «рейтинг · N отзывов» только оттуда. Блок reviews в blocks ставь обязательно.
Ключевые утверждения площадки из фактов: ${JSON.stringify(facts?.uniqueClaims ?? [])}. Пробелы в данных: ${JSON.stringify(facts?.gaps ?? [])}.
Шаги:
1) research/${v.slug}/concept.md — 3–5 ключевых идей ИМЕННО этой площадки, порядок блоков и почему он такой, какой кадр (pNN из photos.json, с учётом orientation) под какую сцену. Порядок блоков НЕ копировать с River Loft/Лесной Росы: у ресторана с депозитом первым может идти statement про формат работы, у зала на 200 гостей — stats и сцена зала, у площадки без прайса — terms в конце с «Как забронировать».
2) src/data/venues/${v.slug}.json — объект типа Venue с полем blocks. Все обязательные плоские поля из скилла. Пути фото только /venues/${v.slug}/pNN.webp. Цифры — только те, что есть в facts.json или notes.md; чего нет — не пишем. Неразрывный пробел после коротких предлогов/союзов (символ U+00A0). contacts.geo — из фактов; если координат нет, оставь geo пустым, а в конце ответа скажи об этом.
3) Запусти node scripts/verify-venue.mjs ${v.slug} и почини всё, что он показал, пока не напишет «ок».
Верни: written, blockOrder (типы блоков по порядку), concept (3 предложения).`

const verifyPrompt = (v) => `Проверка карточки площадки ${v.slug} (конвейер venue-page, фаза 4). 1) Запусти node scripts/verify-venue.mjs ${v.slug}, сохрани вывод. 2) Прочитай src/data/venues/${v.slug}.json и research/${v.slug}/facts.json + research/${v.slug}/notes.md. Найди УТВЕРЖДЕНИЯ (не только цифры), которых нет в фактах: оборудование, услуги, правила, «своя кухня», «работа под закрытие», названия шоссе, что входит в аренду. Найди повторы одного и того же кадра в двух сценах, кадры landscape в сценах split или в hero, штампы («уникальная атмосфера», «незабываемый»), жирность, капс. 3) Верни scriptOk (скрипт написал «ок») и список errors — каждая ошибка одной строкой с указанием поля JSON. Пустой список, если всё чисто. Ничего не правь.`

const fixPrompt = (v, errors) => `Конвейер venue-page, правки карточки ${v.slug}. Прочитай ${SKILL}. Исправь в src/data/venues/${v.slug}.json ровно эти замечания, не переписывая остальное:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}
Правило: утверждение, которого нет в research/${v.slug}/facts.json или notes.md, — удалить, а не «смягчить». Потом запусти node scripts/verify-venue.mjs ${v.slug} и добейся «ок». Верни written, blockOrder, concept="правки".`

const results = await pipeline(
  venues,
  (v) => agent(researchPrompt(v), { label: `research:${v.slug}`, phase: 'Исследование', model: 'haiku', schema: RESEARCH_SCHEMA }),
  (research, v) => agent(materialsPrompt(v), { label: `materials:${v.slug}`, phase: 'Материалы', model: 'haiku', schema: MATERIALS_SCHEMA }).then((m) => ({ research, materials: m })),
  (acc, v) => agent(factsPrompt(v), { label: `facts:${v.slug}`, phase: 'Факты', model: 'haiku', schema: FACTS_SCHEMA }).then((facts) => ({ ...acc, facts })),
  (acc, v) => agent(writePrompt(v, acc.facts), { label: `write:${v.slug}`, phase: 'Концепция и текст', model: 'sonnet', effort: 'high', schema: WRITE_SCHEMA }).then((w) => ({ ...acc, write: w })),
  async (acc, v) => {
    let verify = null
    for (let round = 0; round < 3; round++) {
      verify = await agent(verifyPrompt(v), { label: `verify:${v.slug}#${round + 1}`, phase: 'Проверка', model: 'haiku', schema: VERIFY_SCHEMA })
      if (!verify) break
      if (verify.scriptOk && verify.errors.length === 0) break
      log(`${v.slug}: ${verify.errors.length} замечаний, раунд правок ${round + 1}`)
      await agent(fixPrompt(v, verify.errors), { label: `fix:${v.slug}#${round + 1}`, phase: 'Правки', model: 'sonnet', schema: WRITE_SCHEMA })
    }
    return { slug: v.slug, ...acc, verify }
  },
)

return results.filter(Boolean).map((r) => ({
  slug: r.slug,
  pages: r.research?.pages?.length ?? 0,
  mapsOk: r.research?.mapsOk,
  photos: r.materials?.photos,
  gaps: r.facts?.gaps,
  blockOrder: r.write?.blockOrder,
  concept: r.write?.concept,
  verifyOk: r.verify ? r.verify.scriptOk && r.verify.errors.length === 0 : null,
  remaining: r.verify?.errors ?? [],
  problems: [...(r.research?.problems ?? []), ...(r.materials?.problems ?? [])],
}))
