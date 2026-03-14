import type { PostInput } from '$lib/types/post';

export function isNonNullableObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyStringProperty<X extends string>(
  obj: Record<X, unknown>,
  prop: X,
): obj is Record<X, string> {
  return prop in obj && isNonEmptyString(obj[prop]);
}

export function hasTitleProperty(
  obj: unknown,
): obj is Pick<PostInput, 'title'> {
  return isNonNullableObject(obj) && hasNonEmptyStringProperty(obj, 'title');
}

export function hasContentProperty(
  obj: unknown,
): obj is Pick<PostInput, 'content'> {
  return isNonNullableObject(obj) && hasNonEmptyStringProperty(obj, 'content');
}

export function isPostInput(value: unknown): value is PostInput {
  return hasTitleProperty(value) && hasContentProperty(value);
}
