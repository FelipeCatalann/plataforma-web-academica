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
        Schema::table('sesion_chats', function (Blueprint $table) {
            if (! Schema::hasColumn('sesion_chats', 'titulo')) {
                $table->string('titulo', 140)->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('sesion_chats', 'curso_id')) {
                $table->string('curso_id', 64)->nullable()->index()->after('titulo');
            }
            if (! Schema::hasColumn('sesion_chats', 'modelo_id')) {
                $table->string('modelo_id', 120)->nullable()->after('curso_id');
            }
        });

        Schema::table('mensaje_chats', function (Blueprint $table) {
            if (! Schema::hasColumn('mensaje_chats', 'modelo_nombre')) {
                $table->string('modelo_nombre', 80)->nullable()->after('autor');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sesion_chats', function (Blueprint $table) {
            foreach (['titulo', 'curso_id', 'modelo_id'] as $col) {
                if (Schema::hasColumn('sesion_chats', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('mensaje_chats', function (Blueprint $table) {
            if (Schema::hasColumn('mensaje_chats', 'modelo_nombre')) {
                $table->dropColumn('modelo_nombre');
            }
        });
    }
};
