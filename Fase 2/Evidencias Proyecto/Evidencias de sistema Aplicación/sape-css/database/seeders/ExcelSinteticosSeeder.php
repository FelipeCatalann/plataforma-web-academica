<?php

namespace Database\Seeders;

use App\Imports\ImportadorSyscol;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Maatwebsite\Excel\Facades\Excel;

class ExcelSinteticosSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        $this->command->info('Buscando archivos Excel...');

        // Apuntamos directamente a la ruta física absoluta de tu PC
        $rutaCarpeta = storage_path('app/sinteticos');

        // Verificamos si la carpeta existe primero
        if (! File::exists($rutaCarpeta)) {
            $this->command->error("No existe la carpeta: {$rutaCarpeta}");

            return;
        }

        // Obtenemos todos los archivos dentro de la carpeta
        $archivos = File::files($rutaCarpeta);
        $archivosExcel = [];

        foreach ($archivos as $archivo) {
            if ($archivo->getExtension() === 'xlsx') {
                $archivosExcel[] = $archivo->getRealPath();
            }
        }

        if (empty($archivosExcel)) {
            $this->command->warn('La carpeta existe, pero no se encontraron archivos .xlsx adentro.');

            return;
        }

        foreach ($archivosExcel as $rutaCompleta) {
            $nombreArchivo = basename($rutaCompleta);
            $this->command->info("Importando: {$nombreArchivo}");

            // Pasamos la ruta completa al importador
            Excel::import(new ImportadorSyscol, $rutaCompleta);
        }

        $this->command->info('¡Todos los datos sintéticos fueron importados con éxito!');
    }
}
