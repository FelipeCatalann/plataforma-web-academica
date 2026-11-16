# Alertas, seguimiento pedagógico e importación Syscol

## Resumen académico

El servidor calcula los promedios que usan la ficha del Profesor Jefe, el copiloto y los informes de IA. El criterio de alerta por asignatura compara el promedio redondeado a un decimal con el mínimo de 4,0. Un promedio de 3,95 se muestra como 4,0 y la asignatura queda fuera de esa alerta. Las evaluaciones conceptuales y las eximiciones se muestran en la ficha y quedan fuera de los promedios numéricos. Cuando faltan notas numéricas, la interfaz muestra **Sin calificaciones**.

## Seguimiento del estudiante

- **Ver motivo de la alerta** muestra las asignaturas bajo 4,0 y las notas agrupadas por semestre.
- **Sugerir apoyo con IA** usa esas calificaciones para preparar un borrador editable. El proveedor recibe asignaturas, semestres y valores, con la evidencia original a la vista del docente.
- El profesor jefe asignado puede redactar o editar un acuerdo y guardar una fecha de revisión. Se conserva un acuerdo vigente por matrícula, con el responsable y la fecha de actualización. La edición manual está disponible cuando la IA falla o el estudiante carece de alertas.

## Importación de planillas

La vista previa indica el año, el curso, las filas de nómina y calificaciones y la acción prevista. La confirmación guarda el vínculo entre el archivo y los cursos que se procesaron. Al eliminar un curso, se conserva el historial de la planilla y se desvincula solo ese curso. Si el mismo archivo incluía varios cursos, la reimportación restaura el eliminado y conserva las notas de los cursos ya procesados.

Las cargas anteriores a la migración conservan su registro. La relación se incorpora la próxima vez que se revise y confirme el archivo original. El sistema mantiene el archivo identificado por su checksum.

## WhatsApp

`SAPE_WHATSAPP_HABILITADO=false` mantiene oculta la mensajería en la nómina, la ficha, el copiloto y Configuración. Las rutas de preparación y confirmación también quedan desactivadas. Las plantillas y los registros existentes se conservan.

Con la función habilitada, preparar un mensaje registra **Mensaje preparado**. **Contacto confirmado** se registra solo cuando el docente que preparó el enlace confirma manualmente la gestión. Esto también aplica a enlaces anteriores que figuraban como abiertos.

## Integración

1. Ejecutar `php artisan migrate` para crear el seguimiento y la relación entre importaciones y cursos.
2. Mantener la variable de WhatsApp en `false` y actualizar la caché de configuración si el servidor la utiliza.
3. En el entorno de despliegue, verificar el envío de correos y la ejecución del programador si se activa `IA_PURGAR_HISTORIAL`.

## Verificación

- PHPUnit con SQLite en memoria. Pasaron 100 pruebas y 2.669 aserciones. Las llamadas de IA se probaron con respuestas simuladas.
- Laravel Pint y compilación de Vite completados.
- Navegador con datos sintéticos. Se verificó que WhatsApp no aparece en la nómina ni en la ficha. Se consultaron las notas por semestre y se guardó un acuerdo con fecha de revisión.
- La validación de estas migraciones en PostgreSQL queda pendiente.
