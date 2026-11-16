<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SesionChat extends Model
{
    use HasUuids, MassPrunable;

    protected $table = 'sesion_chats';

    public static function diasRetencion(): int
    {
        return max(1, (int) config('services.ia.dias_historial', 30));
    }

    #[Scope]
    protected function vigente(Builder $query): void
    {
        $query->where('updated_at', '>', now()->subDays(self::diasRetencion()))
            ->where(fn (Builder $q) => $q->whereNull('expiraEn')->orWhere('expiraEn', '>', now()));
    }

    public function prunable(): Builder
    {
        return static::where('updated_at', '<=', now()->subDays(self::diasRetencion()))
            ->orWhere('expiraEn', '<=', now());
    }

    protected $fillable = [
        'user_id',
        'titulo',
        'curso_id',
        'alcance_academico',
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
