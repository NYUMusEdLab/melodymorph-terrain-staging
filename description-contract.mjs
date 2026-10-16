// Reference helper for the frontend owner. No lookbehind or app/DOM dependency.
const terminals = '.!?。！？';
const closers = '"\'”’」』】)]》〉';
const digit = c => c !== undefined && c >= '0' && c <= '9';
const whitespace = /^[ \t\n\r\v\f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/;

export function countDescriptionSentences(value) {
  let count = 0, start = 0, i = 0;
  while (i < value.length) {
    const c = value[i];
    if (!terminals.includes(c) || (c === '.' && digit(value[i-1]) && digit(value[i+1]))) { i++; continue; }
    if (!whitespace.test(value.slice(start, i))) count++;
    while (i < value.length && terminals.includes(value[i])) i++;
    while (i < value.length && closers.includes(value[i])) i++;
    start = i;
  }
  return count + (whitespace.test(value.slice(start)) ? 0 : 1);
}

export function validateDescription(value) {
  if (typeof value !== 'string' || value.length > 600) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return countDescriptionSentences(value) <= 3;
}
