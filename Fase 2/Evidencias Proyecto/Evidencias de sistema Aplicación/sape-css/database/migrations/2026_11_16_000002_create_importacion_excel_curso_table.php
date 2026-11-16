<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('importacion_excel_curso', function (Blueprint $table) {
            $table->foreignUuid('importacion_id')->constrained('importacion_excels')->cascadeOnDelete();
            $table->foreignUuid('curso_id')->nullable()->constrained('cursos')->nullOnDelete();
            $table->index('curso_id');
            $table->string('identidad_curso', 25);
            $table->unsignedInteger('filas_calificaciones');
            $table->primary(['importacion_id', 'identidad_curso']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('importacion_excel_curso');
    }
};
