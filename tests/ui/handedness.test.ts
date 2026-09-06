import {
  effectiveLeftHand,
  parseLeftHandFlag,
  thumbActionStyle,
  thumbAlignSelf,
  thumbBarDirection,
  thumbLayout,
  thumbSizeClass,
  THUMB_REACH_PT,
  THUMB_VIEWPORTS,
} from '../../src/ui/handedness';

describe('thumb zone', () => {
  it('right hand parks actions on the left; left hand on the right when optimize is on', () => {
    expect(thumbAlignSelf(false)).toBe('flex-start');
    expect(thumbAlignSelf(true)).toBe('flex-end');
    expect(thumbActionStyle(true, false).alignSelf).toBe('flex-start');
    expect(thumbActionStyle(true, true).alignSelf).toBe('flex-end');
  });

  it('keeps full-width buttons when large-screen optimize is off', () => {
    const off = thumbActionStyle(false, true);
    expect(off.alignSelf).toBe('stretch');
    expect(off.width).toBe('100%');
    expect(effectiveLeftHand(false, true)).toBe(false);
    expect(effectiveLeftHand(true, true)).toBe(true);
  });

  it('mirrors the tab bar for left hand', () => {
    expect(thumbBarDirection(false)).toBe('row');
    expect(thumbBarDirection(true)).toBe('row-reverse');
  });

  it('parses the stored flag', () => {
    expect(parseLeftHandFlag('1')).toBe(true);
    expect(parseLeftHandFlag('0')).toBe(false);
    expect(parseLeftHandFlag(null)).toBe(false);
  });
});

describe('thumb zone by viewport (heatmap chart)', () => {
  const compact = thumbLayout(true, false, THUMB_VIEWPORTS.compact);
  const phone = thumbLayout(true, false, THUMB_VIEWPORTS.phone);
  const plus = thumbLayout(true, false, THUMB_VIEWPORTS.plus);
  const max = thumbLayout(true, false, THUMB_VIEWPORTS.max);

  it('maps the four chart sizes', () => {
    expect(thumbSizeClass(360, 800)).toBe('compact');
    expect(thumbSizeClass(375, 812)).toBe('phone');
    expect(thumbSizeClass(428, 926)).toBe('plus');
    expect(thumbSizeClass(440, 956)).toBe('max');
  });

  it('keeps absolute reach near 300pt while the fraction shrinks on Plus/Max', () => {
    expect(compact.actionWidth).toBeLessThanOrEqual(THUMB_REACH_PT);
    expect(phone.actionWidth).toBeLessThanOrEqual(THUMB_REACH_PT);
    expect(plus.actionWidth).toBe(THUMB_REACH_PT);
    expect(max.actionWidth).toBe(THUMB_REACH_PT);
    const frac = (w: number, layout: { actionWidth: number | '100%' }) => Number(layout.actionWidth) / w;
    expect(frac(360, compact)).toBeGreaterThan(frac(440, max));
    expect(frac(375, phone)).toBeGreaterThan(frac(428, plus));
  });

  it('uses taller hit targets on larger phones', () => {
    expect(compact.minHeight).toBe(48);
    expect(phone.minHeight).toBe(52);
    expect(plus.minHeight).toBe(56);
    expect(max.minHeight).toBe(56);
    expect(max.gutter).toBeGreaterThan(compact.gutter);
  });
});

