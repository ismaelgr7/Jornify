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

        // 1. Obtener la hora actual en formato HH:MM
        const now = new Date();
        // Ajustar a hora de España (Europe/Madrid) si es necesario, o usar UTC si el usuario lo prefiere.
        // Para simplificar, asumiremos que nudge_time se guarda en UTC o que el servidor coincide.
        const currentTime = now.toISOString().substring(11, 16);

        console.log(`Checking nudges for time: ${currentTime}`);

        // 2. Buscar empleados que tengan nudge_time == currentTime
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, full_name, nudge_time')
            .eq('nudge_time', currentTime);

        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            return new Response(JSON.stringify({ message: "No nudges for this time" }), { status: 200 });
        }

        const results = [];

        for (const employee of employees) {
            // 3. Verificar si el empleado está fichado actualmente (activeRecord)
            // Buscamos un registro en time_records que no tenga clock_out para hoy
            const { data: activeRecords, error: recordError } = await supabase
                .from('time_records')
                .select('id')
                .eq('employee_id', employee.id)
                .is('clock_out', null);

            if (recordError) continue;
            if (!activeRecords || activeRecords.length === 0) continue; // No está fichado, no enviamos alerta

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
                            title: 'Recordatorio de Salida',
                            body: `Hola ${employee.full_name}, no olvides fichar tu salida.`,
                            url: '/'
                        })
                    );
                    results.push({ employee: employee.full_name, status: 'sent' });
                } catch (pushErr) {
                    console.error(`Error sending push to ${employee.full_name}:`, pushErr);
                    // Si la suscripción ya no es válida, podríamos eliminarla
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
