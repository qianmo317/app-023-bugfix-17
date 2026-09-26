// 设置 /settings —— 乐器音色参数与键盘映射
import { useEffect, useRef, useState } from 'react';
import type { Instrument } from '../types';
import { DEFAULT_INSTRUMENTS } from '../lib/factory';
import { rebindKey } from '../lib/glyphs';
import { useSettings } from '../settingsContext';

export function Settings() {
  const { s, replaceSettings, setShowHighlight, setStretch } = useSettings();
  const [waiting, setWaiting] = useState<string | null>(null); // 等待按键的 binding key
  const [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
  const [msg, setMsg] = useState('');
  const msgTimer = useRef<number | undefined>(undefined);

  const flash = (text: string) => {
    setMsg(text);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(''), 3000);
  };

  const glyphNameOf = (key: string): string => {
    const b = s.keyMap.find((x) => x.key === key);
    if (!b) return key;
    const inst = instruments.find((i) => i.id === b.instrumentId);
    return inst ? `${inst.name}·${inst.glyphs[b.glyphIndex] ?? '—'}` : key;
  };

  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Esc 取消本次改绑，原键位不动
      if (e.key === 'Escape') {
        setWaiting(null);
        flash('已取消，键位未改');
        return;
      }
      // 忽略修饰键与功能键（Shift/Ctrl/方向键等），继续等待目标键
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
      const key = e.key.toLowerCase();
      if (key === waiting) {
        setWaiting(null);
        flash(`「${glyphNameOf(waiting)}」仍为 ${key}，未改动`);
        return;
      }
      const holder = s.keyMap.find((b) => b.key === key);
      const next = { ...s, keyMap: rebindKey(s.keyMap, waiting, key) };
      replaceSettings(next); // 持久化由 settingsContext 统一处理
      setWaiting(null);
      flash(
        holder
          ? `已绑定 ${key}；原占用「${glyphNameOf(key)}」让出，改用 ${waiting}`
          : `已绑定 ${key}`,
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, s, instruments]);

  const patchSynth = (id: string, field: 'baseHz' | 'decay', value: number) => {
    setInstruments((list) =>
      list.map((i) => (i.id === id ? { ...i, synth: { ...i.synth, [field]: value } } : i)),
    );
  };

  return (
    <div className="page" data-testid="settings-page">
      <h1>设置</h1>

      <h2>试听</h2>
      <label className="dim block">
        <input type="checkbox" data-testid="chk-show-highlight" checked={s.showHighlight} onChange={(e) => setShowHighlight(e.target.checked)} />
        试听时高亮当前拍
      </label>
      <label className="dim block">
        散板近似伸缩 {s.currentBeatStretch.toFixed(2)}×
        <input
          type="range"
          data-testid="rng-stretch"
          min={0.5}
          max={2}
          step={0.05}
          value={s.currentBeatStretch}
          onChange={(e) => setStretch(Number(e.target.value))}
        />
      </label>

      <h2>键盘映射（字母 → 拟音字）</h2>
      <p className="dim">点击「改」后按下新键；Esc 取消。新键若已被别的字占用，会把先前那条挤到旧键上，不会出现一字双键。</p>
      <table className="list" data-testid="keymap-table">
        <thead>
          <tr>
            <th>按键</th>
            <th>乐器</th>
            <th>拟音字</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {s.keyMap.map((b) => {
            const inst = instruments.find((i) => i.id === b.instrumentId);
            const glyph = inst?.glyphs[b.glyphIndex] ?? '—';
            return (
              <tr key={`${b.instrumentId}-${b.glyphIndex}`} className={waiting === b.key ? 'waiting' : ''}>
                <td>
                  <kbd>{b.key}</kbd>
                </td>
                <td>{inst?.name ?? b.instrumentId}</td>
                <td>{glyph}</td>
                <td>
                  <button className="mini" data-testid={`rebind-${b.key}`} onClick={() => setWaiting(b.key)}>
                    改
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {msg && <p className="dim" data-testid="rebind-msg">{msg}</p>}

      <h2>乐器音色（合成参数）</h2>
      <p className="dim">改动仅对当前浏览器生效并用于新曲；如需存入曲目请在编辑器中使用。</p>
      <table className="list" data-testid="synth-table">
        <thead>
          <tr>
            <th>乐器</th>
            <th>类型</th>
            <th>基频 Hz</th>
            <th>衰减 s</th>
            <th>噪声</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst) => (
            <tr key={inst.id}>
              <td style={{ color: inst.color, fontWeight: 700 }}>{inst.name}</td>
              <td>{inst.synth.type}</td>
              <td>
                <input
                  type="number"
                  data-testid={`hz-${inst.id}`}
                  value={inst.synth.baseHz}
                  min={40}
                  max={2400}
                  onChange={(e) => patchSynth(inst.id, 'baseHz', Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  data-testid={`decay-${inst.id}`}
                  value={inst.synth.decay}
                  min={0.03}
                  max={3}
                  step={0.01}
                  onChange={(e) => patchSynth(inst.id, 'decay', Number(e.target.value))}
                />
              </td>
              <td>{inst.synth.noise ? '有' : '无'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
