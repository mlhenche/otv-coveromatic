# TODO — CoverOmatic v2

> Última actualización: 2026-02-19

---

## Tareas pendientes

### 1. Retransmisiones deportivas
Empezar a pensar cómo gestionar el flujo para **contenido deportivo en directo**:
- ¿Qué tipo de card/componente usan?
- ¿Qué datos necesitan? (equipos, competición, fecha/hora, canal)
- ¿Fuente de datos? (TMDB no cubre deportes — ¿API propia, manual?)
- ¿Cómo encaja con el sistema de tipos actuales (portrait/landscape/vps)?

### 2. URLs de cards EPG de U7D
Estudiar e investigar los tipos de URLs de las **cards de la EPG (Electronic Program Guide) de U7D** que actualmente no estamos utilizando:
- ¿Qué formato tienen estas URLs?
- ¿Qué información contienen? (canal, horario, programa)
- ¿Cómo se diferencian de las URLs actuales del catálogo OTV?
- ¿Son útiles para el plugin? ¿Qué casos de uso cubrirían?
- ¿Necesitamos parsear/procesar estas URLs de forma diferente?
- ¿Deberían añadirse al catálogo de Supabase o manejarse por separado?
