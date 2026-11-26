<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Services\AgenteAsignacionIAService;
use App\Services\AsignacionDocenteService;
use App\Services\ExtractorExcelDocenteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class AsignacionDocenteIAController extends Controller
{
    private const SESSION_KEY_EXCEL = 'asignacion_ia_excel_contexto';

    public function descargarPlantilla(ExtractorExcelDocenteService $extractor): Response
    {
        $cursos = Curso::with('asignaturas')
            ->orderBy('nivel')
            ->orderBy('letra')
            ->get();

        $binario = $extractor->generarPlantillaXlsx($cursos);

        return response($binario, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="Plantilla_Carga_Docente_SAPE.xlsx"',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function analizarExcel(Request $request, AgenteAsignacionIAService $agente): JsonResponse
    {
        set_time_limit(180);

        $request->validate(
            [
                'archivo_excel' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
                'nota_contexto' => ['nullable', 'string', 'max:600'],
            ],
            [
                'archivo_excel.required' => 'Selecciona un archivo Excel de profesores (.xlsx o .xls).',
                'archivo_excel.mimes' => 'Solo se admiten archivos Excel en formato .xlsx o .xls.',
                'archivo_excel.max' => 'El archivo Excel no debe superar los 5 MB.',
            ]
        );

        $resultado = $agente->analizarExcel(
            $request->user(),
            $request->file('archivo_excel'),
            $request->input('nota_contexto')
        );

        $request->session()->put(self::SESSION_KEY_EXCEL, [
            'contexto' => $resultado['contexto_sesion'],
            'expira' => now()->addMinutes(15)->timestamp,
        ]);

        return response()
            ->json($resultado['propuesta'])
            ->header('Cache-Control', 'no-store');
    }

    public function analizar(Request $request, AgenteAsignacionIAService $agente): JsonResponse
    {
        set_time_limit(150);

        $validado = $request->validate(
            [
                'instrucciones' => ['required', 'string', 'min:4', 'max:12000'],
                'propuesta_actual' => ['nullable', 'array'],
                'reanalizar_excel' => ['nullable', 'boolean'],
            ],
            [
                'instrucciones.required' => 'Escribe o pega las instrucciones de asignación docente.',
                'instrucciones.min' => 'Ingresa al menos una instrucción breve para analizar.',
            ]
        );

        $contextoExcel = null;
        if (! empty($validado['reanalizar_excel'])) {
            $guardado = $request->session()->get(self::SESSION_KEY_EXCEL);
            if (! is_array($guardado) || ($guardado['expira'] ?? 0) <= now()->timestamp) {
                throw ValidationException::withMessages([
                    'archivo_excel' => 'La sesión temporal del Excel expiró. Vuelve a subir el archivo para re-analizarlo.',
                ]);
            }
            $contextoExcel = $guardado['contexto'] ?? null;
        }

        $propuesta = $agente->analizarTexto(
            $request->user(),
            (string) $validado['instrucciones'],
            $validado['propuesta_actual'] ?? null,
            $contextoExcel
        );

        return response()
            ->json($propuesta)
            ->header('Cache-Control', 'no-store');
    }

    public function confirmar(Request $request, AsignacionDocenteService $servicio): JsonResponse
    {
        $validado = $request->validate([
            'docentes_nuevos' => ['nullable', 'array', 'max:200'],
            'docentes_nuevos.*.temp_id' => ['required', 'string', 'max:60'],
            'docentes_nuevos.*.nombre' => ['required', 'string', 'max:80'],
            'docentes_nuevos.*.primer_apellido' => ['required', 'string', 'max:80'],
            'docentes_nuevos.*.segundo_apellido' => ['nullable', 'string', 'max:80'],
            'docentes_nuevos.*.email' => ['nullable', 'email', 'max:255'],
            'docentes_nuevos.*.origen_email' => ['nullable', 'string', 'in:excel,autogenerado,manual'],
            'docentes_nuevos.*.rol_inicial' => ['required', 'string', 'in:Profesor Jefe,Profesor de Asignatura'],
            'asignaciones' => ['nullable', 'array', 'max:500'],
            'asignaciones.*.profesor_ref' => ['required', 'string', 'max:64'],
            'asignaciones.*.curso_id' => ['required', 'string', 'max:64'],
            'asignaciones.*.tipo_rol' => ['required', 'string', 'in:jefe,asignatura'],
            'asignaciones.*.asignatura_id' => ['nullable', 'string', 'max:64'],
            'metadatos_origen' => ['nullable', 'array'],
        ]);

        $resultado = $servicio->aplicarLoteConfirmado(
            $request->user(),
            $validado['docentes_nuevos'] ?? [],
            $validado['asignaciones'] ?? [],
            $validado['metadatos_origen'] ?? []
        );

        $request->session()->forget(self::SESSION_KEY_EXCEL);

        return response()
            ->json([
                'ok' => true,
                'resumen' => $resultado['resumen'],
                'credenciales_creadas' => $resultado['credenciales_creadas'],
            ])
            ->header('Cache-Control', 'no-store');
    }
}
