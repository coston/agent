/** Thrown when a user's provider config can't produce a working model. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
