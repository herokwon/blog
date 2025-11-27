import { parseAllowedColor, parseAllowedFontSize } from './style-config';

describe('[Features/Editor] style-config', () => {
  it('parseAllowedFontSize: accepts px within range (including decimals)', () => {
    expect(parseAllowedFontSize('8px')).toBe('8px'); // min
    expect(parseAllowedFontSize('16px')).toBe('16px'); // mid
    expect(parseAllowedFontSize('72px')).toBe('72px'); // max
    expect(parseAllowedFontSize('12.5px')).toBe('12.5px'); // decimal
  });

  it('parseAllowedFontSize: rejects out-of-range or invalid formats', () => {
    expect(parseAllowedFontSize('7px')).toBe(''); // below min
    expect(parseAllowedFontSize('73px')).toBe(''); // above max
    expect(parseAllowedFontSize('16')).toBe(''); // missing unit
    expect(parseAllowedFontSize('1rem')).toBe(''); // wrong unit
    expect(parseAllowedFontSize('abc')).toBe(''); // non-number
  });

  it('parseAllowedColor: accepts only rgb(r, g, b) format', () => {
    expect(parseAllowedColor('rgb(0, 0, 0)')).toBe('rgb(0, 0, 0)');
    expect(parseAllowedColor('rgb(255, 255, 255)')).toBe('rgb(255, 255, 255)');
  });

  it('parseAllowedColor: rejects other formats', () => {
    expect(parseAllowedColor('#000000')).toBe('');
    expect(parseAllowedColor('rgba(0, 0, 0, 1)')).toBe('');
    expect(parseAllowedColor('rgb(0,0,0)')).toBe(''); // missing spaces
    expect(parseAllowedColor('black')).toBe('');
    expect(parseAllowedColor('rgb(0, 0)')).toBe(''); // incomplete
  });
});
