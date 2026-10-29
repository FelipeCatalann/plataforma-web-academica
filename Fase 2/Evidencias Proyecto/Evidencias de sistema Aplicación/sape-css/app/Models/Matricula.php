<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Matricula extends Model
{
    protected $table = 'matriculas';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'estudiante_id',
        'curso_id',
        'apoderado_id',
        'fechaIngreso',
        'estado',
        'vigente',
    ];

    public function estudiante()
    {
        return $this->belongsTo(Estudiante::class, 'estudiante_id');
    }

    public function curso()
    {
        return $this->belongsTo(Curso::class, 'curso_id');
    }

    public function apoderado()
    {
        return $this->belongsTo(Apoderado::class, 'apoderado_id');
    }

    public function enlacesWhatsApp()
    {
        return $this->hasMany(EnlaceWhatsApp::class, 'matricula_id');
    }
}
