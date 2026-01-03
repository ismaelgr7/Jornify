-- Tabla para almacenar recordatorios programados
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  time_record_id UUID NOT NULL REFERENCES time_records(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas eficientes de recordatorios pendientes
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_pending 
ON scheduled_reminders(scheduled_time) 
WHERE sent_at IS NULL;

-- Comentarios para documentación
COMMENT ON TABLE scheduled_reminders IS 'Almacena recordatorios de cierre de fichaje programados automáticamente';
COMMENT ON COLUMN scheduled_reminders.scheduled_time IS 'Hora exacta en la que debe enviarse el recordatorio';
COMMENT ON COLUMN scheduled_reminders.sent_at IS 'NULL = pendiente, con fecha = ya enviado';
