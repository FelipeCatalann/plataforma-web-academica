<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Curso extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    public function estudiantes()
    {
        // Le indicamos explícitamente que la tabla pivot se llama 'matriculas'
        return $this->belongsToMany(Estudiante::class, 'matriculas')
            ->withPivot('id', 'apoderado_id', 'fechaIngreso', 'estado', 'vigente');
    }

    public function profesorJefe()
    {
        return $this->belongsTo(User::class, 'profesor_jefe_id');
    }

    public function asignaturas()
    {
        return $this->belongsToMany(Asignatura::class, 'asignatura_curso')
            ->withPivot('profesor_id');
    }
}
