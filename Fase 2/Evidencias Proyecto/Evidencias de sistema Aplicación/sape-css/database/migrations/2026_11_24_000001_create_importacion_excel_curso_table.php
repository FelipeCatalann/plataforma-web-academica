<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('importacion_excel_curso', function (Blueprint $table) {
            $table->foreignUuid('importacion_excel_id')
                ->constrained('importacion_excels')
                ->cascadeOnDelete();
            $table->foreignUuid('curso_id')
                ->constrained('cursos')
                ->cascadeOnDelete();

            $table->primary(['importacion_excel_id', 'curso_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('importacion_excel_curso');
    }
};
