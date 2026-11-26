<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('calificaciones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('matricula_id')->constrained('matriculas')->onDelete('cascade');
            $table->foreignUuid('asignatura_curso_id')->constrained('asignatura_curso')->onDelete('cascade');

            $table->decimal('valor', 3, 1); // Ejemplo: 7.0
            $table->decimal('ponderacion', 5, 2);
            $table->string('evaluacion');
            $table->tinyInteger('semestre')->default(1);
            $table->date('fecha');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('calificaciones');
    }
};
