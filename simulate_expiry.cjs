
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yaqadkpmueqopoqkicbk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcWFka3BtdWVxb3BvcWtpY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzUzMTEsImV4cCI6MjA4MjA1MTMxMX0.-X4-Z-raebICze4JKCy6uCOM5p-A6AnvlVZdrIt5QYM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateExpiry() {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    console.log('Simulating expiry for: ismaelgilruiz7@gmail.com');
    console.log('Setting created_at to:', fifteenDaysAgo.toISOString());

    const { data, error } = await supabase
        .from('companies')
        .update({ created_at: fifteenDaysAgo.toISOString() })
        .eq('email', 'ismaelgilruiz7@gmail.com')
        .select();

    if (error) {
        console.error('Error updating company:', error);
    } else {
        console.log('Success! Company updated:', data);
    }
}

simulateExpiry();
