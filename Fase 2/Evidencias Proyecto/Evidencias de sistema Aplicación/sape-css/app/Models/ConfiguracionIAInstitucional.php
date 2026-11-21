<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

class ConfiguracionIAInstitucional extends Model
{
    public const CLAVE_PRINCIPAL = 'principal';

    protected $table = 'configuracion_ia_institucional';

    protected $fillable = [
        'clave',
        'plan_activo',
        'proveedor',
        'base_url',
        'api_key_cifrada',
        'modelo_chat',
        'modelo_informes',
        'presupuesto_mensual_usd',
        'alerta_porcentaje',
        'solicitudes_diarias_limite',
        'permitir_clave_personal_docentes',
        'metricas_mensuales',
        'verificada_en',
        'actualizado_por',
    ];

    protected $hidden = [
        'api_key_cifrada',
    ];

    protected function casts(): array
    {
        return [
            'api_key_cifrada' => 'encrypted',
            'presupuesto_mensual_usd' => 'float',
            'alerta_porcentaje' => 'integer',
            'solicitudes_diarias_limite' => 'integer',
            'permitir_clave_personal_docentes' => 'boolean',
            'metricas_mensuales' => 'array',
            'verificada_en' => 'datetime',
        ];
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actualizado_por');
    }

    public static function vigente(): ?self
    {
        try {
            if (! Schema::hasTable((new self)->getTable())) {
                return null;
            }

            return self::query()->where('clave', self::CLAVE_PRINCIPAL)->first();
        } catch (\Throwable) {
            return null;
        }
    }
}
