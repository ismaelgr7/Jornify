# Arreglo de Permisos RLS para `typical_shift_hours`

## Problema
Al intentar actualizar las horas de jornada desde el panel de empresa, sale el error: "Error al actualizar las horas de jornada."

## Causa
Falta una política RLS (Row Level Security) que permita a las empresas actualizar el campo `typical_shift_hours` de sus empleados.

## Solución

### Paso 1: Verificar políticas existentes
Ejecuta en Supabase SQL Editor:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'employees';
```

### Paso 2: Crear política permisiva (temporal)
```sql
DROP POLICY IF EXISTS "Companies can update employees" ON employees;

CREATE POLICY "Companies can update employees"
ON employees
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

### Paso 3: Probar
- Recargar la app (F5)
- Intentar cambiar las horas de jornada de un empleado
- Si funciona, la política está correcta

### Paso 4: Política más segura (opcional)
Una vez confirmado que funciona, podemos reemplazarla por una más restrictiva:

```sql
DROP POLICY IF EXISTS "Companies can update employees" ON employees;

CREATE POLICY "Companies can update employees"
ON employees
FOR UPDATE
TO authenticated
USING (company_id = auth.uid())
WITH CHECK (company_id = auth.uid());
```
