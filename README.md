
# Jornify - Documentación Técnica

He implementado la estructura de datos necesaria para que tu aplicación sea escalable y profesional.

### SQL Implementado (`schema.sql`)
- **Tablas**: `companies`, `employees` y `time_records`.
- **Integridad**: Relaciones mediante `UUID` y claves foráneas con borrado en cascada.
- **Seguridad**: Soporte para contraseñas, PINs únicos y correos electrónicos sin duplicados.
- **Rendimiento**: Índices optimizados para que el login y la carga de historiales sean instantáneos.
- **Lógica de Horas Extra**: He creado una **Vista SQL** (`view_weekly_overtime`) que calcula automáticamente las horas extra de cada empleado por semana. Esto significa que no necesitas hacer cálculos pesados en el cliente; el servidor te da el dato listo.

### Funcionalidades clave en la App
1. **Recuperación de Contraseña**: Flujo completo en `LoginView.tsx` para verificar email y resetear claves.
2. **Contrato Semanal**: La empresa tiene el control total para editar las horas semanales de cada trabajador.
3. **Registro Simplificado**: El empleado solo pulsa un botón; el sistema se encarga del resto.
4. **Persistencia**: Función "Recordar contraseña" mediante almacenamiento local seguro.
