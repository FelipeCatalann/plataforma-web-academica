<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Apoderado extends Model
{
    protected $table = 'apoderados';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'nombre',
        'telefono',
        'telefonoVigente',
    ];

    protected $casts = [
        'telefonoVigente' => 'boolean',
    ];
}
