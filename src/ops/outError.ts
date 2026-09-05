export class OutError extends Error {
  constructor(
    public code: 'missing' | 'frozen' | 'illegal_transition' | 'incomplete' | 'reason_required' | 'not_terminal' | 'not_frozen',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OutError';
  }
}
