// 设置 /settings —— 乐器音色参数与键盘映射
import { useEffect, useState } from 'react';
import type { AppSettings, Instrument, KeyBinding } from '../types';
import { DEFAULT_INSTRUMENTS } from '../lib/factory';
import { useSettings } from '../settingsContext';

export function Settings() {
  const { s, replaceSettings, setShowHighlight, setStretch } = useSettings();
  const [waiting, setWaiting] = useState<KeyBinding | null>(null); // 等待按键的那条绑定
  const [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
  const [msg, setMsg] = useState('');

  const rebind = (e: KeyboardEvent) => {
    if (!waiting) return;
    e.preventDefault();
    if (e.key === 'Escape') {
      // 取消本次改绑，键位保持原样
      setWaiting(null);
      setMsg('已取消改绑');
      return;
    }
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return; // 单按修饰键不绑定
    const key = e.key.toLowerCase();
    const isSelf = (b: KeyBinding) => b.instrumentId === waiting.instrumentId && b.glyphIndex === waiting.glyphIndex;
    const conflict = s.keyMap.find((b) => b.key === key && !isSelf(b));
    if (conflict) {
      // 一个字母同一时间只对应一个字：拦下这次改绑并指出占用者，可换键或 Esc 取消
      const inst = instruments.find((i) => i.id === conflict.instrumentId);
      const glyph = inst?.glyphs[conflict.glyphIndex] ?? '—';
      setMsg(`「${key}」已被 ${inst?.name ?? conflict.instrumentId}·${glyph} 占用，请换一个键（Esc 取消）`);
      return;
    }
    const next: AppSettings = { ...s, keyMap: s.keyMap.map((b) => (isSelf(b) ? { ...b, key } : b)) };
    replaceSettings(next); // 上下文内会写入 IndexedDB
    setWaiting(null);
    setMsg(`已绑定 ${key}`);
  };

  useEffect(() => {
    if (waiting) {
      window.addEventListener('keydown', rebind, { once: false });
      return () => window.removeEventListener('keydown', rebind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, s]);

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
      <p className="dim">点击「改」后按下新键；Esc 取消。同一键只能映射一个字。</p>
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
            const isWaiting = waiting?.instrumentId === b.instrumentId && waiting?.glyphIndex === b.glyphIndex;
            return (
              <tr key={`${b.instrumentId}-${b.glyphIndex}`} className={isWaiting ? 'waiting' : ''}>
                <td>
                  <kbd>{b.key}</kbd>
                </td>
                <td>{inst?.name ?? b.instrumentId}</td>
                <td>{glyph}</td>
                <td>
                  <button
                    className="mini"
                    data-testid={`rebind-${b.key}`}
                    onClick={() => {
                      setWaiting(b);
                      setMsg('请按下新键（Esc 取消）');
                    }}
                  >
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
