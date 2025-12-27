import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://yaqadkpmueqopoqkicbk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFka3BtdWVxb3BvcWtpY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzUzMTEsImV4cCI6MjA4MjA1MTMxMX0.-X4-Z-raebICze4JKCy6uCOM5p-A6AnvlVZdrIt5QYM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
