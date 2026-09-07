import { describe, expect, it } from 'vitest';
import { decodeMimeHeader } from '../../supabase/functions/_shared/mime-header.ts';

describe('decodeMimeHeader', () => {
  it('leaves a plain ASCII subject alone', () => {
    expect(decodeMimeHeader('Interview Friday')).toBe('Interview Friday');
  });

  it('passes null and undefined through as null', () => {
    expect(decodeMimeHeader(null)).toBeNull();
    expect(decodeMimeHeader(undefined)).toBeNull();
  });

  it('decodes a base64 UTF-8 encoded word', () => {
    expect(decodeMimeHeader('=?UTF-8?B?4oCU?=')).toBe('—');
  });

  it('decodes a quoted-printable UTF-8 encoded word, with _ as space', () => {
    expect(decodeMimeHeader('=?UTF-8?Q?Caf=C3=A9_visit?=')).toBe('Café visit');
  });

  it('decodes an ISO-8859-1 encoded word', () => {
    expect(decodeMimeHeader('=?ISO-8859-1?Q?Caf=E9?=')).toBe('Café');
  });

  it('drops the whitespace between two adjacent encoded words', () => {
    expect(decodeMimeHeader('=?UTF-8?B?SGVsbG8s?= =?UTF-8?B?IHdvcmxk?=')).toBe('Hello, world');
  });

  it('keeps whitespace between an encoded word and ordinary text', () => {
    expect(decodeMimeHeader('Re: =?UTF-8?B?4oCU?= today')).toBe('Re: — today');
  });

  it('handles a charset with a language tag', () => {
    expect(decodeMimeHeader('=?UTF-8*en?B?4oCU?=')).toBe('—');
  });

  it('leaves the header untouched when the base64 is malformed', () => {
    const broken = '=?UTF-8?B?!!!not-base64!!!?=';
    expect(decodeMimeHeader(broken)).toBe(broken);
  });

  it('leaves the header untouched when the quoted-printable escape is malformed', () => {
    const broken = '=?UTF-8?Q?bad=ZZ?=';
    expect(decodeMimeHeader(broken)).toBe(broken);
  });

  it('leaves the header untouched when the charset is unknown', () => {
    const odd = '=?NOT-A-CHARSET?B?4oCU?=';
    expect(decodeMimeHeader(odd)).toBe(odd);
  });

  it('leaves the header untouched when the bytes are not valid in the declared charset', () => {
    const lying = '=?UTF-8?B?wA==?=';
    expect(decodeMimeHeader(lying)).toBe(lying);
  });

  it('does not touch a subject that only looks like it has an encoded word', () => {
    expect(decodeMimeHeader('Is =? a face?')).toBe('Is =? a face?');
  });

  it('decodes each of several encoded words separated by real text', () => {
    expect(decodeMimeHeader('=?UTF-8?Q?a=C3=A9?= then =?UTF-8?Q?b=C3=A8?=')).toBe('aé then bè');
  });

  it('is a no-op on a value that has already been decoded upstream', () => {
    expect(decodeMimeHeader('Interview — Friday')).toBe('Interview — Friday');
    expect(decodeMimeHeader('Café visit')).toBe('Café visit');
  });

  it('does not attempt to repair mojibake, because that needs a guess', () => {
    expect(decodeMimeHeader('Ã¢Â€Â”')).toBe('Ã¢Â€Â”');
  });
});
