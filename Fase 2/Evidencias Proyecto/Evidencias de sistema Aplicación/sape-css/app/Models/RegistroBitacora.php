<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistroBitacora extends Model
{
    protected $table = 'registro_bitacoras';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'accion',
        'recursoTipo',
        'recursoId',
        'metadatos',
        'hashIntegridad',
        'creadoEn',
    ];

    protected $casts = [
        'metadatos' => 'array',
        'creadoEn' => 'datetime',
    ];
}
