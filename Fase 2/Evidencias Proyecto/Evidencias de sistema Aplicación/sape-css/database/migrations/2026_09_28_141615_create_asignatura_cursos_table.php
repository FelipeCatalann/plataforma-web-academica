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
        Schema::create('asignatura_curso', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('asignatura_id')->constrained('asignaturas')->onDelete('cascade');
            $table->foreignUuid('curso_id')->constrained('cursos')->onDelete('cascade');

            $table->decimal('ponderacion', 5, 2)->default(1.00);
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('asignatura_curso');
    }
};
