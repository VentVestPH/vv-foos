import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

export type EmailTemplate = Tables<'email_templates'>;

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('email_templates')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setTemplates(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return templates;
}
