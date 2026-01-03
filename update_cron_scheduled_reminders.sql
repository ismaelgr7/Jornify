-- Script para actualizar el CRON job de Supabase
-- Este script cambia el CRON del sistema antiguo (send-push-nudge) al nuevo (send-scheduled-reminders)

-- 1. Eliminar el CRON job antiguo si existe
SELECT cron.unschedule('send-push-nudge');

-- 2. Crear el nuevo CRON job para recordatorios programados
-- Se ejecuta cada minuto para revisar recordatorios pendientes
SELECT cron.schedule(
  'send-scheduled-reminders',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-scheduled-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- IMPORTANTE: Reemplaza YOUR_PROJECT_REF y YOUR_ANON_KEY con tus valores reales
-- Puedes obtenerlos desde: Supabase Dashboard > Settings > API

-- Para verificar que el CRON está activo:
SELECT * FROM cron.job WHERE jobname = 'send-scheduled-reminders';
