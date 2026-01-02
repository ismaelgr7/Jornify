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
        // Read employeeId if provided for manual nudge
        const { employeeId } = await req.json().catch(() => ({}));
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // 1. Obtener la hora actual y la de hace 1 minuto para dar margen (Madrid)
        const now = new Date();
        const oneMinAgo = new Date(now.getTime() - 60000);

        const getTimeString = (d: Date) => {
            const f = new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const p = f.formatToParts(d);
            const h = p.find(x => x.type === 'hour')?.value || '00';
            const m = p.find(x => x.type === 'minute')?.value || '00';
            return [
                `${h}:${m}`,
                `${parseInt(h)}:${m}` // Para casos como "9:05"
            ];
        };

        const validTimeStrings = [...getTimeString(now), ...getTimeString(oneMinAgo)];

        console.log(`Checking nudges for Madrid. Window: [${validTimeStrings.join(', ')}]${employeeId ? ` (Manual for ${employeeId})` : ''}`);

        // 2. Buscar empleados
        let query = supabase.from('employees').select('id, name, nudge_time');

        if (employeeId) {
            query = query.eq('id', employeeId);
        } else {
            query = query.in('nudge_time', validTimeStrings);
        }

        const { data: employees, error: empError } = await query;

        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            return new Response(JSON.stringify({ message: "No nudges for this time" }), { status: 200 });
        }

        const results = [];

        for (const employee of employees) {
            // 3. Verificar si el empleado está fichado actualmente (activeRecord)
            const { data: activeRecords, error: recordError } = await supabase
                .from('time_records')
                .select('id')
                .eq('employee_id', employee.id)
                .is('end_time', null);

            if (recordError) continue;
            if (!activeRecords || activeRecords.length === 0) continue;

            // 4. Obtener suscripciones push
            const { data: subs, error: subError } = await supabase
                .from('push_subscriptions')
                .select('subscription_json')
                .eq('employee_id', employee.id);

            if (subError || !subs) continue;

            for (const sub of subs) {
                try {
                    await webpush.sendNotification(
                        sub.subscription_json,
                        JSON.stringify({
                            title: 'Recordatorio de Jornify',
                            body: `Hola ${employee.name}, no olvides fichar tu salida.`,
                            url: '/'
                        })
                    );
                    results.push({ employee: employee.name, status: 'sent' });
                } catch (pushErr) {
                    console.error(`Error sending push to ${employee.name}:`, pushErr);
                    if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().eq('subscription_json', sub.subscription_json);
                    }
                }
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
})
