import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  LEFT_HAND_KEY,
  THUMB_OPTIMIZE_KEY,
  effectiveLeftHand,
  parseLeftHandFlag,
  thumbActionStyle,
  thumbLayout,
} from './handedness';

type HandednessState = {
  thumbOptimize: boolean;
  setThumbOptimize: (next: boolean) => void;
  leftHand: boolean;
  setLeftHand: (next: boolean) => void;
};

const Ctx = createContext<HandednessState | null>(null);

export function HandednessProvider({ children }: { children: ReactNode }) {
  const [thumbOptimize, setThumbOptimizeState] = useState(false);
  const [leftHand, setLeftHandState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      SecureStore.getItemAsync(THUMB_OPTIMIZE_KEY),
      SecureStore.getItemAsync(LEFT_HAND_KEY),
    ])
      .then(([opt, hand]) => {
        if (cancelled) return;
        setThumbOptimizeState(parseLeftHandFlag(opt));
        setLeftHandState(parseLeftHandFlag(hand));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setThumbOptimize = useCallback((next: boolean) => {
    setThumbOptimizeState(next);
    void SecureStore.setItemAsync(THUMB_OPTIMIZE_KEY, next ? '1' : '0').catch(() => undefined);
  }, []);

  const setLeftHand = useCallback((next: boolean) => {
    setLeftHandState(next);
    void SecureStore.setItemAsync(LEFT_HAND_KEY, next ? '1' : '0').catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ thumbOptimize, setThumbOptimize, leftHand, setLeftHand }),
    [thumbOptimize, setThumbOptimize, leftHand, setLeftHand],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHandedness(): HandednessState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHandedness must be used inside HandednessProvider');
  return ctx;
}

export function useLeftHand(): boolean {
  const ctx = useContext(Ctx);
  return effectiveLeftHand(ctx?.thumbOptimize ?? false, ctx?.leftHand ?? false);
}

export function useThumbActionStyle(): ViewStyle {
  const ctx = useContext(Ctx);
  const optimize = ctx?.thumbOptimize ?? false;
  const leftHand = ctx?.leftHand ?? false;
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => thumbActionStyle(optimize, leftHand, { width, height }),
    [optimize, leftHand, width, height],
  );
}

export function useThumbLayout() {
  const ctx = useContext(Ctx);
  const optimize = ctx?.thumbOptimize ?? false;
  const leftHand = ctx?.leftHand ?? false;
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => thumbLayout(optimize, leftHand, { width, height }),
    [optimize, leftHand, width, height],
  );
}
