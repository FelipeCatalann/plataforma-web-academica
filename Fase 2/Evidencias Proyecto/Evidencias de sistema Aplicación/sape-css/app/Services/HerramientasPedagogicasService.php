<?php

namespace App\Services;

use App\Models\Curso;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Catálogo de herramientas pedagógicas de solo lectura para Tool Calling seguro.
 *
 * Principios de diseño (INDG-27 / Ley 19.628):
 * - La IA nunca escribe SQL ni recibe nombres, RUTs, correos ni teléfonos reales.
 * - Todas las consultas respetan rol y alcance ($alcance['asignaturas'] y cursos autorizados).
 * - Los estudiantes se identifican únicamente mediante tokens deterministas ([ALUMNO_X], [RUT_X]).
 */
class HerramientasPedagogicasService
{
    public const ETIQUETAS = [
        'listar_estudiantes_riesgo' => 'Estudiantes en riesgo',
        'obtener_detalle_estudiante' => 'Detalle de estudiante',
        'obtener_asistencia_curso' => 'Asistencia del curso',
        'comparar_semestres_curso' => 'Comparativa semestral',
        'buscar_nomina_curso' => 'Nómina del curso',
        'resumen_colegio_cursos' => 'Panorama de cursos',
    ];

    public static function etiquetaPublica(string $nombre): string
    {
        return self::ETIQUETAS[$nombre] ?? $nombre;
    }

