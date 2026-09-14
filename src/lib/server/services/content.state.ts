import type { ContentStatus } from '$lib/api/schemas';

export const CONTENT_STATUS_TRANSITION: {
  [K in ContentStatus]: readonly ContentStatus[];
} = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_STATUS_TRANSITION[from].includes(to);
}

class InvalidContentStateError extends Error {
  constructor() {
    super('Invalid content state transition');
    this.name = 'InvalidContentStateError';
  }
}

export function assertCanPublish(status: ContentStatus): void {
  if (!canTransition(status, 'published')) {
    throw new InvalidContentStateError();
  }
}

export function assertCanArchive(status: ContentStatus): void {
  if (!canTransition(status, 'archived')) {
    throw new InvalidContentStateError();
  }
}
