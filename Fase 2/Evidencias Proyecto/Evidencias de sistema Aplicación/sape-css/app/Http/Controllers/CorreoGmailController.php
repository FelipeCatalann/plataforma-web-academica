<?php

namespace App\Http\Controllers;

use App\Models\Apoderado;
use App\Models\ComunicacionCorreo;
use App\Models\Curso;
use App\Models\Matricula;
use App\Models\RegistroBitacora;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class CorreoGmailController extends Controller
{
    /**
     * Directorio interno de directivos y docentes del establecimiento
     * para comunicación por correo Gmail entre colegas o con Dirección/UTP.
     */
    public function directorio(Request $request): JsonResponse
    {
        $usuarioActualId = $request->user()->id;

        $jefaturasPorUsuario = Curso::query()
            ->whereNotNull('profesor_jefe_id')
            ->orderByDesc('anioEscolar')
            ->get(['profesor_jefe_id', 'nivel', 'letra'])
            ->groupBy('profesor_jefe_id')
            ->map(function ($cursos) {
                return $cursos
                    ->map(fn ($c) => "{$c->nivel}° Medio {$c->letra}")
                    ->unique()
                    ->implode(', ');
            });

        $usuarios = User::query()
            ->where('id', '!=', $usuarioActualId)
            ->with('roles:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $contactos = $usuarios->map(function (User $u) use ($jefaturasPorUsuario) {
            $roles = $u->roles->pluck('name')->all();
            $esAdmin = in_array('Administrador', $roles, true);
            $esJefe = in_array('Profesor Jefe', $roles, true);
            $esAsig = in_array('Profesor de Asignatura', $roles, true);

            $rol = $esAdmin
                ? 'Dirección / Administración'
                : ($esJefe && $esAsig
                    ? 'Profesor Jefe y Asignatura'
                    : ($esJefe
                        ? 'Profesor Jefe'
                        : ($esAsig ? 'Profesor de Asignatura' : 'Equipo Docente')));

            $jefatura = $jefaturasPorUsuario->get($u->id);

            return [
                'id' => $u->id,
                'nombre' => $u->name,
                'email' => $u->email,
                'rol' => $rol,
                'categoria' => $esAdmin ? 'direccion_utp' : 'equipo_docente',
                'detalle' => $jefatura ? "Jefatura {$jefatura}" : $rol,
            ];
        })->values();

        return response()->json([
            'contactos' => $contactos,
        ]);
    }

    /**
     * Prepara y registra una comunicación por Gmail (hacia apoderado, docente o directivo,
     * ya sea desde correo directo o desde el borrador editable de Informe IA).
     */
    public function prepararCorreo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'correo_destino' => ['required', 'string', 'email:rfc', 'max:255'],
            'cc' => ['nullable', 'string', 'email:rfc', 'max:255'],
            'nombre_destino' => ['nullable', 'string', 'max:150'],
            'asunto' => ['required', 'string', 'min:2', 'max:200'],
            'cuerpo' => ['required', 'string', 'min:5', 'max:12000'],
            'tipo_destinatario' => ['required', 'in:apoderado,equipo_docente,direccion_utp,otro'],
            'origen' => ['nullable', 'in:correo_directo,informe_ia'],
            'criterio' => ['nullable', 'string', 'max:80'],
            'estudiante_id' => ['nullable', 'uuid'],
            'curso_id' => ['nullable', 'uuid'],
        ], [
            'correo_destino.required' => 'Ingresa el correo electrónico de destino.',
            'correo_destino.email' => 'El correo electrónico de destino no tiene un formato válido.',
            'cc.email' => 'El correo en copia (CC) no tiene un formato válido.',
            'asunto.required' => 'Ingresa un asunto para el correo.',
            'cuerpo.required' => 'El contenido del correo no puede estar vacío.',
        ]);

        return DB::transaction(fn () => $this->registrarCorreo($request, $validated));
    }

    private function registrarCorreo(Request $request, array $validated): JsonResponse
    {
        $matricula = null;
        $cursoId = $validated['curso_id'] ?? null;
        $estudianteId = $validated['estudiante_id'] ?? null;

        if ($cursoId) {
            $curso = Curso::query()->lockForUpdate()->find($cursoId);
            abort_if(! $curso, 404, 'El curso ya no está disponible.');
            Gate::authorize('consultarChat', $curso);

            if ($estudianteId) {
                $matricula = Matricula::where('estudiante_id', $estudianteId)
                    ->where('curso_id', $cursoId)
                    ->where('vigente', true)
                    ->lockForUpdate()
                    ->first();

                if (! $matricula) {
                    return response()->json([
                        'message' => 'No se encontró una matrícula activa para el estudiante en este curso.',
                    ], 404);
                }
            }
        }

        $correoNormalizado = strtolower(trim($validated['correo_destino']));
        $ccNormalizado = ! empty($validated['cc']) ? strtolower(trim($validated['cc'])) : null;

        // Si el correo está dirigido al apoderado de una matrícula válida, persistir su correo
        if ($matricula && $validated['tipo_destinatario'] === 'apoderado') {
            $apoderado = $matricula->apoderado()->lockForUpdate()->first();
            $contactoCompartido = $apoderado && Matricula::where('apoderado_id', $apoderado->id)
                ->where('id', '!=', $matricula->id)
                ->exists();

            if ($apoderado && ! $contactoCompartido) {
                $apoderado->update(['correo' => $correoNormalizado]);
            } elseif (! $apoderado || $apoderado->correo !== $correoNormalizado) {
                $apoderado = Apoderado::create([
                    'id' => (string) Str::uuid(),
                    'nombre' => $apoderado?->nombre ?? ($validated['nombre_destino'] ?: 'Apoderado registrado por docente'),
                    'correo' => $correoNormalizado,
                    'telefono' => $apoderado?->telefono,
                    'telefonoVigente' => (bool) ($apoderado?->telefonoVigente ?? true),
                ]);
                $matricula->update(['apoderado_id' => $apoderado->id]);
            }
        }

        $asuntoLimpio = trim($validated['asunto']);
        $cuerpoLimpio = trim($validated['cuerpo']);
        $origen = $validated['origen'] ?? 'correo_directo';
        $criterio = $validated['criterio'] ?? ($origen === 'informe_ia' ? 'informe_ia' : 'correo_general');
        $nombreDestino = trim((string) ($validated['nombre_destino'] ?? '')) ?: null;

        $enlaceGmail = ComunicacionCorreo::construirUrlGmail(
            $correoNormalizado,
            $asuntoLimpio,
            $cuerpoLimpio,
            $ccNormalizado
        );

        $now = now();
        $comunicacion = ComunicacionCorreo::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'matricula_id' => $matricula?->id,
            'tipo_destinatario' => $validated['tipo_destinatario'],
            'nombre_destino' => $nombreDestino,
            'correo_destino' => $correoNormalizado,
            'asunto' => $asuntoLimpio,
            'cuerpo_preview' => Str::limit($cuerpoLimpio, 4000, '...'),
            'origen' => $origen,
            'criterio' => $criterio,
            'generado_en' => $now,
        ]);

        $metadatos = [
            'origen' => $origen,
            'criterio' => $criterio,
            'tipo_destinatario' => $validated['tipo_destinatario'],
            'curso_id' => $cursoId,
            'estudiante_id' => $estudianteId,
            'matricula_id' => $matricula?->id,
            'correo_destino' => $correoNormalizado,
            'asunto' => $asuntoLimpio,
        ];

        RegistroBitacora::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'accion' => 'PREPARAR_CORREO_GMAIL',
            'recursoTipo' => 'ComunicacionCorreo',
            'recursoId' => $comunicacion->id,
            'metadatos' => $metadatos,
            'hashIntegridad' => hash('sha256', json_encode($metadatos).'|'.$now->toIso8601String()),
            'creadoEn' => $now,
        ]);

        return response()->json([
            'success' => true,
            'gmail_url' => $enlaceGmail['url'],
            'excede_limite' => $enlaceGmail['excede_limite'],
            'comunicacion' => [
                'id' => $comunicacion->id,
                'tipo_destinatario' => $comunicacion->tipo_destinatario,
                'nombre_destino' => $comunicacion->nombre_destino,
                'correo_destino' => $comunicacion->correo_destino,
                'asunto' => $comunicacion->asunto,
                'origen' => $comunicacion->origen,
                'criterio' => $comunicacion->criterio,
                'generado_en' => $comunicacion->generado_en?->toIso8601String(),
            ],
        ]);
    }
}
