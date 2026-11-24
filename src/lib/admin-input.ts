export const categoryNameLimit = 30;
export const postTagLimit = 10;

export function categoryNameLength(name: string) {
  return [...name.trim()].length;
}

export function splitTags(input: string) {
  return input
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function normalizeTag(tag: string) {
  return tag
    .trim()
    .normalize('NFC')
    .replace(/[A-Z]/g, letter => letter.toLowerCase());
}

export function validateTags(tags: string[], existingTags: string[] = []) {
  if (tags.some(tag => !/^[가-힣a-z0-9]+$/u.test(tag))) return 'invalid';
  if (new Set(tags).size !== tags.length) return 'duplicate';
  if (
    tags.length > postTagLimit &&
    !tags.every(tag => existingTags.includes(tag))
  )
    return 'tooMany';
}

export const tagErrorMessages = {
  invalid: '태그에는 한글, 영문, 숫자만 사용할 수 있습니다.',
  duplicate: '중복된 태그를 제거해 주세요.',
  tooMany: `태그는 최대 ${postTagLimit}개까지 추가할 수 있습니다.`,
};
