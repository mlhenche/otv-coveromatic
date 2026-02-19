# TODO — CoverOmatic v2

> Última actualización: 2026-02-19

---

## Tareas pendientes

### 1. Provider logo por ID de contenido
Extraer el proveedor del ID del contenido para cambiar el valor de la variable **provider logo**.

Prefijos identificados hasta ahora:

| Prefijo en ID | Proveedor      |
|---------------|----------------|
| `PRIME`       | Prime Video    |
| `SKYS`        | SkyShowtime    |
| `DSN`         | Disney+        |
| `MAX`         | Max            |
| `RTVE`        | RTVE Play      |
| `FLMN`        | Filmin         |
| `APREM`       | A3 Premium     |

Implementación: al aplicar contenido, parsear el `id` del entry y mapear al nombre de variable correspondiente.

---

### 2. Retransmisiones deportivas
Empezar a pensar cómo gestionar el flujo para **contenido deportivo en directo**:
- ¿Qué tipo de card/componente usan?
- ¿Qué datos necesitan? (equipos, competición, fecha/hora, canal)
- ¿Fuente de datos? (TMDB no cubre deportes — ¿API propia, manual?)
- ¿Cómo encaja con el sistema de tipos actuales (portrait/landscape/vps)?

---

### 3. Restringir diálogo VPS solo a componentes VPS
El diálogo con las opciones "Añadir capítulos", "Añadir contenido relacionado" y "Ver reparto" debe aparecer **solo cuando se aplica contenido a componentes VPS**, no en slideshows u otros tipos de componentes.

Implementación:
- Detectar el tipo de componente antes de mostrar el diálogo
- Solo mostrar el diálogo si `componentType === 'vps'`
- Los slideshows y otros componentes con background deben aplicar contenido sin mostrar el diálogo
