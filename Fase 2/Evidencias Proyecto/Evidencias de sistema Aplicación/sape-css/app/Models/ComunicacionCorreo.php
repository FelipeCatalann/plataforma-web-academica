<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComunicacionCorreo extends Model
{
    public const LIMITE_URL_GMAIL = 4500;

    protected $table = 'comunicaciones_correo';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'matricula_id',
        'tipo_destinatario',
        'nombre_destino',
        'correo_destino',
        'asunto',
        'cuerpo_preview',
        'origen',
        'criterio',
        'generado_en',
    ];

    protected $casts = [
        'generado_en' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function matricula()
    {
        return $this->belongsTo(Matricula::class, 'matricula_id');
    }

    /**
     * Construye el enlace oficial del redactor web de Gmail (mail.google.com).
     * Si el cuerpo codificado excede el largo seguro de URL, prepara el enlace
     * con destinatario y asunto listos para que el frontend copie el texto completo.
     *
     * @return array{url: string, excede_limite: bool}
     */
    public static function construirUrlGmail(
        string $correoDestino,
        string $asunto,
        string $cuerpo,
        ?string $cc = null
    ): array {
        $paramsBase = [
            'view' => 'cm',
            'fs' => '1',
            'to' => trim($correoDestino),
            'su' => trim($asunto),
        ];

        $ccLimpio = trim((string) $cc);
        if ($ccLimpio !== '') {
            $paramsBase['cc'] = $ccLimpio;
        }

        $queryCompleta = http_build_query($paramsBase + ['body' => trim($cuerpo)], '', '&', PHP_QUERY_RFC3986);
        $urlCompleta = 'https://mail.google.com/mail/?'.$queryCompleta;

        if (strlen($urlCompleta) <= self::LIMITE_URL_GMAIL) {
            return [
                'url' => $urlCompleta,
                'excede_limite' => false,
            ];
        }

        $querySinCuerpo = http_build_query($paramsBase, '', '&', PHP_QUERY_RFC3986);

        return [
            'url' => 'https://mail.google.com/mail/?'.$querySinCuerpo,
            'excede_limite' => true,
        ];
    }
}
