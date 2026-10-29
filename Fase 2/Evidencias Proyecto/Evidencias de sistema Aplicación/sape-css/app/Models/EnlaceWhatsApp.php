<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EnlaceWhatsApp extends Model
{
    protected $table = 'enlace_whats_apps';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'matricula_id',
        'url',
        'mensajePrellenado',
        'telefonoDestinoSnapshot',
        'estado',
        'generadoEn',
    ];

    protected $casts = [
        'generadoEn' => 'datetime',
    ];

    public function profesor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function matricula()
    {
        return $this->belongsTo(Matricula::class, 'matricula_id');
    }

    /**
     * Normaliza un número telefónico chileno o internacional a solo dígitos (formato E.164 sin '+')
     * compatible con enlaces Click-to-Chat https://wa.me/<numero>.
     */
    public static function normalizarTelefono(string $telefono): string
    {
        $digitos = preg_replace('/\D+/', '', $telefono) ?? '';

        if (strlen($digitos) === 8) {
            return '569'.$digitos;
        }

        if (strlen($digitos) === 9 && str_starts_with($digitos, '9')) {
            return '56'.$digitos;
        }

        return $digitos;
    }

    /**
     * Construye el enlace oficial Click-to-Chat de WhatsApp (libre de costos de API/bot)
     * con el mensaje codificado en formato RFC 3986.
     */
    public static function construirUrl(string $telefono, string $mensaje): string
    {
        $telefonoNormalizado = self::normalizarTelefono($telefono);

        return 'https://wa.me/'.$telefonoNormalizado.'?text='.rawurlencode(trim($mensaje));
    }
}
