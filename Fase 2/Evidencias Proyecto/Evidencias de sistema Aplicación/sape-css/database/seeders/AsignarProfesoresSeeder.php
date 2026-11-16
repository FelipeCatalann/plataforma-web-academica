<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AsignarProfesoresSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        $profeJefe = User::where('email', 'jefe1ma@colegio.cl')->first();
        $profeMate = User::where('email', 'ana@colegio.cl')->first();
        if (! $profeJefe?->hasRole('Profesor Jefe') || ! $profeMate?->hasRole('Profesor de Asignatura')) {
            $this->command->warn('Primero crea las cuentas de demostración.');

            return;
        }

        // 2. Buscar los cursos 1°A y 1°B usando tu columna 'nivel'
        $curso1MA = DB::table('cursos')->where('nivel', 1)->where('letra', 'A')->first();
        $curso1MB = DB::table('cursos')->where('nivel', 1)->where('letra', 'B')->first();

        if (! $curso1MA || ! $curso1MB) {
            $this->command->error('No se encontraron los cursos 1MA o 1MB. Asegúrate de haber importado los Excel primero.');

            return;
        }

        // 3. Asignar Profesor Jefe al 1° Medio A
        DB::table('cursos')
            ->where('id', $curso1MA->id)
            ->update(['profesor_jefe_id' => $profeJefe->id]);

        $this->command->info('Profesor Jefe asignado al 1° Medio A.');

        // 4. Buscar la asignatura de Matemática (el importador guarda el nombre como "Matemática")
        $asignaturaMate = DB::table('asignaturas')->where('nombre', 'like', '%Matemática%')->first();

        if ($asignaturaMate) {
            // 5. Asignar Profesor de Asignatura (Matemáticas) al 1°A y 1°B en la tabla pivote
            DB::table('asignatura_curso')
                ->where('asignatura_id', $asignaturaMate->id)
                ->whereIn('curso_id', [$curso1MA->id, $curso1MB->id])
                ->update(['profesor_id' => $profeMate->id]);

            $this->command->info('Profesor de Matemáticas asignado al 1°A y 1°B.');
        } else {
            $this->command->warn('No se encontró la asignatura de Matemáticas.');
        }
    }
}
