<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seguimientos_pedagogicos', function (Blueprint $table) {
            $table->foreignUuid('matricula_id')->constrained('matriculas')->cascadeOnDelete();
            $table->primary('matricula_id');
            $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->text('acuerdo');
            $table->date('fecha_revision');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seguimientos_pedagogicos');
    }
};
