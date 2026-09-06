export type StackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: '/(tabs)') => void;
};

/** Pop the screen we came from; if this was a cold deep link, land on Today. */
export function goStackBack(router: StackRouter): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}
