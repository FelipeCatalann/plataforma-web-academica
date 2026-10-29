<?php

namespace App\Http\Controllers;

use App\Models\Apoderado;
use App\Models\EnlaceWhatsApp;
use App\Models\Matricula;
use App\Models\RegistroBitacora;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EnlaceWhatsAppController extends Controller
{
    /**
     * INDG-19 / HUF-05: Prepara y registra un enlace Click-to-Chat (wa.me) con mensaje
     * revisado y preestructurado por el Profesor Jefe para envío personal sin costo de API/bot.
     */
    public function prepararEnlace(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'estudiante_id' => 'required|string',
            'curso_id' => 'required|string',
            'telefono' => 'required|string|min:8|max:25',
            'mensaje' => 'required|string|min:10|max:2000',
            'criterio' => 'nullable|string|max:100',
        ]);

        $telefonoNormalizado = EnlaceWhatsApp::normalizarTelefono($validated['telefono']);

        if (strlen($telefonoNormalizado) < 11 || strlen($telefonoNormalizado) > 15) {
            return response()->json([
                'message' => 'El número telefónico del apoderado no es válido. Use el formato +569XXXXXXXX.',
                'errors' => [
                    'telefono' => ['El número telefónico debe incluir código de país y 9 dígitos móviles (ej. +56912345678).'],
                ],
            ], 422);
        }

        $matricula = Matricula::where('estudiante_id', $validated['estudiante_id'])
            ->where('curso_id', $validated['curso_id'])
            ->first();

        if (! $matricula) {
            return response()->json([
                'message' => 'No se encontró una matrícula activa para el estudiante en este curso.',
            ], 404);
        }

        $telefonoConMas = '+'.$telefonoNormalizado;

        // Si el profesor ingresó o actualizó el teléfono del apoderado, lo persistimos en la ficha
        if ($matricula->apoderado_id) {
            Apoderado::where('id', $matricula->apoderado_id)->update([
                'telefono' => $telefonoConMas,
                'telefonoVigente' => true,
            ]);
        } else {
            $apoderado = Apoderado::firstOrCreate(
                ['telefono' => $telefonoConMas],
                [
                    'id' => (string) Str::uuid(),
                    'nombre' => 'Apoderado registrado por Profesor Jefe',
                    'telefonoVigente' => true,
                ]
            );
            $matricula->update(['apoderado_id' => $apoderado->id]);
        }

        $mensajeLimpio = trim($validated['mensaje']);
        $urlCompleta = EnlaceWhatsApp::construirUrl($telefonoNormalizado, $mensajeLimpio);

        $now = now();
        $enlaceId = (string) Str::uuid();

        $enlace = EnlaceWhatsApp::create([
            'id' => $enlaceId,
            'user_id' => $request->user()->id,
            'matricula_id' => $matricula->id,
            // La columna url tiene límite varchar(500) en migración; truncamos solo el espejo en BD si excede
            'url' => Str::limit($urlCompleta, 495, ''),
            'mensajePrellenado' => $mensajeLimpio,
            'telefonoDestinoSnapshot' => $telefonoConMas,
            'estado' => 'ABIERTO_POR_DOCENTE',
            'generadoEn' => $now,
        ]);

        $metadatos = [
            'criterio' => $validated['criterio'] ?? 'seguimiento_general',
            'curso_id' => $validated['curso_id'],
            'estudiante_id' => $validated['estudiante_id'],
            'matricula_id' => $matricula->id,
            'telefono_destino' => $telefonoConMas,
        ];

        RegistroBitacora::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'accion' => 'PREPARAR_ENLACE_WHATSAPP',
            'recursoTipo' => 'EnlaceWhatsApp',
            'recursoId' => $enlace->id,
            'metadatos' => $metadatos,
            'hashIntegridad' => hash('sha256', json_encode($metadatos).'|'.$now->toIso8601String()),
            'creadoEn' => $now,
        ]);

        return response()->json([
            'success' => true,
            'url' => $urlCompleta,
            'enlace' => [
                'id' => $enlace->id,
                'estado' => $enlace->estado,
                'telefonoDestinoSnapshot' => $enlace->telefonoDestinoSnapshot,
                'mensajePrellenado' => $enlace->mensajePrellenado,
                'generadoEn' => $enlace->generadoEn?->toIso8601String(),
                'criterio' => $metadatos['criterio'],
            ],
        ]);
    }
}
