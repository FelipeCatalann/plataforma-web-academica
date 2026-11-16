<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class RoleAndUserSeeder extends Seeder
{
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
        $admin = User::firstOrCreate(['email' => 'director@colegio.cl'], [
            'name' => 'Director San Sebastián',
            'password' => Str::password(32),
        ]);
        if ($admin->wasRecentlyCreated) {
            $admin->assignRole($roleAdmin);
        }

        // 3. Crear usuario Profesor Jefe (El que ya usabas)
        $profJefe = User::firstOrCreate(['email' => 'jefe1ma@colegio.cl'], [
            'name' => 'Carlos (Profe Jefe 1MA)',
            'password' => Str::password(32),
        ]);
        if ($profJefe->wasRecentlyCreated) {
            $profJefe->assignRole($roleProfJefe);
        }

        // 4. Crear usuario Profesor de Asignatura (La que ya usabas)
        $profAsignatura = User::firstOrCreate(['email' => 'ana@colegio.cl'], [
            'name' => 'Ana (Profe Matemáticas)',
            'password' => Str::password(32),
        ]);
        if ($profAsignatura->wasRecentlyCreated) {
            $profAsignatura->assignRole($roleProfAsignatura);
        }
    }
}
