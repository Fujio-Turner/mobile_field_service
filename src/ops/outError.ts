export class OutError extends Error {
  constructor(
    public code:
      | 'missing'
      | 'frozen'
      | 'illegal_transition'
      | 'incomplete'
      | 'reason_required'
      | 'not_terminal'
      | 'not_frozen'
      | 'photo_cap'
      | 'tmp_missing'
      | 'insufficient_stock',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OutError';
  }
}
