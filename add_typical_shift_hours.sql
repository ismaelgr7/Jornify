-- Añadir campo para configurar la duración habitual de jornada por empleado
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS typical_shift_hours INTEGER DEFAULT 8;

-- Comentario para documentación
COMMENT ON COLUMN employees.typical_shift_hours IS 'Duración habitual de la jornada en horas (ej: 4, 6, 8, 10). Se usa para programar recordatorios automáticos.';

-- Actualizar empleados existentes con valor por defecto
UPDATE employees 
SET typical_shift_hours = 8 
WHERE typical_shift_hours IS NULL;
