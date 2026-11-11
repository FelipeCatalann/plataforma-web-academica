<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MensajeChat extends Model
{
    use HasUuids;

    protected $table = 'mensaje_chats';

    protected $fillable = [
        'sesion_id',
        'autor',
        'modelo_nombre',
        'contenido',
        'creadoEn',
    ];

    public function sesion(): BelongsTo
    {
        return $this->belongsTo(SesionChat::class, 'sesion_id');
    }
}
