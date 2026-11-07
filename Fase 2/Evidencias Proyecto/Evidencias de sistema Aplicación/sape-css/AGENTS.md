# AGENTS.md — Reglas de trabajo asistido (S.A.P.E CSS)

> Alcance: este archivo rige para cualquier agente/IA que trabaje en este
> repositorio. Las reglas quedan vigentes hasta que el equipo las levante
> explícitamente.

## Restricciones de lectura

- **No leer** (ni contenido ni metadatos) estos archivos de Fase 1:
  - `Fase 1/Evidencias Grupales/1.4_APT122_FormativaFase1.docx`
  - `Fase 1/Evidencias Grupales/1.5_GuiaEstudiante_Fase 1_Definicion Proyecto APT.docx`
- Regla impuesta el 26-09-2026 por el equipo. No inferir su contenido
  desde cachés, índices, logs ni herramientas de búsqueda.

## Estructura obligatoria de commits y Pull Requests (Title + Description)

- **Todo commit y subida a GitHub debe incluir siempre título y descripción (`git commit -m "<Title>" -m "<Description>"`):**
  1. **Add a title (1ª línea del commit):** Título claro en formato Conventional Commits (ej. `feat(alcance): resumen conciso del cambio`).
  2. **Add a description (cuerpo del commit):** Lista detallada con viñetas (`- ...`) explicando todos los cambios realizados en frontend, backend, rutas o estilos, de modo que al crear una Pull Request en GitHub se autocompleten de inmediato los campos **Add a title** y **Add a description**.
- Además, en la respuesta al usuario tras subir a GitHub, mostrar siempre explícitamente los bloques **Add a title** y **Add a description**.

## Reglas de desarrollo para Modo Oscuro (Dark Mode)

- **Prohibido usar fondos blancos translúcidos (`bg-white/60`, `bg-white/80`, `hover:bg-white/60`, `bg-slate-100/90`, etc.) en tarjetas, selectores de rol, botones o contenedores:**
  - En Modo Oscuro (`html[data-theme="dark"]`), los fondos blancos con opacidad producen un velo gris/blanco translúcido que rompe el contraste nocturno.
  - Utilizar siempre clases de superficie sólidas (`bg-white`, `bg-slate-50`, `bg-slate-100`, `hover:bg-white`, `hover:bg-slate-100`) y asegurar que estén mapeadas a superficies oscuras sólidas (`#151f32`, `#1e293b`, `#0f172a`, `#263449`) en `resources/css/app.css`.

## Mensajes de commit tras fallos de pipeline (CI/CD)

- **Corrección de errores de pipeline:** Cada vez que se corrija un fallo del pipeline (GitHub Actions / CI), el mensaje del commit subsecuente debe incluir obligatoriamente:
  1. **Errores del pipeline:** Detallar exactamente qué falló (ej. qué reglas de Laravel Pint se infringieron, qué tests fallaron, errores de build o dependencias).
  2. **Solución aplicada:** Resumen claro y conciso de cómo se resolvió cada problema.
