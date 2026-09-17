import { v7, validate, version } from 'uuid';

export function generateUuidv7(): string {
  return v7();
}

export function isUuidv7(uuid: string): boolean {
  return validate(uuid) && version(uuid) === 7;
}
