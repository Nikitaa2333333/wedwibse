# Звуки ролика — синтез с нуля (numpy), свои, без лицензий.
# python3 scripts/sfx.py → public/sfx/*.wav
#   tap — касание, pop — пилюля/подъём над стеклом, whoosh — появление/переход,
#   chime — новая заявка, tick — набор текста, pad — тихая подложка (черновик музыки).
# Музыку в финале лучше заменить лицензионным треком — подложка тут для темпа и настроения.
import os, wave
import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(SR * sec)) / SR

def save(name, x, peak=0.8, stereo=None):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    if stereo is None: stereo = np.stack([x, x], 1)
    else:
        stereo = stereo / (np.max(np.abs(stereo)) or 1) * peak
    data = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

def lowpass(x, fc):
    # однополюсный ФНЧ, дважды — мягкий срез
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(2):
        y = np.empty_like(x); acc = 0.0
        for i, v in enumerate(x):
            acc = (1 - a) * v + a * acc; y[i] = acc
        x = y
    return x

def fft_band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))

def reverb(x, mix=0.25, seconds=1.6):
    # простая «комната»: несколько затухающих задержек
    out = np.concatenate([x, np.zeros(int(SR * seconds))])
    wet = np.zeros_like(out)
    for d, g in [(0.029, .5), (0.037, .45), (0.047, .4), (0.061, .35), (0.083, .3), (0.113, .25), (0.149, .2), (0.197, .15)]:
        n = int(d * SR); k = 1
        while n * k < len(out) and g ** k > 0.01:
            wet[n * k:] += out[:len(out) - n * k] * (g ** k) * 0.6; k += 1
    return out * (1 - mix) + wet * mix

# касание: короткий мягкий щелчок
tt = t(0.09)
tap = np.sin(2 * np.pi * 1650 * tt) * np.exp(-tt * 70) + 0.25 * rng.standard_normal(len(tt)) * np.exp(-tt * 400)
save('tap', fft_band(tap, 300, 9000), 0.5)

# поп: тон скользит вверх, как пузырь
tt = t(0.22)
f = 380 + 520 * (1 - np.exp(-tt * 40))
pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 18) * (1 - np.exp(-tt * 400))
save('pop', reverb(pop, 0.18, 0.6), 0.5)

# вжух: шум с полосой, которая едет вверх-вниз, огибающая — плавный горб
dur = 0.9; tt = t(dur); n = rng.standard_normal(len(tt))
env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
seg = 1024; wh = np.zeros_like(n)
for i in range(0, len(n), seg // 2):
    c = 600 + 2600 * np.sin(np.pi * min(1, i / len(n)))
    chunk = n[i:i + seg]
    if len(chunk) < 16: break
    win = np.hanning(len(chunk))
    wh[i:i + len(chunk)] += fft_band(chunk * win, c * 0.5, c * 1.6)
wl = wh * env; wr = np.roll(wh, 240) * env  # лёгкая ширина
save('whoosh', wl, 0.45, np.stack([wl, wr], 1))

# колокольчик: две ноты с обертонами
def bell(freq, dur=1.6):
    tt = t(dur); x = np.zeros_like(tt)
    for k, a, d in [(1, 1, 3.2), (2.0, .35, 5), (2.76, .2, 7), (5.4, .08, 11)]:
        x += a * np.sin(2 * np.pi * freq * k * tt) * np.exp(-tt * d)
    return x * (1 - np.exp(-tt * 300))
ch = np.zeros(int(SR * 2.0)); b1 = bell(1046.5); b2 = bell(1568.0)
ch[:len(b1)] += b1; o = int(SR * 0.13); ch[o:o + len(b2)] += b2[:len(ch) - o] * 0.8
save('chime', reverb(ch, 0.3), 0.45)

# тик клавиатуры
tt = t(0.035)
tick = rng.standard_normal(len(tt)) * np.exp(-tt * 260)
save('tick', fft_band(tick, 1800, 9000), 0.25)

# подложка: тёплые аккорды с медленной атакой (Fmaj7 — Am7 — Dm9 — Bbmaj7), ~96 с
def note(freq, dur):
    tt = t(dur)
    x = sum(np.sin(2 * np.pi * freq * (1 + c / 1200) * tt + p) for c, p in [(-4, 0), (0, 1.3), (4, 2.1)])
    x += 0.18 * np.sin(2 * np.pi * freq * 2 * tt)
    att, rel = 1.8, 2.6
    env = np.minimum(1, tt / att) * np.minimum(1, (dur - tt) / rel).clip(0, 1)
    return x * env
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60, 64], [46, 50, 53, 57]]
bar = 8.0; total = 96.0
L = np.zeros(int(SR * (total + 4))); R = np.zeros_like(L)
for i in range(int(total / bar)):
    ch_ = chords[i % 4]; start = int(i * bar * SR)
    for j, m in enumerate(ch_):
        x = note(mid(m), bar + 2.5)
        pan = 0.35 + 0.3 * (j / max(1, len(ch_) - 1))
        L[start:start + len(x)] += x * (1 - pan); R[start:start + len(x)] += x * pan
    sub = note(mid(ch_[0] - 12), bar + 2.5) * 0.5
    L[start:start + len(sub)] += sub; R[start:start + len(sub)] += sub
L = reverb(L, 0.35, 2.4)[:len(L)]; R = reverb(R, 0.35, 2.4)[:len(R)]
fade = int(SR * 3); L[-fade:] *= np.linspace(1, 0, fade); R[-fade:] *= np.linspace(1, 0, fade)
save('pad', L, 0.35, np.stack([L, R], 1))
print('ok →', os.path.abspath(OUT))
