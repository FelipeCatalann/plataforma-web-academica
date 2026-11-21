<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('configuracion_ia_institucional')) {
            return;
        }

        Schema::create('configuracion_ia_institucional', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 40)->unique()->default('principal');
            $table->string('plan_activo', 40)->default('gratuito_groq');
            $table->string('proveedor', 32)->default('groq');
            $table->string('base_url', 255)->nullable();
            $table->text('api_key_cifrada')->nullable();
            $table->string('modelo_chat', 120)->nullable();
            $table->string('modelo_informes', 120)->nullable();
            $table->decimal('presupuesto_mensual_usd', 10, 2)->default(15.00);
            $table->unsignedTinyInteger('alerta_porcentaje')->default(80);
            $table->unsignedInteger('solicitudes_diarias_limite')->default(2000);
            $table->boolean('permitir_clave_personal_docentes')->default(true);
            $table->json('metricas_mensuales')->nullable();
            $table->timestamp('verificada_en')->nullable();
            $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('configuracion_ia_institucional');
    }
};
