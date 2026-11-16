<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sesion_chats', function (Blueprint $table) {
            $table->string('alcance_academico', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sesion_chats', function (Blueprint $table) {
            $table->dropColumn('alcance_academico');
        });
    }
};
