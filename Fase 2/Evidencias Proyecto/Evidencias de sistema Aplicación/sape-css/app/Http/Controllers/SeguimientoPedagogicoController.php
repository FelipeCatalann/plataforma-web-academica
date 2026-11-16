<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Models\Estudiante;
use App\Models\Matricula;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class SeguimientoPedagogicoController extends Controller
{
    public function guardar(Request $request, Curso $curso, Estudiante $estudiante): JsonResponse
    {
        $datos = $request->validate([
            'acuerdo' => 'required|string|max:4000',
            'fecha_revision' => 'required|date_format:Y-m-d|after_or_equal:today',
        ]);

        DB::transaction(function () use ($request, $curso, $estudiante, $datos): void {
            $curso = Curso::query()->lockForUpdate()->findOrFail($curso->id);
            Gate::authorize('acompanarEstudiante', [$estudiante, $curso]);

            $matricula = Matricula::where('curso_id', $curso->id)
                ->where('estudiante_id', $estudiante->id)
                ->where('vigente', true)
                ->lockForUpdate()
                ->firstOrFail();

            $ahora = now();
            DB::table('seguimientos_pedagogicos')->upsert([
                'matricula_id' => $matricula->id,
                'actualizado_por' => $request->user()->id,
                ...$datos,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ], ['matricula_id'], ['actualizado_por', 'acuerdo', 'fecha_revision', 'updated_at']);
        });

        return response()->json(['seguimiento' => $datos])->header('Cache-Control', 'no-store');
    }
}
