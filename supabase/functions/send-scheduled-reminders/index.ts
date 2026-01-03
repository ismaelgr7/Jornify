import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
    'mailto:info@jornify.io',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
)

serve(async (req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Get current time and 2 minutes ago for window matching
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

        console.log(`Checking scheduled reminders. Window: [${twoMinutesAgo.toISOString()} - ${now.toISOString()}]`);

        // Find pending reminders within the time window
        const { data: pendingReminders, error: fetchError } = await supabase
            .from('scheduled_reminders')
            .select(`
                id,
                employee_id,
                time_record_id,
                scheduled_time,
                employees (
                    id,
                    name
                ),
                time_records (
                    id,
                    end_time
                )
            `)
            .is('sent_at', null)
            .gte('scheduled_time', twoMinutesAgo.toISOString())
            .lte('scheduled_time', now.toISOString());

        if (fetchError) throw fetchError;

        if (!pendingReminders || pendingReminders.length === 0) {
            return new Response(JSON.stringify({ message: "No pending reminders" }), { status: 200 });
        }

        const results = [];

        for (const reminder of pendingReminders) {
            // Skip if employee data is missing
            if (!reminder.employees) {
                console.warn(`Skipping reminder ${reminder.id}: employee not found`);
                continue;
            }

            // Skip if the employee already clocked out
            if (reminder.time_records?.end_time !== null) {
                console.log(`Skipping reminder for ${reminder.employees.name}: already clocked out`);
                // Mark as sent to avoid re-processing
                await supabase.from('scheduled_reminders')
                    .update({ sent_at: now.toISOString() })
                    .eq('id', reminder.id);
                continue;
            }

            // Get push subscriptions for this employee
            const { data: subs, error: subError } = await supabase
                .from('push_subscriptions')
                .select('subscription_json')
                .eq('employee_id', reminder.employee_id);

            if (subError || !subs || subs.length === 0) {
                console.warn(`No push subscriptions for ${reminder.employees.name}`);
                continue;
            }

            // Send push notification to all devices
            for (const sub of subs) {
                try {
                    await webpush.sendNotification(
                        sub.subscription_json,
                        JSON.stringify({
                            title: 'Recordatorio de Jornify',
                            body: `Hola ${reminder.employees.name}, no olvides fichar tu salida.`,
                            url: '/',
                            tag: `scheduled-${reminder.id}`,
                            timestamp: Date.now()
                        }),
                        { urgency: 'high' }
                    );
                    console.log(`Sent reminder to ${reminder.employees.name}`);
                } catch (pushErr: any) {
                    console.error(`Error sending push to ${reminder.employees.name}:`, pushErr);
                    // Clean up expired subscriptions
                    if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                        await supabase.from('push_subscriptions')
                            .delete()
                            .eq('subscription_json', sub.subscription_json);
                    }
                }
            }

            // Mark reminder as sent
            const { error: updateError } = await supabase.from('scheduled_reminders')
                .update({ sent_at: now.toISOString() })
                .eq('id', reminder.id);

            if (updateError) {
                console.error(`Error marking reminder as sent:`, updateError);
            }

            results.push({ employee: reminder.employees.name, status: 'sent' });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error('Function error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
})
