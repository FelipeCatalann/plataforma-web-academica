<?php

namespace Tests\Integration;

use Database\Seeders\AsignarProfesoresSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeedersProduccionTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeders_de_produccion_no_crean_cuentas_ni_datos_de_demostracion(): void
    {
        $entorno = $this->app->environment();
        $this->app->instance('env', 'production');

        try {
            $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])->assertSuccessful();
            $this->artisan('db:seed', ['--class' => AsignarProfesoresSeeder::class, '--force' => true])->assertSuccessful();
        } finally {
            $this->app->instance('env', $entorno);
        }

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('cursos', 0);
        $this->assertDatabaseHas('roles', ['name' => 'Administrador', 'guard_name' => 'web']);
    }
}
