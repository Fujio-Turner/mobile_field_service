import type { ReactNode } from 'react';
import { theme } from '../theme';
import { HeaderBack } from './HeaderBack';

type StackOptions = {
  headerShown: true;
  headerBackVisible: false;
  headerTintColor: string;
  headerStyle: { backgroundColor: string };
  headerTitleStyle: { color: string };
  contentStyle: { backgroundColor: string };
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
};

function renderBack() {
  return <HeaderBack />;
}

export function stackScreenOptions(leftHand: boolean): StackOptions {
  return {
    headerShown: true,
    headerBackVisible: false,
    headerTintColor: theme.color.accent,
    headerStyle: { backgroundColor: theme.color.surface },
    headerTitleStyle: { color: theme.color.text },
    contentStyle: { backgroundColor: theme.color.bg },
    headerLeft: leftHand ? undefined : renderBack,
    headerRight: leftHand ? renderBack : undefined,
  };
}
