<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class RoleAndUserSeeder extends Seeder
{
    public const CORREO_PROFESOR_ASIGNATURA = 'fecatalanv.asig@colegio.cl';

    public function run(): void
    {
        // 1. Crear los roles oficiales según el EPT
        $roleAdmin = Role::findOrCreate('Administrador', 'web');
        $roleProfJefe = Role::findOrCreate('Profesor Jefe', 'web');
        $roleProfAsignatura = Role::findOrCreate('Profesor de Asignatura', 'web');

        if (! app()->environment('local', 'testing')) {
            return;
        }

        // 2. Crear usuario Administrador (Director / UTP)
        $admin = User::firstOrCreate(['email' => 'fecatalanv.admin@colegio.cl'], [
            'name' => 'Director San Sebastián',
            'password' => '1234Ab',
        ]);
        if ($admin->wasRecentlyCreated) {
            $admin->assignRole($roleAdmin);
            $admin->markEmailAsVerified();
        }

        // 3. Crear usuario Profesor Jefe (El que ya usabas)
        $profJefe = User::firstOrCreate(['email' => 'jefe1ma@colegio.cl'], [
            'name' => 'Carlos (Profe Jefe 1MA)',
            'password' => Str::password(32),
        ]);
        if ($profJefe->wasRecentlyCreated) {
            $profJefe->assignRole($roleProfJefe);
        }

        // 4. Crear usuario Profesor de Asignatura de demostración
        $profAsignatura = User::firstOrCreate(['email' => self::CORREO_PROFESOR_ASIGNATURA], [
            'name' => 'Profesor de Asignatura',
            'password' => '1234Ab',
        ]);
        if ($profAsignatura->wasRecentlyCreated) {
            $profAsignatura->assignRole($roleProfAsignatura);
            $profAsignatura->markEmailAsVerified();
        }
    }
}
