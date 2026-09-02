import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_PLACEHOLDERS,
  applyTemplate,
  unknownPlaceholders,
} from '../../app/src/lib/emailTemplates';

const ada = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  full_name: 'Ada Lovelace',
  current_title: 'Analyst',
  current_employer: null,
};

describe('applyTemplate', () => {
  it('fills every placeholder it knows', () => {
    expect(applyTemplate('Hi {{first_name}} {{last_name}}', ada)).toBe('Hi Ada Lovelace');
    expect(applyTemplate('{{full_name}} — {{current_title}}', ada)).toBe('Ada Lovelace — Analyst');
  });

  it('tolerates spacing and case inside the braces', () => {
    expect(applyTemplate('Hi {{ First_Name }}', ada)).toBe('Hi Ada');
  });

  it('replaces a placeholder with nothing when the field is empty', () => {
    expect(applyTemplate('at {{current_employer}}.', ada)).toBe('at .');
  });

  it('leaves an unknown placeholder exactly as written rather than blanking it', () => {
    expect(applyTemplate('Ref {{requisition_code}} for {{first_name}}', ada)).toBe(
      'Ref {{requisition_code}} for Ada',
    );
  });

  it('does not touch a single brace or a bare word', () => {
    expect(applyTemplate('{first_name} and first_name', ada)).toBe('{first_name} and first_name');
  });

  it('substitutes every occurrence, not just the first', () => {
    expect(applyTemplate('{{first_name}}, {{first_name}}!', ada)).toBe('Ada, Ada!');
  });

  it('handles a subject with no placeholders at all', () => {
    expect(applyTemplate('Following up', ada)).toBe('Following up');
  });
});

describe('unknownPlaceholders', () => {
  it('names the ones a template author got wrong, without duplicates', () => {
    expect(unknownPlaceholders('{{firstname}} {{firstname}} {{first_name}} {{company}}')).toEqual([
      'firstname',
      'company',
    ]);
  });

  it('accepts every documented placeholder', () => {
    const all = TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ');
    expect(unknownPlaceholders(all)).toEqual([]);
  });
});
