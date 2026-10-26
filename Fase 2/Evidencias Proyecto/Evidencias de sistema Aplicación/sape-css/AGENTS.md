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

## Mensajes de commit tras fallos de pipeline (CI/CD)

- **Corrección de errores de pipeline:** Cada vez que se corrija un fallo del pipeline (GitHub Actions / CI), el mensaje del commit subsecuente debe incluir obligatoriamente:
  1. **Errores del pipeline:** Detallar exactamente qué falló (ej. qué reglas de Laravel Pint se infringieron, qué tests fallaron, errores de build o dependencias).
  2. **Solución aplicada:** Resumen claro y conciso de cómo se resolvió cada problema.
