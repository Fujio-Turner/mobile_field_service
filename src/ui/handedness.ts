import type { FlexStyle, ViewStyle } from 'react-native';

export const LEFT_HAND_KEY = 'mfs.ui.leftHand';
export const THUMB_OPTIMIZE_KEY = 'mfs.ui.thumbOptimize';

/** Viewports from the thumb-zone chart (logical px). */
export const THUMB_VIEWPORTS = {
  compact: { width: 360, height: 800 },
  phone: { width: 375, height: 812 },
  plus: { width: 428, height: 926 },
  max: { width: 440, height: 956 },
} as const;

export type ThumbSizeClass = keyof typeof THUMB_VIEWPORTS;

/** Comfortable thumb-arc width in points — stays put as screens get taller/wider. */
export const THUMB_REACH_PT = 300;

export type ThumbScreen = { width: number; height: number };

export type ThumbLayout = {
  sizeClass: ThumbSizeClass;
  actionWidth: number | '100%';
  minHeight: number;
  gutter: number;
  alignSelf: 'flex-start' | 'flex-end' | 'stretch';
  optimize: boolean;
};

/**
 * Right hand: easy zone is lower-left (heatmap). Left hand: mirrored, lower-right.
 */
export function thumbAlignSelf(leftHand: boolean): 'flex-start' | 'flex-end' {
  return leftHand ? 'flex-end' : 'flex-start';
}

export function effectiveLeftHand(optimize: boolean, leftHand: boolean): boolean {
  return optimize && leftHand;
}

export function thumbBarDirection(leftHand: boolean): NonNullable<FlexStyle['flexDirection']> {
  return leftHand ? 'row-reverse' : 'row';
}

export function thumbSizeClass(width: number, height: number): ThumbSizeClass {
  const short = Math.min(width, height);
  if (short <= THUMB_VIEWPORTS.compact.width) return 'compact';
  if (short <= 400) return 'phone';
  if (short <= THUMB_VIEWPORTS.plus.width) return 'plus';
  return 'max';
}

export function thumbMinHeight(sizeClass: ThumbSizeClass): number {
  if (sizeClass === 'compact') return 48;
  if (sizeClass === 'phone') return 52;
  return 56;
}

export function thumbGutter(sizeClass: ThumbSizeClass): number {
  if (sizeClass === 'compact') return 12;
  if (sizeClass === 'phone') return 16;
  if (sizeClass === 'plus') return 20;
  return 24;
}

/** Absolute width in the green zone. Fraction of screen shrinks on Plus/Max. */
export function thumbActionWidth(screenWidth: number, sizeClass: ThumbSizeClass): number {
  const gutter = thumbGutter(sizeClass);
  const available = Math.max(200, screenWidth - gutter * 2);
  return Math.round(Math.min(THUMB_REACH_PT, available * 0.92));
}

export function thumbLayout(optimize: boolean, leftHand: boolean, screen: ThumbScreen): ThumbLayout {
  const sizeClass = thumbSizeClass(screen.width, screen.height);
  if (!optimize) {
    return {
      sizeClass,
      actionWidth: '100%',
      minHeight: 48,
      gutter: 16,
      alignSelf: 'stretch',
      optimize: false,
    };
  }
  return {
    sizeClass,
    actionWidth: thumbActionWidth(screen.width, sizeClass),
    minHeight: thumbMinHeight(sizeClass),
    gutter: thumbGutter(sizeClass),
    alignSelf: thumbAlignSelf(leftHand),
    optimize: true,
  };
}

export function thumbActionStyle(
  optimize: boolean,
  leftHand: boolean,
  screen: ThumbScreen = THUMB_VIEWPORTS.phone,
): ViewStyle {
  const layout = thumbLayout(optimize, leftHand, screen);
  return {
    alignSelf: layout.alignSelf,
    width: layout.actionWidth,
    minHeight: layout.minHeight,
  };
}

export function parseLeftHandFlag(raw: string | null | undefined): boolean {
  return raw === '1' || raw === 'true';
}
