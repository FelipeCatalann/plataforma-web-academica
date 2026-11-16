<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'cursos' => ['anioEscolar', 'nivel', 'letra'],
            'matriculas' => ['curso_id', 'estudiante_id'],
        ] as $tabla => $columnas) {
            if (DB::table($tabla)->select($columnas)->groupBy(...$columnas)
                ->havingRaw('COUNT(*) > 1')->first()) {
                throw new RuntimeException("Hay duplicados en {$tabla}. Revisa los registros y su respaldo antes de migrar.");
            }
        }

        Schema::table('cursos', fn (Blueprint $table) => $table->unique(['anioEscolar', 'nivel', 'letra'], 'cursos_identidad_anual_unique'));
        Schema::table('matriculas', fn (Blueprint $table) => $table->unique(['curso_id', 'estudiante_id'], 'matriculas_identidad_unique'));
    }

    public function down(): void
    {
        Schema::table('matriculas', fn (Blueprint $table) => $table->dropUnique('matriculas_identidad_unique'));
        Schema::table('cursos', fn (Blueprint $table) => $table->dropUnique('cursos_identidad_anual_unique'));
    }
};
