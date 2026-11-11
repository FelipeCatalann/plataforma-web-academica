<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SesionChat extends Model
{
    use HasUuids;

    protected $table = 'sesion_chats';

    protected $fillable = [
        'user_id',
        'titulo',
        'curso_id',
        'modelo_id',
        'iniciadaEn',
        'expiraEn',
        'estado',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mensajes(): HasMany
    {
        return $this->hasMany(MensajeChat::class, 'sesion_id')->orderBy('created_at');
    }
}
