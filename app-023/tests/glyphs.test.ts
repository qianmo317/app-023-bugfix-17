// 拟音字映射用例 —— 同一乐器不同拟音字能区分技法，反查不串乐器
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../src/types';
import { DEFAULT_INSTRUMENTS, PATTERNS, scoreFromPattern } from '../src/lib/factory';
import { buildGlyphMap, lookupGlyph, rebindKey, resolveKey, validateHitGlyphs } from '../src/lib/glyphs';
import { defaultSettings } from '../src/lib/factory';

describe('默认数据健全性', () => {
  it('拟音字无跨乐器冲突（buildGlyphMap 不抛错）', () => {
    expect(() => buildGlyphMap(DEFAULT_INSTRUMENTS)).not.toThrow();
  });
  it('每个乐器至少一个拟音字', () => {
    for (const i of DEFAULT_INSTRUMENTS) expect(i.glyphs.length).toBeGreaterThan(0);
  });
});

describe('反查：字 → 乐器', () => {
  it('咚 → 鼓', () => expect(lookupGlyph('咚', DEFAULT_INSTRUMENTS)!.instrumentId).toBe('gu'));
  it('哐 → 大锣', () => expect(lookupGlyph('哐', DEFAULT_INSTRUMENTS)!.instrumentId).toBe('daluo'));
  it('台 → 小锣', () => expect(lookupGlyph('台', DEFAULT_INSTRUMENTS)!.instrumentId).toBe('xiaoluo'));
  it('七 → 钹', () => expect(lookupGlyph('七', DEFAULT_INSTRUMENTS)!.instrumentId).toBe('bo'));
  it('未知字 → null', () => expect(lookupGlyph('哆', DEFAULT_INSTRUMENTS)).toBeNull());
});

describe('同乐器不同拟音字区分技法', () => {
  it('鼓：咚=常规 / 八=双打(flam) / 哒=闷击(mute)', () => {
    expect(lookupGlyph('咚', DEFAULT_INSTRUMENTS)!.tech).toEqual([]);
    expect(lookupGlyph('八', DEFAULT_INSTRUMENTS)!.tech).toEqual(['flam']);
    expect(lookupGlyph('哒', DEFAULT_INSTRUMENTS)!.tech).toEqual(['mute']);
  });
  it('大锣：仓=双打、光=闷击，同为 daluo 不串', () => {
    const cang = lookupGlyph('仓', DEFAULT_INSTRUMENTS)!;
    const guang = lookupGlyph('光', DEFAULT_INSTRUMENTS)!;
    expect(cang.instrumentId).toBe('daluo');
    expect(guang.instrumentId).toBe('daluo');
    expect(cang.tech).toEqual(['flam']);
    expect(guang.tech).toEqual(['mute']);
  });
  it('同一技法出现在不同乐器不混淆', () => {
    // 小锣「台」是滚奏、钹「采」也是滚奏 —— 乐器 id 必须各自正确
    expect(lookupGlyph('台', DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'xiaoluo', tech: ['roll'] });
    expect(lookupGlyph('采', DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'bo', tech: ['roll'] });
  });
});

describe('键盘映射 resolveKey', () => {
  const settings = defaultSettings();
  it('z → 鼓·咚', () => expect(resolveKey('z', settings, DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'gu', glyph: '咚' }));
  it('x → 鼓·八（带 flam 技法）', () => expect(resolveKey('x', settings, DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'gu', glyph: '八', tech: ['flam'] }));
  it('a → 小锣·才', () => expect(resolveKey('a', settings, DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'xiaoluo', glyph: '才' }));
  it('未绑定键 → null', () => expect(resolveKey('p', settings, DEFAULT_INSTRUMENTS)).toBeNull());
  it('大小写等价', () => expect(resolveKey('Z', settings, DEFAULT_INSTRUMENTS)).toMatchObject({ glyph: '咚' }));
});

describe('改绑 rebindKey：一键只对一字', () => {
  const km = () => defaultSettings().keyMap;
  const keysOf = (list: ReturnType<typeof km>) => list.map((b) => b.key);

  it('改到空闲键：仅该条变更，无重复键', () => {
    const next = rebindKey(km(), 'z', 'p');
    expect(next.find((b) => b.instrumentId === 'gu' && b.glyphIndex === 0)!.key).toBe('p');
    expect(keysOf(next)).toHaveLength(new Set(keysOf(next)).size);
  });

  it('改到已占用键：占用者让位（交换），仍无重复键', () => {
    // z=鼓·咚，v=大锣·哐；把咚改到 v
    const next = rebindKey(km(), 'z', 'v');
    expect(next.find((b) => b.instrumentId === 'gu' && b.glyphIndex === 0)!.key).toBe('v');
    expect(next.find((b) => b.instrumentId === 'daluo' && b.glyphIndex === 0)!.key).toBe('z');
    expect(keysOf(next)).toHaveLength(new Set(keysOf(next)).size);
  });

  it('交换后 resolveKey 各归其主，按下不再串字', () => {
    const next = { ...defaultSettings(), keyMap: rebindKey(km(), 'z', 'v') };
    expect(resolveKey('v', next, DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'gu', glyph: '咚' });
    expect(resolveKey('z', next, DEFAULT_INSTRUMENTS)).toMatchObject({ instrumentId: 'daluo', glyph: '哐' });
  });

  it('新旧键相同：原样返回', () => {
    expect(rebindKey(km(), 'z', 'z')).toBe(km());
  });
});

describe('防串乐器校验', () => {
  it('hit 挂错乐器被检出', () => {
    const score = scoreFromPattern(PATTERNS[0]);
    score.bars[0].steps[0].hits[0].instrumentId = 'xiaoluo'; // 哐 挂到小锣
    const errs = validateHitGlyphs(score);
    expect(errs.some((e) => e.includes('串') || e.includes('属于'))).toBe(true);
  });
  it('正常曲牌全部通过校验', () => {
    for (const p of PATTERNS) {
      const score = scoreFromPattern(p);
      expect(validateHitGlyphs(score), p.name).toEqual([]);
    }
  });
  it('冲突拟音字构建反查表时抛错', () => {
    const bad: Instrument[] = [
      { id: 'a', name: 'A', glyphs: ['咚'], synth: { type: 'drum', baseHz: 80, decay: 0.2, noise: true } },
      { id: 'b', name: 'B', glyphs: ['咚'], synth: { type: 'drum', baseHz: 80, decay: 0.2, noise: true } },
    ];
    expect(() => buildGlyphMap(bad)).toThrow(/冲突/);
  });
});
