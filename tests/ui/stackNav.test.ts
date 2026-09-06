import { goStackBack } from '../../src/ui/stackNav';
import { stackScreenOptions } from '../../src/ui/stackHeader';

describe('goStackBack', () => {
  it('pops when there is history', () => {
    const back = jest.fn();
    const replace = jest.fn();
    goStackBack({ canGoBack: () => true, back, replace });
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('lands on Today when the stack is empty', () => {
    const back = jest.fn();
    const replace = jest.fn();
    goStackBack({ canGoBack: () => false, back, replace });
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('stackScreenOptions', () => {
  it('puts Back on the left by default and the right for left hand', () => {
    const right = stackScreenOptions(false);
    expect(right.headerLeft).toBeTruthy();
    expect(right.headerRight).toBeUndefined();
    expect(right.headerBackVisible).toBe(false);
    const left = stackScreenOptions(true);
    expect(left.headerLeft).toBeUndefined();
    expect(left.headerRight).toBeTruthy();
  });
});
