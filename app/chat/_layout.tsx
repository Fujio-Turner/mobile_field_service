import { Stack } from 'expo-router';
import { useLeftHand } from '@/src/ui/HandednessContext';
import { stackScreenOptions } from '@/src/ui/stackHeader';

export default function ChatLayout() {
  const leftHand = useLeftHand();
  return <Stack screenOptions={stackScreenOptions(leftHand)} />;
}
