import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

function isPlaceholder(value) {
  return /^(your|example|placeholder|change[-_ ]?me|anon-key|service-role)/i.test(value)
    || /(placeholder|replace[-_ ]?later|change[-_ ]?me|example[-_ ]?key|anon[-_ ]?key)/i.test(value);
}

function isValidProjectUrl(value) {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol)
      && !isPlaceholder(parsed.hostname)
      && parsed.hostname !== 'example-project.supabase.co';
  } catch {
    return false;
  }
}

const hasValidAnonKey = Boolean(supabaseAnonKey)
  && !isPlaceholder(supabaseAnonKey)
  && (
    (supabaseAnonKey.startsWith('eyJ') && supabaseAnonKey.length >= 40)
    || /^sb_publishable_[A-Za-z0-9_-]+$/.test(supabaseAnonKey)
  );

export const isSupabaseConfigured = isValidProjectUrl(supabaseUrl) && hasValidAnonKey;

export const supabase = createClient(
  isValidProjectUrl(supabaseUrl) ? supabaseUrl : 'https://example-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'example-anon-key'
);
