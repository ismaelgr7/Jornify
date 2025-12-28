
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Or service role if I had it, but let's try anon if RLS allows or I can check .env

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
