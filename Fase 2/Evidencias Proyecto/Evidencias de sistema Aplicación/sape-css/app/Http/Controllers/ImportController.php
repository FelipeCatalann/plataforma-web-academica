<?php

namespace App\Http\Controllers;

use App\Imports\ImportadorSyscol;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ImportController extends Controller
{
    // Muestra el formulario de importación (GET).
    public function index()
    {
        // Retorna la vista Inertia de la página de importación
        return Inertia::render('Admin/ImportarNotas');
    }

    public function importar(Request $request)
    {


        // 1. AUMENTAR EL TIEMPO LÍMITE A 5 MINUTOS (300 segundos)
        set_time_limit(300);

        $request->validate([
            'archivo_excel' => 'required|mimes:xlsx,xls,csv',
        ]);

        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());

        
        $request->validate([
            'archivo_excel' => 'required|mimes:xlsx,xls,csv',
        ]);

        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());

        // CA-2 (INDG-15/INDG-16), hash idempotencia: la re-carga idéntica no duplica.
        $yaProcesada = DB::table('importacion_excels')
            ->where('checksum', $hash)
            ->where('estadoImportacion', 'PROCESADA')
            ->exists();
        if ($yaProcesada) {
            return back()->with('success', 'El archivo ya fue importado anteriormente (hash idéntico). No se duplicaron registros.');
        }

        $importacionId = (string) Str::uuid();
        $calificacionesAntes = DB::table('calificaciones')->count();

        try {
            DB::beginTransaction();

            DB::table('importacion_excels')->insert([
                'id' => $importacionId,
                'archivoOriginal' => $archivo->getClientOriginalName(),
                'checksum' => $hash,
                'iniciadaEn' => now(),
                'estadoImportacion' => 'PROCESANDO',
                'filasProcesadas' => 0,
                'filasRechazadas' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Excel::import(new ImportadorSyscol, $archivo);

            DB::table('importacion_excels')->where('id', $importacionId)->update([
                'estadoImportacion' => 'PROCESADA',
                'finalizadaEn' => now(),
                'filasProcesadas' => DB::table('calificaciones')->count() - $calificacionesAntes,
                'updated_at' => now(),
            ]);

            DB::commit();

            return back()->with('success', 'El archivo ha sido procesado e importado exitosamente.');
        } catch (\Exception $e) {
            DB::rollBack();

            return back()->withErrors(['archivo_excel' => 'Error crítico al procesar: '.$e->getMessage()]);
        }
    }
}
