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
        let query = supabase.from('employees').select('id, name, nudge_time, last_nudge_at');

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

        for (const employee of employees) {
            // 3. Evitar duplicados (solo para automático)
            // Permitimos re-enviar si han pasado más de 15 minutos (útil para testing)
            if (!employeeId && employee.last_nudge_at) {
                const lastNudge = new Date(employee.last_nudge_at).getTime();
                const nowMs = new Date().getTime();
                if (nowMs - lastNudge < 15 * 60 * 1000) { // Menos de 15 minutos
                    console.log(`Bypass: ${employee.name} ya avisado hace poco.`);
                    continue;
                }
            }

            // 4. Verificar si el empleado está fichado actualmente
            const { data: activeRecords, error: recordError } = await supabase
                .from('time_records')
                .select('id')
                .eq('employee_id', employee.id)
                .is('end_time', null);

            if (recordError || !activeRecords || activeRecords.length === 0) continue;

            // 5. Obtener suscripciones push
            const { data: subs, error: subError } = await supabase
                .from('push_subscriptions')
                .select('subscription_json')
                .eq('employee_id', employee.id);

            if (subError || !subs || subs.length === 0) continue;

            // Antes de enviar, marcamos como enviado para evitar carreras
            if (!employeeId) {
                try {
                    await supabase.from('employees').update({ last_nudge_at: new Date().toISOString() }).eq('id', employee.id);
                } catch (e) {
                    console.error("Error updating last_nudge_at:", e);
                }
            }

            for (const sub of subs) {
                try {
                    await webpush.sendNotification(
                        sub.subscription_json,
                        JSON.stringify({
                            title: 'Recordatorio de Jornify',
                            body: `Hola ${employee.name}, no olvides fichar tu salida.`,
                            url: '/',
                            // Tag único para que no se colapsen y suenen siempre
                            tag: employeeId ? `manual-${Date.now()}` : `auto-${employee.id}`,
                            timestamp: Date.now()
                        }),
                        { urgency: 'high' } // Prioridad alta para despertar móviles bloqueados
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
