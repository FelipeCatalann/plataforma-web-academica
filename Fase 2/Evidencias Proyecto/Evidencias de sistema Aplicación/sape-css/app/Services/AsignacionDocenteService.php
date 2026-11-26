<?php

namespace App\Services;

use App\Models\Asignatura;
use App\Models\Curso;
use App\Models\RegistroBitacora;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class AsignacionDocenteService
{
    public const ROLES_DOCENTES = ['Profesor Jefe', 'Profesor de Asignatura'];

    public function normalizarTexto(string $texto): string
    {
        $ascii = Str::ascii(trim($texto));
        $limpio = preg_replace('/\s+/', ' ', mb_strtolower($ascii)) ?? '';

        return trim($limpio);
    }

    public function limpiarSegmentoCorreo(string $texto): string
    {
        $ascii = Str::ascii($texto);
        $limpio = preg_replace('/[^a-z0-9\s]/', '', mb_strtolower($ascii)) ?? '';

        return trim($limpio);
    }

    /**
     * Genera correo institucional siguiendo la convención del colegio:
     * {2 letras nombre}{primer apellido}{1 letra segundo apellido}.{jefe|asig}@colegio.cl
     *
     * @param  list<string>  $correosReservados
     */
    public function generarCorreoInstitucional(
        string $nombre,
        string $primerApellido,
        string $segundoApellido,
        string $rolInicial,
        array $correosReservados = []
    ): string {
        $nombrePartes = preg_split('/\s+/', $this->limpiarSegmentoCorreo($nombre)) ?: [];
        $nombreLimpio = $nombrePartes[0] ?? '';
        $apellidoPaternoLimpio = str_replace(' ', '', $this->limpiarSegmentoCorreo($primerApellido));
        $apellidoMaternoLimpio = str_replace(' ', '', $this->limpiarSegmentoCorreo($segundoApellido));

        $inicialesNombre = substr($nombreLimpio, 0, 2);
        $inicialSegundoApellido = substr($apellidoMaternoLimpio, 0, 1);
        $baseUsuario = $inicialesNombre.$apellidoPaternoLimpio.$inicialSegundoApellido;

        if ($baseUsuario === '') {
            $baseUsuario = 'docente';
        }

        $sufijoRol = $rolInicial === 'Profesor Jefe' ? 'jefe' : 'asig';
        $reservados = array_map(static fn ($c) => mb_strtolower(trim((string) $c)), $correosReservados);
        $existentes = User::query()
            ->pluck('email')
            ->map(static fn ($c) => mb_strtolower(trim((string) $c)))
            ->all();
        $ocupados = array_flip(array_merge($existentes, $reservados));

        $candidato = "{$baseUsuario}.{$sufijoRol}@colegio.cl";
        $correlativo = 2;
        while (isset($ocupados[$candidato])) {
            $candidato = "{$baseUsuario}{$correlativo}.{$sufijoRol}@colegio.cl";
            $correlativo++;
        }

        return $candidato;
    }

    /**
     * Prioriza el correo proveniente del Excel si es válido; en caso contrario genera
     * el correo institucional automático.
     *
     * @param  list<string>  $correosReservados
     * @return array{email: string, origen_email: string}
     */
    public function resolverCorreoDocenteNuevo(
        ?string $correoExcel,
        string $nombre,
        string $primerApellido,
        string $segundoApellido,
        string $rolInicial,
        array $correosReservados = []
    ): array {
        $limpio = mb_strtolower(trim((string) $correoExcel));
        if ($limpio !== '' && filter_var($limpio, FILTER_VALIDATE_EMAIL) !== false) {
            return [
                'email' => $limpio,
                'origen_email' => 'excel',
            ];
        }

        return [
            'email' => $this->generarCorreoInstitucional(
                $nombre,
                $primerApellido,
                $segundoApellido,
                $rolInicial,
                $correosReservados
            ),
            'origen_email' => 'autogenerado',
        ];
    }

    /**
     * Genera una contraseña temporal criptográficamente segura (12 caracteres)
     * cumpliendo mayúscula, minúscula, número y signo especial.
     */
    public function generarPasswordTemporalSegura(int $longitud = 12): string
    {
        $mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $minusculas = 'abcdefghijkmnopqrstuvwxyz';
        $numeros = '23456789';
        $especiales = '!@#$%&*';
        $todos = $mayusculas.$minusculas.$numeros.$especiales;

        $caracteres = [
            $mayusculas[random_int(0, strlen($mayusculas) - 1)],
            $minusculas[random_int(0, strlen($minusculas) - 1)],
            $numeros[random_int(0, strlen($numeros) - 1)],
            $especiales[random_int(0, strlen($especiales) - 1)],
        ];

        $objetivo = max(8, $longitud);
        while (count($caracteres) < $objetivo) {
            $caracteres[] = $todos[random_int(0, strlen($todos) - 1)];
        }

        for ($i = count($caracteres) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$caracteres[$i], $caracteres[$j]] = [$caracteres[$j], $caracteres[$i]];
        }

        return implode('', $caracteres);
    }

    /**
     * Crea un docente nuevo dejándolo verificado de inmediato (sin verificación de correo).
     */
    public function crearDocente(
        string $nombre,
        string $primerApellido,
        string $segundoApellido,
        string $email,
        string $passwordPlano,
        string $rolInicial
    ): User {
        $nombreCompleto = collect([
            trim($nombre),
            trim($primerApellido),
            trim($segundoApellido),
        ])->filter(static fn ($parte) => $parte !== '')->implode(' ');

        $profesor = new User([
            'name' => $nombreCompleto,
            'email' => mb_strtolower(trim($email)),
            'password' => Hash::make($passwordPlano),
        ]);
        $profesor->email_verified_at = now();
        $profesor->save();

        Role::firstOrCreate(['name' => $rolInicial, 'guard_name' => 'web']);
        $profesor->assignRole($rolInicial);

        return $profesor;
    }

    /**
     * Aplica una asignación unitaria (jefatura o asignatura), preservando la regla
     * de jefatura única y evitando duplicados en asignatura_curso.
     *
     * @return array{tipo: string, curso_id: string, asignatura_id: ?string}
     */
    public function aplicarAsignacionUnitaria(
        User $profesor,
        Curso $curso,
        string $tipoRol,
        ?Asignatura $asignatura = null
    ): array {
        if ($tipoRol === 'jefe') {
            Curso::where('profesor_jefe_id', $profesor->id)
                ->where('id', '!=', $curso->id)
                ->update(['profesor_jefe_id' => null]);

            $curso->profesor_jefe_id = $profesor->id;
            $curso->save();

            Role::firstOrCreate(['name' => 'Profesor Jefe', 'guard_name' => 'web']);
            $profesor->assignRole('Profesor Jefe');

            return [
                'tipo' => 'jefe',
                'curso_id' => (string) $curso->id,
                'asignatura_id' => null,
            ];
        }

        if (! $asignatura) {
            throw ValidationException::withMessages([
                'asignatura_id' => 'Debes seleccionar una asignatura válida.',
            ]);
        }

        $nombreNormalizado = mb_strtolower(trim((string) $asignatura->nombre));

        $filasExistentes = DB::table('asignatura_curso')
            ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
            ->leftJoin('calificaciones', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
            ->where('asignatura_curso.curso_id', $curso->id)
            ->where(function ($query) use ($asignatura, $nombreNormalizado) {
                $query->where('asignatura_curso.asignatura_id', $asignatura->id)
                    ->orWhereRaw('LOWER(TRIM(asignaturas.nombre)) = ?', [$nombreNormalizado]);
            })
            ->select('asignatura_curso.id', DB::raw('COUNT(calificaciones.id) as total_notas'))
            ->groupBy('asignatura_curso.id')
            ->orderByDesc('total_notas')
            ->get();

        if ($filasExistentes->isNotEmpty()) {
            $filaPrincipal = $filasExistentes->first();

            DB::table('asignatura_curso')
                ->where('id', $filaPrincipal->id)
                ->update([
                    'profesor_id' => $profesor->id,
                    'updated_at' => now(),
                ]);

            $idsDuplicados = $filasExistentes->slice(1)->pluck('id')->all();
            if (! empty($idsDuplicados)) {
                DB::table('calificaciones')
                    ->whereIn('asignatura_curso_id', $idsDuplicados)
                    ->update(['asignatura_curso_id' => $filaPrincipal->id]);

                DB::table('asignatura_curso')
                    ->whereIn('id', $idsDuplicados)
                    ->delete();
            }
        } else {
            DB::table('asignatura_curso')->insert([
                'id' => Str::uuid()->toString(),
                'curso_id' => $curso->id,
                'asignatura_id' => $asignatura->id,
                'profesor_id' => $profesor->id,
                'ponderacion' => 1.00,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Role::firstOrCreate(['name' => 'Profesor de Asignatura', 'guard_name' => 'web']);
        $profesor->assignRole('Profesor de Asignatura');

        return [
            'tipo' => 'asignatura',
            'curso_id' => (string) $curso->id,
            'asignatura_id' => (string) $asignatura->id,
        ];
    }

    /**
     * Aplica asignaciones múltiples desde el formulario manual rápido (1 docente en 1..N cursos × 1..N asignaturas).
     *
     * @param  list<string>  $cursoIds
     * @param  list<string>  $asignaturaIds
     * @param  list<string>  $asignaturaNombres
     * @return array{aplicadas: int, omitidas: int, cursos_afectados: int}
     */
    public function aplicarAsignacionMultiple(
        User $admin,
        User $profesor,
        array $cursoIds,
        string $tipoRol,
        array $asignaturaIds = [],
        array $asignaturaNombres = []
    ): array {
        $cursoIdsUnicos = array_values(array_unique(array_filter(array_map('strval', $cursoIds))));
        if ($cursoIdsUnicos === []) {
            throw ValidationException::withMessages([
                'curso_id' => 'Selecciona al menos un curso válido.',
            ]);
        }

        if ($tipoRol === 'jefe' && count($cursoIdsUnicos) > 1) {
            throw ValidationException::withMessages([
                'curso_ids' => 'Un docente solo puede ser Profesor Jefe de un único curso.',
            ]);
        }

        $cursos = Curso::with('asignaturas')
            ->whereIn('id', $cursoIdsUnicos)
            ->get()
            ->keyBy('id');

        if ($cursos->count() !== count($cursoIdsUnicos)) {
            throw ValidationException::withMessages([
                'curso_ids' => 'Uno o más cursos seleccionados ya no existen.',
            ]);
        }

        if ($tipoRol === 'jefe') {
            $curso = $cursos->first();
            DB::transaction(function () use ($profesor, $curso) {
                $this->aplicarAsignacionUnitaria($profesor, $curso, 'jefe');
            });

            return [
                'aplicadas' => 1,
                'omitidas' => 0,
                'cursos_afectados' => 1,
            ];
        }

        $asignaturasPorId = $asignaturaIds !== []
            ? Asignatura::whereIn('id', $asignaturaIds)->get()
            : collect();

        $nombresObjetivo = collect($asignaturaNombres)
            ->merge($asignaturasPorId->pluck('nombre'))
            ->map(fn ($n) => $this->normalizarTexto((string) $n))
            ->filter()
            ->unique()
            ->values();

        if ($nombresObjetivo->isEmpty() && $asignaturasPorId->isEmpty()) {
            throw ValidationException::withMessages([
                'asignatura_id' => 'Selecciona al menos una asignatura.',
            ]);
        }

        $esSeleccionMultiple = count($cursoIdsUnicos) > 1 || $nombresObjetivo->count() > 1;
        $aplicadas = 0;
        $omitidas = 0;
        $cursosTocados = [];

        DB::transaction(function () use (
            $cursos,
            $cursoIdsUnicos,
            $profesor,
            $asignaturasPorId,
            $nombresObjetivo,
            $esSeleccionMultiple,
            &$aplicadas,
            &$omitidas,
            &$cursosTocados
        ) {
            foreach ($cursoIdsUnicos as $cursoId) {
                /** @var Curso $curso */
                $curso = $cursos->get($cursoId);
                $asignaturasDelCurso = $curso->asignaturas;

                if (! $esSeleccionMultiple && $asignaturasPorId->count() === 1) {
                    $this->aplicarAsignacionUnitaria($profesor, $curso, 'asignatura', $asignaturasPorId->first());
                    $aplicadas++;
                    $cursosTocados[$curso->id] = true;

                    continue;
                }

                foreach ($nombresObjetivo as $nombreNorm) {
                    $coincidencia = $asignaturasDelCurso->first(
                        fn (Asignatura $a) => $this->normalizarTexto((string) $a->nombre) === $nombreNorm
                    );

                    if ($coincidencia) {
                        $this->aplicarAsignacionUnitaria($profesor, $curso, 'asignatura', $coincidencia);
                        $aplicadas++;
                        $cursosTocados[$curso->id] = true;
                    } else {
                        $omitidas++;
                    }
                }
            }
        });

        if ($aplicadas === 0) {
            throw ValidationException::withMessages([
                'asignatura_ids' => 'Ninguno de los cursos seleccionados imparte las asignaturas marcadas.',
            ]);
        }

        $this->registrarBitacora($admin, 'ASIGNACION_MULTIPLE_DOCENTE', [
            'profesor_id' => $profesor->id,
            'tipo_rol' => $tipoRol,
            'cursos_count' => count($cursosTocados),
            'asignaciones_aplicadas' => $aplicadas,
            'combinaciones_omitidas' => $omitidas,
        ]);

        return [
            'aplicadas' => $aplicadas,
            'omitidas' => $omitidas,
            'cursos_afectados' => count($cursosTocados),
        ];
    }

    /**
     * Confirma y aplica atómicamente el lote aprobado en el Menú de Comprobación.
     *
     * @param  list<array<string, mixed>>  $docentesNuevos
     * @param  list<array<string, mixed>>  $asignaciones
     * @param  array<string, mixed>  $metadatosOrigen
     * @return array{
     *     resumen: array{docentes_creados: int, asignaciones_aplicadas: int, jefaturas_aplicadas: int, subsectores_aplicados: int},
     *     credenciales_creadas: list<array{id: int, nombre: string, email: string, rol: string, password_temporal: string, origen_email: string}>
     * }
     */
    public function aplicarLoteConfirmado(
        User $admin,
        array $docentesNuevos,
        array $asignaciones,
        array $metadatosOrigen = []
    ): array {
        if ($docentesNuevos === [] && $asignaciones === []) {
            throw ValidationException::withMessages([
                'lote' => 'Selecciona al menos un docente nuevo o una asignación para confirmar.',
            ]);
        }

        // 1. Validar docentes nuevos (sin duplicar correos contra BD ni dentro del lote)
        $correosExistentes = User::query()
            ->pluck('email')
            ->map(static fn ($e) => mb_strtolower(trim((string) $e)))
            ->flip()
            ->all();

        $correosEnLote = [];
        $tempIdsValidos = [];
        $docentesNormalizados = [];

        foreach ($docentesNuevos as $idx => $doc) {
            $tempId = trim((string) ($doc['temp_id'] ?? ''));
            $nombre = trim((string) ($doc['nombre'] ?? ''));
            $primerApellido = trim((string) ($doc['primer_apellido'] ?? ''));
            $segundoApellido = trim((string) ($doc['segundo_apellido'] ?? ''));
            $rolInicial = trim((string) ($doc['rol_inicial'] ?? 'Profesor de Asignatura'));
            $emailSolicitado = mb_strtolower(trim((string) ($doc['email'] ?? '')));

            if ($tempId === '' || isset($tempIdsValidos[$tempId])) {
                throw ValidationException::withMessages([
                    "docentes_nuevos.{$idx}" => 'Identificador temporal de docente inválido o repetido.',
                ]);
            }

            if ($nombre === '' || $primerApellido === '') {
                throw ValidationException::withMessages([
                    "docentes_nuevos.{$idx}.nombre" => 'Cada docente nuevo requiere al menos nombre y primer apellido.',
                ]);
            }

            if (! in_array($rolInicial, self::ROLES_DOCENTES, true)) {
                throw ValidationException::withMessages([
                    "docentes_nuevos.{$idx}.rol_inicial" => 'Rol inicial de docente no permitido.',
                ]);
            }

            $resEmail = $this->resolverCorreoDocenteNuevo(
                $emailSolicitado,
                $nombre,
                $primerApellido,
                $segundoApellido,
                $rolInicial,
                array_keys($correosEnLote)
            );
            $emailFinal = $resEmail['email'];

            if (isset($correosExistentes[$emailFinal])) {
                throw ValidationException::withMessages([
                    "docentes_nuevos.{$idx}.email" => "El correo {$emailFinal} ya pertenece a un usuario registrado.",
                ]);
            }

            if (isset($correosEnLote[$emailFinal])) {
                throw ValidationException::withMessages([
                    "docentes_nuevos.{$idx}.email" => "El correo {$emailFinal} está repetido en el lote a confirmar.",
                ]);
            }

            $correosEnLote[$emailFinal] = true;
            $tempIdsValidos[$tempId] = true;

            $docentesNormalizados[] = [
                'temp_id' => $tempId,
                'nombre' => $nombre,
                'primer_apellido' => $primerApellido,
                'segundo_apellido' => $segundoApellido,
                'rol_inicial' => $rolInicial,
                'email' => $emailFinal,
                'origen_email' => (string) ($doc['origen_email'] ?? $resEmail['origen_email']),
            ];
        }

        // 2. Validar asignaciones y conflictos de jefatura única
        $cursosExistentes = Curso::query()->get()->keyBy('id');
        $asignaturasExistentes = Asignatura::query()->get()->keyBy('id');
        $usuariosExistentes = User::query()->get()->keyBy(static fn (User $u) => (string) $u->id);

        $jefesPorCurso = [];
        $cursosPorJefe = [];
        $asignacionesLimpias = [];

        foreach ($asignaciones as $idx => $asig) {
            $profRef = trim((string) ($asig['profesor_ref'] ?? ''));
            $cursoId = trim((string) ($asig['curso_id'] ?? ''));
            $tipoRol = trim((string) ($asig['tipo_rol'] ?? ''));
            $asignaturaId = isset($asig['asignatura_id']) && $asig['asignatura_id'] !== ''
                ? trim((string) $asig['asignatura_id'])
                : null;

            $esDocenteNuevo = isset($tempIdsValidos[$profRef]);
            if (! $esDocenteNuevo && ! $usuariosExistentes->has($profRef)) {
                throw ValidationException::withMessages([
                    "asignaciones.{$idx}.profesor_ref" => 'El docente seleccionado en la asignación no existe ni está marcado para creación.',
                ]);
            }

            if (! $cursosExistentes->has($cursoId)) {
                throw ValidationException::withMessages([
                    "asignaciones.{$idx}.curso_id" => 'Uno de los cursos seleccionados ya no existe en el sistema.',
                ]);
            }

            if (! in_array($tipoRol, ['jefe', 'asignatura'], true)) {
                throw ValidationException::withMessages([
                    "asignaciones.{$idx}.tipo_rol" => 'Tipo de asignación no válido.',
                ]);
            }

            if ($tipoRol === 'asignatura' && ($asignaturaId === null || ! $asignaturasExistentes->has($asignaturaId))) {
                throw ValidationException::withMessages([
                    "asignaciones.{$idx}.asignatura_id" => 'Cada asignación de subsector debe indicar una asignatura válida.',
                ]);
            }

            if ($tipoRol === 'jefe') {
                if (isset($jefesPorCurso[$cursoId]) && $jefesPorCurso[$cursoId] !== $profRef) {
                    $cursoConf = $cursosExistentes->get($cursoId);
                    throw ValidationException::withMessages([
                        "asignaciones.{$idx}.curso_id" => "Conflicto: hay más de un Profesor Jefe asignado al {$cursoConf->nivel}° Medio {$cursoConf->letra}.",
                    ]);
                }
                if (isset($cursosPorJefe[$profRef]) && $cursosPorJefe[$profRef] !== $cursoId) {
                    throw ValidationException::withMessages([
                        "asignaciones.{$idx}.profesor_ref" => 'Conflicto: un mismo docente no puede ser Profesor Jefe de dos cursos distintos.',
                    ]);
                }
                $jefesPorCurso[$cursoId] = $profRef;
                $cursosPorJefe[$profRef] = $cursoId;
            }

            $asignacionesLimpias[] = [
                'profesor_ref' => $profRef,
                'curso_id' => $cursoId,
                'tipo_rol' => $tipoRol,
                'asignatura_id' => $tipoRol === 'asignatura' ? $asignaturaId : null,
            ];
        }

        // 3. Ejecución atómica en una única transacción
        $credencialesCreadas = [];
        $jefaturasAplicadas = 0;
        $subsectoresAplicados = 0;

        DB::transaction(function () use (
            $admin,
            $docentesNormalizados,
            $asignacionesLimpias,
            $cursosExistentes,
            $asignaturasExistentes,
            $usuariosExistentes,
            $metadatosOrigen,
            &$credencialesCreadas,
            &$jefaturasAplicadas,
            &$subsectoresAplicados
        ) {
            $mapaNuevos = [];

            foreach ($docentesNormalizados as $doc) {
                $passwordTemporal = $this->generarPasswordTemporalSegura();
                $nuevoUsuario = $this->crearDocente(
                    $doc['nombre'],
                    $doc['primer_apellido'],
                    $doc['segundo_apellido'],
                    $doc['email'],
                    $passwordTemporal,
                    $doc['rol_inicial']
                );

                $mapaNuevos[$doc['temp_id']] = $nuevoUsuario;
                $credencialesCreadas[] = [
                    'id' => (int) $nuevoUsuario->id,
                    'nombre' => (string) $nuevoUsuario->name,
                    'email' => (string) $nuevoUsuario->email,
                    'rol' => $doc['rol_inicial'],
                    'password_temporal' => $passwordTemporal,
                    'origen_email' => $doc['origen_email'],
                ];
            }

            foreach ($asignacionesLimpias as $asig) {
                /** @var User $profesor */
                $profesor = $mapaNuevos[$asig['profesor_ref']] ?? $usuariosExistentes->get($asig['profesor_ref']);
                /** @var Curso $curso */
                $curso = $cursosExistentes->get($asig['curso_id']);
                $asignatura = $asig['asignatura_id'] ? $asignaturasExistentes->get($asig['asignatura_id']) : null;

                $this->aplicarAsignacionUnitaria($profesor, $curso, $asig['tipo_rol'], $asignatura);

                if ($asig['tipo_rol'] === 'jefe') {
                    $jefaturasAplicadas++;
                } else {
                    $subsectoresAplicados++;
                }
            }

            // Auditoría segura (jamás incluye contraseñas)
            $this->registrarBitacora($admin, 'APLICAR_LOTE_ASIGNACION_DOCENTE', array_filter([
                'canal' => (string) ($metadatosOrigen['canal'] ?? 'agente_ia'),
                'archivo_nombre' => $metadatosOrigen['nombre_archivo'] ?? null,
                'archivo_checksum' => $metadatosOrigen['checksum'] ?? null,
                'docentes_creados_ids' => array_column($credencialesCreadas, 'id'),
                'docentes_creados_count' => count($credencialesCreadas),
                'jefaturas_aplicadas' => $jefaturasAplicadas,
                'subsectores_aplicados' => $subsectoresAplicados,
                'asignaciones_total' => $jefaturasAplicadas + $subsectoresAplicados,
            ], static fn ($v) => $v !== null));
        });

        return [
            'resumen' => [
                'docentes_creados' => count($credencialesCreadas),
                'asignaciones_aplicadas' => $jefaturasAplicadas + $subsectoresAplicados,
                'jefaturas_aplicadas' => $jefaturasAplicadas,
                'subsectores_aplicados' => $subsectoresAplicados,
            ],
            'credenciales_creadas' => $credencialesCreadas,
        ];
    }

    private function registrarBitacora(User $admin, string $accion, array $metadatos): void
    {
        $now = now();
        RegistroBitacora::create([
            'id' => (string) Str::uuid(),
            'user_id' => $admin->id,
            'accion' => $accion,
            'recursoTipo' => 'CargaAcademica',
            'recursoId' => (string) Str::uuid(),
            'metadatos' => $metadatos,
            'hashIntegridad' => hash('sha256', (json_encode($metadatos, JSON_UNESCAPED_UNICODE) ?: '{}').'|'.$now->toIso8601String()),
            'creadoEn' => $now,
        ]);
    }
}
