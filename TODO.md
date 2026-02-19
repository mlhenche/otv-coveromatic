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

---

### 2. Restringir diálogo VPS solo a componentes VPS
El diálogo con las opciones "Añadir capítulos", "Añadir contenido relacionado" y "Ver reparto" debe aparecer **solo cuando se aplica contenido a componentes VPS**, no en slideshows u otros tipos de componentes.

Implementación:
- Detectar el tipo de componente antes de mostrar el diálogo
- Solo mostrar el diálogo si `componentType === 'vps'`
- Los slideshows y otros componentes con background deben aplicar contenido sin mostrar el diálogo
