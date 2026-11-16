<?php

namespace App\Policies;

use App\Models\Curso;
use App\Models\Estudiante;
use App\Models\Matricula;
use App\Models\User;

class EstudiantePolicy
{
    public function generarInforme(User $user, Estudiante $estudiante, Curso $curso): bool
    {
        $tieneMatricula = Matricula::where('estudiante_id', $estudiante->id)
            ->where('curso_id', $curso->id)
            ->where('vigente', true)
            ->exists();

        if (! $tieneMatricula) {
            return false;
        }

        return $user->can('consultarChat', $curso);
    }
}