    /**
     * Definiciones de herramientas en formato estándar OpenAI (traducidas luego por ProveedorIAAdapter para Anthropic).
     */
    public function definiciones(User $user, Curso $curso, array $alcance): array
    {
        $puedeVerCursoCompleto = $alcance['asignaturas'] === null;
        $esAdmin = $user->hasRole('Administrador');

        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'listar_estudiantes_riesgo',
                    'description' => 'Lista estudiantes anonimizados del curso actual con promedio bajo un umbral (def. 4.0) o con asignaturas reprobadas. Úsala cuando pregunten por alumnos en riesgo, rojos o casos prioritarios.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'asignatura' => [
                                'type' => 'string',
                                'description' => 'Nombre opcional de una asignatura para filtrar (ej. Matemática).',
                            ],
                            'umbral_nota' => [
                                'type' => 'number',
                                'description' => 'Umbral de nota entre 1.0 y 7.0 (por defecto 4.0).',
                            ],
                            'solo_promedio_general' => [
                                'type' => 'boolean',
                                'description' => 'Si es true, devuelve solo quienes tienen promedio general bajo el umbral.',
                            ],
                            'limite' => [
                                'type' => 'integer',
                                'description' => 'Máximo de estudiantes a devolver (1 a 20, defecto 12).',
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'obtener_detalle_estudiante',
                    'description' => 'Obtiene el detalle académico completo de un estudiante específico usando su token exacto (ej. [ALUMNO_3]): notas por asignatura, promedio por semestre y asistencia.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'token_alumno' => [
                                'type' => 'string',
                                'description' => 'Token exacto del estudiante, por ejemplo [ALUMNO_1].',
                            ],
                        ],
                        'required' => ['token_alumno'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'comparar_semestres_curso',
                    'description' => 'Compara rendimiento entre Semestre 1 y Semestre 2 en el curso actual (promedios, % de notas bajo 4.0 y estudiantes con mayor baja o alza).',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'asignatura' => [
                                'type' => 'string',
                                'description' => 'Asignatura opcional para acotar la comparativa semestral.',
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'buscar_nomina_curso',
                    'description' => 'Obtiene una página de la nómina anonimizada del curso ordenada por promedio o asistencia. Úsala solo cuando pidan listar o rankear estudiantes del curso.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'orden' => [
                                'type' => 'string',
                                'enum' => ['menor_promedio', 'mayor_promedio', 'menor_asistencia'],
                                'description' => 'Criterio de ordenamiento (por defecto menor_promedio).',
                            ],
                            'pagina' => [
                                'type' => 'integer',
                                'description' => 'Número de página (desde 1).',
                            ],
                            'limite' => [
                                'type' => 'integer',
                                'description' => 'Cantidad por página (1 a 15, defecto 10).',
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'resumen_colegio_cursos',
                    'description' => $esAdmin
                        ? 'Entrega métricas agregadas de todos los cursos del colegio (matrícula, promedio, % de notas bajo 4.0, asistencia y asignatura crítica).'
                        : 'Entrega métricas agregadas únicamente de los cursos asignados a este docente (matrícula, promedio, % de notas bajo 4.0 y asignatura crítica).',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'nivel' => [
                                'type' => 'string',
                                'description' => 'Filtro opcional de nivel escolar (ej. 1, 2, 3, 4).',
                            ],
                        ],
                    ],
                ],
            ],
        ];

        if ($puedeVerCursoCompleto) {
            array_splice($tools, 2, 0, [[
                'type' => 'function',
                'function' => [
                    'name' => 'obtener_asistencia_curso',
                    'description' => 'Lista estudiantes anonimizados con asistencia bajo un umbral (def. 85%, riesgo Decreto 67) y el promedio de asistencia del curso.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'umbral_asistencia' => [
                                'type' => 'number',
                                'description' => 'Porcentaje umbral de asistencia (por defecto 85).',
                            ],
                            'limite' => [
                                'type' => 'integer',
                                'description' => 'Máximo de estudiantes a listar (1 a 20, defecto 15).',
                            ],
                        ],
                    ],
                ],
            ]]);
        }

        return $tools;
    }

    /**
     * Construye el índice determinista anonimizado del curso activo y llena $mapa en memoria.
     */
    public function prepararIndiceCurso(Curso $curso, array &$mapa): array
    {
        $totalAlumnos = $curso->estudiantes->count();
        $totalNotas = 0;
        $notasBajo4 = 0;
        $promediosGeneralesCurso = [];
        $asistenciasCurso = [];
        $notasPorAsignaturaCurso = [];

        $alumnosPromedioBajo4 = 0;
        $alumnosAsignaturaPromedioBajo4 = 0;
        $alumnosConNotaIndividualBajo4 = 0;
        $alumnosAmbosCriterios = 0;

        $estudiantesIndex = [];
        $porToken = [];
        $vistos = [];
        $contador = 0;

        foreach ($curso->estudiantes as $estudiante) {
            $nombreCompleto = trim(($estudiante->nombres ?? '').' '.($estudiante->apellidos ?? ''));
            if ($nombreCompleto === '' || isset($vistos[$nombreCompleto])) {
                continue;
            }
            $vistos[$nombreCompleto] = true;
            $contador++;

            $tokenAlumno = "[ALUMNO_{$contador}]";
            $tokenEstudianteAlt = "[ESTUDIANTE_{$contador}]";
            $tokenRut = "[RUT_{$contador}]";
            $rutReal = trim((string) ($estudiante->identificadorInterno ?? $estudiante->run ?? 'Sin RUT'));
            if ($rutReal === '') {
                $rutReal = 'Sin RUT';
            }

            $mapa[$tokenAlumno] = $nombreCompleto;
            $mapa[$tokenEstudianteAlt] = $nombreCompleto;
            $mapa[$tokenRut] = $rutReal;

            $valoresAlumno = [];
            $porAsignatura = [];
            $porSemestre = [1 => [], 2 => []];
            $porAsignaturaSemestre = [];
            $notasBajo4Alumno = 0;

            foreach ($estudiante->calificaciones as $nota) {
                if (! is_numeric($nota->valor)) {
                    continue;
                }
                $valor = (float) $nota->valor;
                if ($valor < 1.0 || $valor > 7.0) {
                    continue;
                }

                $valoresAlumno[] = $valor;
                $asignatura = trim((string) ($nota->asignatura_nombre ?? ''));
                $asigNombre = $asignatura === '' ? 'General' : $asignatura;
                $semestre = (int) ($nota->semestre ?? 1);
                if (! in_array($semestre, [1, 2], true)) {
                    $semestre = 1;
                }

                $porAsignatura[$asigNombre][] = $valor;
                $porSemestre[$semestre][] = $valor;
                $porAsignaturaSemestre[$asigNombre][$semestre][] = $valor;

                if ($valor < 4.0) {
                    $notasBajo4Alumno++;
                }
            }

            $totalNotas += count($valoresAlumno);
            $notasBajo4 += $notasBajo4Alumno;

            $promedioGeneral = count($valoresAlumno) > 0
                ? round(array_sum($valoresAlumno) / count($valoresAlumno), 1)
                : null;

            if ($promedioGeneral !== null) {
                $promediosGeneralesCurso[] = $promedioGeneral;
            }

            $asistenciaRaw = $estudiante->pivot->asistencia_pct ?? null;
            $asistenciaPct = is_numeric($asistenciaRaw) ? round((float) $asistenciaRaw, 1) : null;
            if ($asistenciaPct !== null) {
                $asistenciasCurso[] = $asistenciaPct;
            }

            $promediosAsignaturas = [];
            $asignaturasRojas = [];
            foreach ($porAsignatura as $asig => $listaNotas) {
                $notasPorAsignaturaCurso[$asig]['notas'] = array_merge($notasPorAsignaturaCurso[$asig]['notas'] ?? [], $listaNotas);
                $promAsig = round(array_sum($listaNotas) / count($listaNotas), 1);
                $promediosAsignaturas[$asig] = [
                    'promedio' => $promAsig,
                    'cantidad_notas' => count($listaNotas),
                    'notas_bajo_4' => count(array_filter($listaNotas, fn ($v) => $v < 4.0)),
                    'notas' => array_map(fn ($v) => round($v, 1), $listaNotas),
                ];

                if ($promAsig < 4.0) {
                    $asignaturasRojas[] = "{$asig} ({$promAsig})";
                    $notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] = ($notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] ?? 0) + 1;
                }
            }

            $tienePromedioRojo = $promedioGeneral !== null && $promedioGeneral < 4.0;
            $tieneAsignaturaRoja = count($asignaturasRojas) > 0;

            if ($tienePromedioRojo) {
                $alumnosPromedioBajo4++;
            }
            if ($tieneAsignaturaRoja) {
                $alumnosAsignaturaPromedioBajo4++;
            }
            if ($notasBajo4Alumno > 0) {
                $alumnosConNotaIndividualBajo4++;
            }
            if ($tienePromedioRojo && $tieneAsignaturaRoja) {
                $alumnosAmbosCriterios++;
            }

            $promSem1 = count($porSemestre[1]) > 0 ? round(array_sum($porSemestre[1]) / count($porSemestre[1]), 1) : null;
            $promSem2 = count($porSemestre[2]) > 0 ? round(array_sum($porSemestre[2]) / count($porSemestre[2]), 1) : null;

            $registro = [
                'numero' => $contador,
                'token' => $tokenAlumno,
                'rut_token' => $tokenRut,
                'promedio' => $promedioGeneral,
                'asistencia_pct' => $asistenciaPct,
                'notas_bajo_4' => $notasBajo4Alumno,
                'total_notas' => count($valoresAlumno),
                'tiene_riesgo' => $tienePromedioRojo || $tieneAsignaturaRoja,
                'asignaturas_rojas' => $asignaturasRojas,
                'asignaturas' => $promediosAsignaturas,
                'semestre_1' => $promSem1,
                'semestre_2' => $promSem2,
                'por_asignatura_semestre' => $porAsignaturaSemestre,
            ];

            $estudiantesIndex[] = $registro;
            $porToken[$tokenAlumno] = $registro;
        }

        $promedioCurso = count($promediosGeneralesCurso) > 0
            ? round(array_sum($promediosGeneralesCurso) / count($promediosGeneralesCurso), 1)
            : 0.0;

        $asistenciaPromedio = count($asistenciasCurso) > 0
            ? round(array_sum($asistenciasCurso) / count($asistenciasCurso), 1)
            : null;

        $resumenAsignaturas = [];
        foreach ($notasPorAsignaturaCurso as $asig => $datos) {
            $notas = $datos['notas'] ?? [];
            if (count($notas) === 0) {
                continue;
            }
            $prom = round(array_sum($notas) / count($notas), 1);
            $bajo4 = $datos['alumnos_bajo_4'] ?? 0;
            $resumenAsignaturas[] = [
                'nombre' => $asig,
                'promedio' => $prom,
                'alumnos_bajo_4' => $bajo4,
                'texto' => "{$asig}: promedio {$prom} ({$bajo4} <4.0)",
            ];
        }
        usort($resumenAsignaturas, fn ($a, $b) => $a['promedio'] <=> $b['promedio']);

        return [
            'total_alumnos' => $totalAlumnos,
            'total_notas' => $totalNotas,
            'notas_bajo_4' => $notasBajo4,
            'promedio_curso' => $promedioCurso,
            'asistencia_promedio' => $asistenciaPromedio,
            'alumnos_promedio_bajo_4' => $alumnosPromedioBajo4,
            'alumnos_asignatura_bajo_4' => $alumnosAsignaturaPromedioBajo4,
            'alumnos_nota_individual_bajo_4' => $alumnosConNotaIndividualBajo4,
            'alumnos_ambos_criterios' => $alumnosAmbosCriterios,
            'resumen_asignaturas' => $resumenAsignaturas,
            'estudiantes' => $estudiantesIndex,
            'por_token' => $porToken,
        ];
    }

    /**
     * Genera el contexto agregado liviano del curso (sin volcar los 35+ alumnos en cada turno).
     * Si $incluirNominaCompacta es true, adjunta también la nómina compacta (usado como fallback en modelos sin tools).
     */
    public function construirResumenCursoBase(Curso $curso, array $indice, array $alcance, bool $incluirNominaCompacta = false): string
    {
        $totalAlumnos = (int) $indice['total_alumnos'];
        $totalNotas = (int) $indice['total_notas'];
        $notasBajo4 = (int) $indice['notas_bajo_4'];

        $pctPromedioBajo4 = $totalAlumnos > 0 ? round(($indice['alumnos_promedio_bajo_4'] / $totalAlumnos) * 100) : 0;
        $pctAsignaturaBajo4 = $totalAlumnos > 0 ? round(($indice['alumnos_asignatura_bajo_4'] / $totalAlumnos) * 100) : 0;
        $pctNotaIndividualBajo4 = $totalAlumnos > 0 ? round(($indice['alumnos_nota_individual_bajo_4'] / $totalAlumnos) * 100) : 0;

        $resumenNotas = '- Calificaciones bajo 4.0: sin calificaciones numéricas.';
        if ($totalNotas > 0) {
            $pctNotasBajo4 = round(($notasBajo4 / $totalNotas) * 100);
            $resumenNotas = "- Calificaciones bajo 4.0: {$notasBajo4} de {$totalNotas} calificaciones numéricas ({$pctNotasBajo4}%).";
        }

        $asistenciaTexto = ($alcance['asignaturas'] === null && $indice['asistencia_promedio'] !== null)
            ? " Asistencia promedio: {$indice['asistencia_promedio']}%."
            : '';

        $lineas = [
            "- Curso: {$curso->nivel}° Medio {$curso->letra} ({$totalAlumnos} estudiantes). Promedio general: {$indice['promedio_curso']}.{$asistenciaTexto}",
            $resumenNotas,
            "- Estudiantes en riesgo académico: {$indice['alumnos_promedio_bajo_4']}/{$totalAlumnos} ({$pctPromedioBajo4}%) con promedio general <4.0; {$indice['alumnos_asignatura_bajo_4']}/{$totalAlumnos} ({$pctAsignaturaBajo4}%) con al menos una asignatura con promedio <4.0; {$indice['alumnos_nota_individual_bajo_4']}/{$totalAlumnos} ({$pctNotaIndividualBajo4}%) con alguna evaluación individual <4.0; {$indice['alumnos_ambos_criterios']} cumplen ambos criterios (promedio general y asignatura <4.0).",
        ];

        $textoAsignaturas = implode('; ', array_column($indice['resumen_asignaturas'], 'texto'));
        if ($textoAsignaturas !== '') {
            $lineas[] = "- Asignaturas (menor a mayor promedio): {$textoAsignaturas}.";
        }

        if ($incluirNominaCompacta && count($indice['estudiantes']) > 0) {
            $enRiesgo = array_values(array_filter($indice['estudiantes'], fn ($e) => $e['tiene_riesgo']));
            $sinRiesgo = array_values(array_filter($indice['estudiantes'], fn ($e) => ! $e['tiene_riesgo']));

            usort($enRiesgo, fn ($a, $b) => ($a['promedio'] ?? 7.1) <=> ($b['promedio'] ?? 7.1));
            usort($sinRiesgo, fn ($a, $b) => ($a['promedio'] ?? 7.1) <=> ($b['promedio'] ?? 7.1));

            $formatearItem = static function (array $est): string {
                $prom = $est['promedio'] ?? 'S/I';
                $rojas = count($est['asignaturas_rojas']) > 0
                    ? ' ('.implode(', ', $est['asignaturas_rojas']).')'
                    : '';

                return "{$est['token']} {$est['rut_token']} {$prom}{$rojas}";
            };

            if (count($enRiesgo) > 0) {
                $itemsRiesgo = array_map($formatearItem, $enRiesgo);
                $lineas[] = '- Estudiantes EN RIESGO académico (promedio general <4.0 o asignatura <4.0) ['.count($enRiesgo).']: '.implode(' | ', $itemsRiesgo).'.';
            } else {
                $lineas[] = '- Estudiantes EN RIESGO académico (promedio general <4.0 o asignatura <4.0): ninguno.';
            }

            if (count($sinRiesgo) > 0) {
                $itemsSinRiesgo = array_map($formatearItem, $sinRiesgo);
                $lineas[] = '- Estudiantes SIN RIESGO académico (todas sus asignaturas >=4.0; NO incluirlos en listas de riesgo) ['.count($sinRiesgo).']: '.implode(' | ', $itemsSinRiesgo).'.';
            }
        }

        return implode("\n", $lineas);
    }

    /**
     * Ejecuta una herramienta solicitada por el modelo con validación estricta de permisos y privacidad.
     */
    public function ejecutar(
        string $nombreTool,
        array $argumentos,
        User $user,
        Curso $curso,
        array $alcance,
        array $indice,
        PrivacidadService $privacidad
    ): string {
        $resultado = match ($nombreTool) {
            'listar_estudiantes_riesgo' => $this->toolListarEstudiantesRiesgo($argumentos, $alcance, $indice),
            'obtener_detalle_estudiante' => $this->toolObtenerDetalleEstudiante($argumentos, $alcance, $indice),
            'obtener_asistencia_curso' => $this->toolObtenerAsistenciaCurso($argumentos, $alcance, $indice),
            'comparar_semestres_curso' => $this->toolCompararSemestresCurso($argumentos, $indice),
            'buscar_nomina_curso' => $this->toolBuscarNominaCurso($argumentos, $alcance, $indice),
            'resumen_colegio_cursos' => $this->toolResumenColegioCursos($argumentos, $user, $curso),
            default => ['error' => 'Herramienta no disponible en el catálogo autorizado.'],
        };

        $json = json_encode($resultado, JSON_UNESCAPED_UNICODE);

        return $privacidad->ocultarContactos($json === false ? '{}' : $json);
    }

    private function toolListarEstudiantesRiesgo(array $args, array $alcance, array $indice): array
    {
        $umbral = isset($args['umbral_nota']) && is_numeric($args['umbral_nota'])
            ? max(1.0, min(7.0, (float) $args['umbral_nota']))
            : 4.0;
        $limite = isset($args['limite']) && is_numeric($args['limite'])
            ? max(1, min(20, (int) $args['limite']))
            : 12;
        $soloPromedioGeneral = (bool) ($args['solo_promedio_general'] ?? false);
        $asignaturaFiltro = $this->resolverNombreAsignatura(
            (string) ($args['asignatura'] ?? ''),
            array_column($indice['resumen_asignaturas'], 'nombre')
        );

        $puedeVerAsistencia = $alcance['asignaturas'] === null;
        $filtrados = [];

        foreach ($indice['estudiantes'] as $est) {
            if ($asignaturaFiltro !== null) {
                $asigData = $est['asignaturas'][$asignaturaFiltro] ?? null;
                if ($asigData === null || $asigData['promedio'] >= $umbral) {
                    continue;
                }

                $item = [
                    'alumno' => $est['token'],
                    'rut' => $est['rut_token'],
                    'promedio_asignatura' => $asigData['promedio'],
                    'notas_bajo_4_asignatura' => $asigData['notas_bajo_4'],
                    'promedio_general' => $est['promedio'],
                ];
                if ($puedeVerAsistencia && $est['asistencia_pct'] !== null) {
                    $item['asistencia_pct'] = $est['asistencia_pct'];
                }
                $filtrados[] = ['orden' => $asigData['promedio'], 'datos' => $item];

                continue;
            }

            $cumplePromedio = $est['promedio'] !== null && $est['promedio'] < $umbral;
            $asigsBajoUmbral = [];
            foreach ($est['asignaturas'] as $asigNombre => $datosAsig) {
                if ($datosAsig['promedio'] < $umbral) {
                    $asigsBajoUmbral[] = "{$asigNombre} ({$datosAsig['promedio']})";
                }
            }

            $cumple = $soloPromedioGeneral
                ? $cumplePromedio
                : ($cumplePromedio || count($asigsBajoUmbral) > 0);

            if (! $cumple) {
                continue;
            }

            $item = [
                'alumno' => $est['token'],
                'rut' => $est['rut_token'],
                'promedio_general' => $est['promedio'],
                'asignaturas_bajo_umbral' => $asigsBajoUmbral,
                'notas_bajo_4' => $est['notas_bajo_4'],
            ];
            if ($puedeVerAsistencia && $est['asistencia_pct'] !== null) {
                $item['asistencia_pct'] = $est['asistencia_pct'];
            }
            $filtrados[] = ['orden' => $est['promedio'] ?? 7.1, 'datos' => $item];
        }

        usort($filtrados, fn ($a, $b) => $a['orden'] <=> $b['orden']);
        $totalCoincidencias = count($filtrados);
        $seleccionados = array_slice(array_column($filtrados, 'datos'), 0, $limite);

        return [
            'umbral_nota' => $umbral,
            'asignatura_filtrada' => $asignaturaFiltro,
            'total_coincidencias' => $totalCoincidencias,
            'mostrados' => count($seleccionados),
            'estudiantes' => $seleccionados,
        ];
    }

    private function toolObtenerDetalleEstudiante(array $args, array $alcance, array $indice): array
    {
        $rawToken = trim((string) ($args['token_alumno'] ?? ''));
        $tokenNormalizado = $this->normalizarTokenAlumno($rawToken);

        if ($tokenNormalizado === null || ! isset($indice['por_token'][$tokenNormalizado])) {
            return [
                'error' => 'No se encontró un estudiante vigente con ese token en el curso actual.',
                'total_estudiantes_curso' => $indice['total_alumnos'],
            ];
        }

        $est = $indice['por_token'][$tokenNormalizado];
        $puedeVerAsistencia = $alcance['asignaturas'] === null;

        $asignaturasDetalle = [];
        foreach ($est['asignaturas'] as $asigNombre => $datosAsig) {
            $sem1 = $est['por_asignatura_semestre'][$asigNombre][1] ?? [];
            $sem2 = $est['por_asignatura_semestre'][$asigNombre][2] ?? [];
            $asignaturasDetalle[] = [
                'asignatura' => $asigNombre,
                'promedio' => $datosAsig['promedio'],
                'notas_bajo_4' => $datosAsig['notas_bajo_4'],
                'notas' => $datosAsig['notas'],
                'promedio_sem1' => count($sem1) > 0 ? round(array_sum($sem1) / count($sem1), 1) : null,
                'promedio_sem2' => count($sem2) > 0 ? round(array_sum($sem2) / count($sem2), 1) : null,
            ];
        }

        usort($asignaturasDetalle, fn ($a, $b) => $a['promedio'] <=> $b['promedio']);

        $respuesta = [
            'alumno' => $est['token'],
            'rut' => $est['rut_token'],
            'promedio_general' => $est['promedio'],
            'promedio_semestre_1' => $est['semestre_1'],
            'promedio_semestre_2' => $est['semestre_2'],
            'total_notas' => $est['total_notas'],
            'notas_bajo_4' => $est['notas_bajo_4'],
            'asignaturas' => $asignaturasDetalle,
        ];

        if ($puedeVerAsistencia) {
            $respuesta['asistencia_pct'] = $est['asistencia_pct'];
        }

        return $respuesta;
    }

    private function toolObtenerAsistenciaCurso(array $args, array $alcance, array $indice): array
    {
        if ($alcance['asignaturas'] !== null) {
            return [
                'restringido' => true,
                'mensaje' => 'El detalle individual de asistencia está disponible solo para Profesor Jefe y Administrador.',
                'asistencia_promedio_curso' => $indice['asistencia_promedio'],
            ];
        }

        $umbral = isset($args['umbral_asistencia']) && is_numeric($args['umbral_asistencia'])
            ? max(1.0, min(100.0, (float) $args['umbral_asistencia']))
            : 85.0;
        $limite = isset($args['limite']) && is_numeric($args['limite'])
            ? max(1, min(20, (int) $args['limite']))
            : 15;

        $conDato = 0;
        $bajoUmbral = [];
        foreach ($indice['estudiantes'] as $est) {
            if ($est['asistencia_pct'] === null) {
                continue;
            }
            $conDato++;
            if ($est['asistencia_pct'] < $umbral) {
                $bajoUmbral[] = [
                    'alumno' => $est['token'],
                    'rut' => $est['rut_token'],
                    'asistencia_pct' => $est['asistencia_pct'],
                    'promedio_general' => $est['promedio'],
                    'riesgo_academico' => $est['tiene_riesgo'],
                ];
            }
        }

        usort($bajoUmbral, fn ($a, $b) => $a['asistencia_pct'] <=> $b['asistencia_pct']);

        return [
            'umbral_asistencia_pct' => $umbral,
            'asistencia_promedio_curso' => $indice['asistencia_promedio'],
            'estudiantes_con_registro' => $conDato,
            'total_bajo_umbral' => count($bajoUmbral),
            'estudiantes' => array_slice($bajoUmbral, 0, $limite),
        ];
    }

    private function toolCompararSemestresCurso(array $args, array $indice): array
    {
        $asignaturaFiltro = $this->resolverNombreAsignatura(
            (string) ($args['asignatura'] ?? ''),
            array_column($indice['resumen_asignaturas'], 'nombre')
        );

        $notasS1 = [];
        $notasS2 = [];
        $variaciones = [];

        foreach ($indice['estudiantes'] as $est) {
            if ($asignaturaFiltro !== null) {
                $s1Vals = $est['por_asignatura_semestre'][$asignaturaFiltro][1] ?? [];
                $s2Vals = $est['por_asignatura_semestre'][$asignaturaFiltro][2] ?? [];
            } else {
                $s1Vals = [];
                $s2Vals = [];
                foreach ($est['por_asignatura_semestre'] as $porSem) {
                    $s1Vals = array_merge($s1Vals, $porSem[1] ?? []);
                    $s2Vals = array_merge($s2Vals, $porSem[2] ?? []);
                }
            }

            $notasS1 = array_merge($notasS1, $s1Vals);
            $notasS2 = array_merge($notasS2, $s2Vals);

            if (count($s1Vals) > 0 && count($s2Vals) > 0) {
                $p1 = round(array_sum($s1Vals) / count($s1Vals), 1);
                $p2 = round(array_sum($s2Vals) / count($s2Vals), 1);
                $delta = round($p2 - $p1, 1);
                $variaciones[] = [
                    'alumno' => $est['token'],
                    'semestre_1' => $p1,
                    'semestre_2' => $p2,
                    'variacion' => $delta,
                ];
            }
        }

        $resumenSem = function (array $vals): array {
            $total = count($vals);
            if ($total === 0) {
                return ['total_notas' => 0, 'promedio' => null, 'pct_bajo_4' => null];
            }
            $rojos = count(array_filter($vals, fn ($v) => $v < 4.0));

            return [
                'total_notas' => $total,
                'promedio' => round(array_sum($vals) / $total, 1),
                'pct_bajo_4' => round(($rojos / $total) * 100),
            ];
        };

        $mayoresBajas = array_values(array_filter($variaciones, fn ($v) => $v['variacion'] < 0));
        usort($mayoresBajas, fn ($a, $b) => $a['variacion'] <=> $b['variacion']);

        $mayoresAlzas = array_values(array_filter($variaciones, fn ($v) => $v['variacion'] > 0));
        usort($mayoresAlzas, fn ($a, $b) => $b['variacion'] <=> $a['variacion']);

        return [
            'asignatura_filtrada' => $asignaturaFiltro,
            'semestre_1' => $resumenSem($notasS1),
            'semestre_2' => $resumenSem($notasS2),
            'mayores_bajas' => array_slice($mayoresBajas, 0, 6),
            'mayores_alzas' => array_slice($mayoresAlzas, 0, 5),
        ];
    }

    private function toolBuscarNominaCurso(array $args, array $alcance, array $indice): array
    {
        $orden = (string) ($args['orden'] ?? 'menor_promedio');
        $puedeVerAsistencia = $alcance['asignaturas'] === null;
        if (! in_array($orden, ['menor_promedio', 'mayor_promedio', 'menor_asistencia'], true)) {
            $orden = 'menor_promedio';
        }
        if ($orden === 'menor_asistencia' && ! $puedeVerAsistencia) {
            $orden = 'menor_promedio';
        }

        $limite = isset($args['limite']) && is_numeric($args['limite'])
            ? max(1, min(15, (int) $args['limite']))
            : 10;
        $pagina = isset($args['pagina']) && is_numeric($args['pagina'])
            ? max(1, (int) $args['pagina'])
            : 1;

        $lista = $indice['estudiantes'];
        usort($lista, function ($a, $b) use ($orden) {
            return match ($orden) {
                'mayor_promedio' => ($b['promedio'] ?? -1.0) <=> ($a['promedio'] ?? -1.0),
                'menor_asistencia' => ($a['asistencia_pct'] ?? 101.0) <=> ($b['asistencia_pct'] ?? 101.0),
                default => ($a['promedio'] ?? 7.1) <=> ($b['promedio'] ?? 7.1),
            };
        });

        $total = count($lista);
        $offset = ($pagina - 1) * $limite;
        $slice = array_slice($lista, $offset, $limite);

        $items = array_map(function ($est) use ($puedeVerAsistencia) {
            $fila = [
                'alumno' => $est['token'],
                'rut' => $est['rut_token'],
                'promedio' => $est['promedio'],
                'asignaturas_bajo_4' => $est['asignaturas_rojas'],
            ];
            if ($puedeVerAsistencia && $est['asistencia_pct'] !== null) {
                $fila['asistencia_pct'] = $est['asistencia_pct'];
            }

            return $fila;
        }, $slice);

        return [
            'orden' => $orden,
            'pagina' => $pagina,
            'total_estudiantes' => $total,
            'total_paginas' => max(1, (int) ceil($total / $limite)),
            'estudiantes' => $items,
        ];
    }

    private function toolResumenColegioCursos(array $args, User $user, Curso $cursoActual): array
    {
        $esAdmin = $user->hasRole('Administrador');
        $nivelFiltro = trim((string) ($args['nivel'] ?? ''));

        $queryCursos = Curso::query()
            ->where('anioEscolar', $cursoActual->anioEscolar)
            ->orderBy('nivel')
            ->orderBy('letra');

        if ($nivelFiltro !== '' && preg_match('/^\d{1,2}$/', $nivelFiltro)) {
            $queryCursos->where('nivel', $nivelFiltro);
        }

        $asignaturasPorCursoPermitidas = [];

        if (! $esAdmin) {
            $cursosJefeIds = $user->hasRole('Profesor Jefe')
                ? Curso::where('profesor_jefe_id', $user->id)->pluck('id')->all()
                : [];

            $asignaturasDocente = $user->hasRole('Profesor de Asignatura')
                ? DB::table('asignatura_curso')
                    ->where('profesor_id', $user->id)
                    ->get(['id', 'curso_id'])
                : collect();

            foreach ($asignaturasDocente as $fila) {
                $asignaturasPorCursoPermitidas[$fila->curso_id][] = $fila->id;
            }

            $cursosPermitidos = array_values(array_unique(array_merge(
                $cursosJefeIds,
                array_keys($asignaturasPorCursoPermitidas)
            )));

            if ($cursosPermitidos === []) {
                return [
                    'alcance' => 'docente',
                    'total_cursos' => 0,
                    'cursos' => [],
                ];
            }

            $queryCursos->whereIn('id', $cursosPermitidos);
        }

        $cursos = $queryCursos->get(['id', 'nivel', 'letra', 'anioEscolar', 'profesor_jefe_id']);
        $cursoIds = $cursos->pluck('id')->all();

        if ($cursoIds === []) {
            return [
                'alcance' => $esAdmin ? 'colegio_completo' : 'cursos_docente',
                'total_cursos' => 0,
                'cursos' => [],
            ];
        }

        $matriculasStats = DB::table('matriculas')
            ->whereIn('curso_id', $cursoIds)
            ->where('vigente', true)
            ->groupBy('curso_id')
            ->selectRaw('curso_id, COUNT(*) as total_alumnos, AVG(asistencia_pct) as asistencia_prom')
            ->get()
            ->keyBy('curso_id');

        $calificacionesQuery = DB::table('calificaciones')
            ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
            ->join('asignatura_curso', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
            ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
            ->whereIn('matriculas.curso_id', $cursoIds)
            ->where('matriculas.vigente', true)
            ->whereColumn('asignatura_curso.curso_id', 'matriculas.curso_id')
            ->whereBetween('calificaciones.valor', [1.0, 7.0])
            ->select(
                'matriculas.curso_id',
                'asignatura_curso.id as asignatura_curso_id',
                'asignaturas.nombre as asignatura_nombre',
                DB::raw('COUNT(*) as total_notas'),
                DB::raw('SUM(CASE WHEN calificaciones.valor < 4.0 THEN 1 ELSE 0 END) as notas_bajo_4'),
                DB::raw('AVG(calificaciones.valor) as promedio')
            )
            ->groupBy('matriculas.curso_id', 'asignatura_curso.id', 'asignaturas.nombre')
            ->get();

        $resumenCursos = [];
        foreach ($cursos as $curso) {
            $esJefeDeEste = $esAdmin || ($user->hasRole('Profesor Jefe') && (string) $curso->profesor_jefe_id === (string) $user->id);
            $asigsPermitidas = $esJefeDeEste ? null : ($asignaturasPorCursoPermitidas[$curso->id] ?? []);

            $filasCurso = $calificacionesQuery->filter(function ($fila) use ($curso, $asigsPermitidas) {
                if ((string) $fila->curso_id !== (string) $curso->id) {
                    return false;
                }

                return $asigsPermitidas === null || in_array($fila->asignatura_curso_id, $asigsPermitidas, true);
            });

            $totalNotas = 0;
            $notasBajo4 = 0;
            $sumaPonderada = 0.0;
            $asigCritica = null;
            $peorPromedio = 8.0;

            foreach ($filasCurso as $fila) {
                $n = (int) $fila->total_notas;
                $promAsig = round((float) $fila->promedio, 1);
                $totalNotas += $n;
                $notasBajo4 += (int) $fila->notas_bajo_4;
                $sumaPonderada += ((float) $fila->promedio) * $n;

                if ($promAsig < $peorPromedio) {
                    $peorPromedio = $promAsig;
                    $asigCritica = "{$fila->asignatura_nombre} ({$promAsig})";
                }
            }

            $matStat = $matriculasStats->get($curso->id);
            $promedioCurso = $totalNotas > 0 ? round($sumaPonderada / $totalNotas, 1) : null;
            $pctBajo4 = $totalNotas > 0 ? round(($notasBajo4 / $totalNotas) * 100) : 0;

            $filaResumen = [
                'curso' => "{$curso->nivel}° Medio {$curso->letra}",
                'estudiantes' => (int) ($matStat->total_alumnos ?? 0),
                'promedio' => $promedioCurso,
                'pct_notas_bajo_4' => $pctBajo4,
                'asignatura_mas_critica' => $asigCritica,
            ];

            if ($esJefeDeEste && $matStat && $matStat->asistencia_prom !== null) {
                $filaResumen['asistencia_promedio_pct'] = round((float) $matStat->asistencia_prom, 1);
            }

            $resumenCursos[] = $filaResumen;
        }

        usort($resumenCursos, fn ($a, $b) => ($a['promedio'] ?? 7.1) <=> ($b['promedio'] ?? 7.1));

        return [
            'alcance' => $esAdmin ? 'colegio_completo' : 'cursos_docente',
            'anio_escolar' => $cursoActual->anioEscolar,
            'total_cursos' => count($resumenCursos),
            'cursos' => $resumenCursos,
        ];
    }

    private function normalizarTokenAlumno(string $raw): ?string
    {
        if (preg_match('/(\d{1,3})/', $raw, $m)) {
            return '[ALUMNO_'.((int) $m[1]).']';
        }

        return null;
    }

    private function resolverNombreAsignatura(string $busqueda, array $disponibles): ?string
    {
        $limpia = trim($busqueda);
        if ($limpia === '' || $disponibles === []) {
            return null;
        }

        $objetivo = Str::lower(Str::ascii($limpia));

        foreach ($disponibles as $nombre) {
            if (Str::lower(Str::ascii($nombre)) === $objetivo) {
                return $nombre;
            }
        }

        foreach ($disponibles as $nombre) {
            $norm = Str::lower(Str::ascii($nombre));
            if (str_contains($norm, $objetivo) || str_contains($objetivo, $norm)) {
                return $nombre;
            }
        }

        return null;
    }
}
