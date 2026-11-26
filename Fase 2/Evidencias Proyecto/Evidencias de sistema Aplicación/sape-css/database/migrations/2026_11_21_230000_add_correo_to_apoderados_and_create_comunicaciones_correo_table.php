<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('apoderados', 'correo')) {
            Schema::table('apoderados', function (Blueprint $table) {
                $table->string('correo', 255)->nullable()->after('nombre')->index();
            });
        }

        if (! Schema::hasTable('comunicaciones_correo')) {
            Schema::create('comunicaciones_correo', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->foreignUuid('matricula_id')->nullable()->constrained('matriculas')->nullOnDelete();
                $table->string('tipo_destinatario', 30)->default('apoderado');
                $table->string('nombre_destino', 150)->nullable();
                $table->string('correo_destino', 255);
                $table->string('asunto', 200);
                $table->text('cuerpo_preview');
                $table->string('origen', 30)->default('correo_directo');
                $table->string('criterio', 80)->nullable();
                $table->timestamp('generado_en')->useCurrent();
                $table->timestamps();

                $table->index(['user_id', 'generado_en']);
                $table->index(['matricula_id', 'generado_en']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('comunicaciones_correo');

        if (Schema::hasColumn('apoderados', 'correo')) {
            Schema::table('apoderados', function (Blueprint $table) {
                $table->dropColumn('correo');
            });
        }
    }
};
