<?php

namespace App\Policies;

use App\Models\Curso;
use App\Models\User;

class CursoPolicy
{
    public function verCursoCompleto(User $user, Curso $curso): bool
    {
        return $user->hasRole('Administrador')
            || ($user->hasRole('Profesor Jefe') && (string) $curso->profesor_jefe_id === (string) $user->id);
    }

    public function consultarChat(User $user, Curso $curso): bool
    {
        return $this->verCursoCompleto($user, $curso)
            || ($user->hasRole('Profesor de Asignatura')
                && $curso->asignaturas()->wherePivot('profesor_id', $user->id)->exists());
    }
}
