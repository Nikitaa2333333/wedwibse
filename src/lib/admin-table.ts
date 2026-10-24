// Поведение таблиц админки (как в Директе), один раз на все экраны:
// - th[data-sort] — сортировка по колонке (число берётся из td[data-v]);
// - [data-filter-search="<id таблицы>"] — поиск по tr[data-text];
// - [data-filter-tab="<id>"][data-value] — вкладки-фильтры по tr[data-tab];
// - .a-check в строках + [data-bulk="<id>"] — выбор и тёмная панель действий;
// - tr[data-href] — вся строка ведёт на экран объекта.
// ПРОТОТИП: всё на клиенте; вживую сортировка и фильтры — запросом к базе.

export function bindAdminTables(): void {
  document.querySelectorAll<HTMLTableElement>('table[data-atable]').forEach((table) => {
    const id = table.id;
    const body = table.tBodies[0];
    const rows = () => [...body.rows].filter((r) => !r.classList.contains('a-total'));
    let query = '';
    let tab = 'all';

    const apply = () => {
      for (const r of rows()) {
        const okTab = tab === 'all' || (r.dataset.tab ?? '').split(' ').includes(tab);
        const okText = !query || (r.dataset.text ?? r.textContent ?? '').toLowerCase().includes(query);
        r.hidden = !(okTab && okText);
      }
      const empty = document.querySelector<HTMLElement>(`[data-empty="${id}"]`);
      if (empty) empty.hidden = rows().some((r) => !r.hidden);
    };

    document.querySelectorAll<HTMLInputElement>(`[data-filter-search="${id}"]`).forEach((inp) =>
      inp.addEventListener('input', () => { query = inp.value.trim().toLowerCase(); apply(); }),
    );
    const tabs = [...document.querySelectorAll<HTMLElement>(`[data-filter-tab="${id}"]`)];
    tabs.forEach((t) =>
      t.addEventListener('click', (e) => {
        e.preventDefault();
        tab = t.dataset.value ?? 'all';
        tabs.forEach((x) => x.classList.toggle('is-active', x === t));
        apply();
      }),
    );
    document.querySelectorAll<HTMLSelectElement>(`[data-filter-select="${id}"]`).forEach((sel) =>
      sel.addEventListener('change', () => { tab = sel.value || 'all'; apply(); }),
    );

    // сортировка
    table.querySelectorAll<HTMLElement>('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const idx = [...th.parentElement!.children].indexOf(th);
        const asc = th.classList.contains('is-sorted') ? !th.classList.contains('is-asc') : th.dataset.sort === 'asc';
        table.querySelectorAll('th').forEach((x) => x.classList.remove('is-sorted', 'is-asc'));
        th.classList.add('is-sorted');
        th.classList.toggle('is-asc', asc);
        const val = (r: HTMLTableRowElement) => {
          const td = r.cells[idx] as HTMLElement | undefined;
          const v = td?.dataset.v;
          if (v !== undefined && v !== '' && !Number.isNaN(Number(v))) return Number(v);
          return (v ?? td?.textContent ?? '').trim().toLowerCase();
        };
        const sorted = rows().sort((a, b) => {
          const x = val(a);
          const y = val(b);
          const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru');
          return asc ? c : -c;
        });
        sorted.forEach((r) => body.appendChild(r));
      });
    });

    // выбор строк и панель массовых действий
    const bulk = document.querySelector<HTMLElement>(`[data-bulk="${id}"]`);
    const all = table.querySelector<HTMLInputElement>('thead .a-check');
    const boxes = () => [...body.querySelectorAll<HTMLInputElement>('.a-check')];
    const sync = () => {
      const picked = boxes().filter((b) => b.checked);
      boxes().forEach((b) => b.closest('tr')?.classList.toggle('is-picked', b.checked));
      if (all) all.checked = picked.length > 0 && picked.length === boxes().length;
      if (!bulk) return;
      bulk.hidden = picked.length === 0;
      const n = bulk.querySelector('[data-bulk-n]');
      if (n) n.textContent = String(picked.length);
    };
    all?.addEventListener('change', () => { boxes().forEach((b) => (b.checked = all.checked)); sync(); });
    body.addEventListener('change', (e) => { if ((e.target as HTMLElement).classList.contains('a-check')) sync(); });
    bulk?.querySelectorAll<HTMLElement>('[data-bulk-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.bulkAct;
        boxes().filter((x) => x.checked).forEach((x) => {
          const tr = x.closest('tr') as HTMLElement | null;
          if (!tr) return;
          if (act === 'remove') tr.remove();
          else {
            const cell = tr.querySelector<HTMLElement>('[data-bulk-cell]');
            if (cell && b.dataset.bulkLabel) cell.innerHTML = b.dataset.bulkLabel;
            x.checked = false;
          }
        });
        sync();
      }),
    );
    bulk?.querySelector('[data-bulk-clear]')?.addEventListener('click', () => { boxes().forEach((b) => (b.checked = false)); sync(); });

    // вся строка — переход
    body.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('a, button, input, label, select')) return;
      const tr = t.closest<HTMLElement>('tr[data-href]');
      if (tr) location.href = tr.dataset.href!;
    });

    apply();
  });

  // переключатель периода (Метрика) — в прототипе только подсветка
  document.querySelectorAll<HTMLElement>('[data-seg]').forEach((seg) =>
    seg.querySelectorAll<HTMLElement>('.a-seg__btn').forEach((b, _, list) =>
      b.addEventListener('click', () => list.forEach((x) => x.classList.toggle('is-active', x === b))),
    ),
  );
}
