import { describe, expect, it } from 'vitest';
import { nextPlaceholderTitle } from './title';

describe('nextPlaceholderTitle', () => {
  it('starts at "Chat 1" with no existing sessions', () => {
    expect(nextPlaceholderTitle([])).toBe('Chat 1');
  });

  it('is one past the highest existing Chat N', () => {
    expect(nextPlaceholderTitle(['Chat 1', 'Chat 3'])).toBe('Chat 4');
  });

  it('ignores manually-renamed titles', () => {
    expect(nextPlaceholderTitle(['Deploy plan', 'Chat 2', 'Notes'])).toBe('Chat 3');
  });
});
