import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PROVEEDORES_IA,
    estimarCostoMensualPlan,
    formatearUsd,
    formatearClpAprox,
} from '@/utils/preferenciasSape';

const IconoCandado = () => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);

const IconoEnlaceExterno = () => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
    </svg>
);

export default function HubIAConfiguracion({
    esAdministrador = false,
    conexionActiva = null,
    configuracionInstitucional = null,
    planesColegio = [],
    modelosPersonalizados = [],
    onServidorActualizado = null,
    onNotificar = null,
    onError = null,
}) {
    // --- Estado del panel Master-Detail institucional ---
    const [planSeleccionadoId, setPlanSeleccionadoId] = useState(
        configuracionInstitucional?.plan_activo || 'gratuito_groq'
    );
    const [proveedorInst, setProveedorInst] = useState(
        configuracionInstitucional?.proveedor || 'groq'
    );
    const [modeloChatInst, setModeloChatInst] = useState(
        configuracionInstitucional?.modelo_chat || 'openai/gpt-oss-120b'
    );
    const [modeloInformesInst, setModeloInformesInst] = useState(
        configuracionInstitucional?.modelo_informes || 'openai/gpt-oss-120b'
    );
    const [apiKeyInst, setApiKeyInst] = useState('');
    const [mostrarKeyInst, setMostrarKeyInst] = useState(false);
    const [presupuestoUsd, setPresupuestoUsd] = useState(
        configuracionInstitucional?.presupuesto_mensual_usd ?? 15
    );
    const [alertaPct, setAlertaPct] = useState(
        configuracionInstitucional?.alerta_porcentaje ?? 80
    );
    const [limiteDiario, setLimiteDiario] = useState(
        configuracionInstitucional?.solicitudes_diarias_limite ?? 2000
    );
    const [permitirPersonal, setPermitirPersonal] = useState(
        configuracionInstitucional?.permitir_clave_personal_docentes ?? true
    );
    const [mostrarOtrosProveedores, setMostrarOtrosProveedores] = useState(false);
    const [mostrarAvanzadoInst, setMostrarAvanzadoInst] = useState(false);
    const [mostrarSimulador, setMostrarSimulador] = useState(false);
    const [modelosDetectadosInst, setModelosDetectadosInst] = useState([]);
    const [probandoInst, setProbandoInst] = useState(false);
    const [resultadoInst, setResultadoInst] = useState(null);
    const [guardandoInst, setGuardandoInst] = useState(false);

    // --- Estado de prueba de conexión activa ---
    const [probandoActiva, setProbandoActiva] = useState(false);
    const [resultadoActiva, setResultadoActiva] = useState(null);

    // --- Simulador de costo escolar ---
    const [docentesSim, setDocentesSim] = useState(40);
    const [consultasDiaSim, setConsultasDiaSim] = useState(5);

    // --- Clave personal (BYOK opcional) ---
    const [abrirPersonal, setAbrirPersonal] = useState(modelosPersonalizados.length > 0);
    const [provPersonal, setProvPersonal] = useState('groq');
    const [keyPersonal, setKeyPersonal] = useState('');
    const [mostrarKeyPersonal, setMostrarKeyPersonal] = useState(false);
    const [modelIdPersonal, setModelIdPersonal] = useState('openai/gpt-oss-120b');
    const [nombrePersonal, setNombrePersonal] = useState('');
    const [modelosDetectadosPers, setModelosDetectadosPers] = useState([]);
    const [probandoPers, setProbandoPers] = useState(false);
    const [resultadoPers, setResultadoPers] = useState(null);
    const [guardandoPers, setGuardandoPers] = useState(false);

    useEffect(() => {
        if (!configuracionInstitucional) return;
        const planId = configuracionInstitucional.plan_activo || 'gratuito_groq';
        setPlanSeleccionadoId(planId);
        setProveedorInst(configuracionInstitucional.proveedor || 'groq');
        setModeloChatInst(configuracionInstitucional.modelo_chat || 'openai/gpt-oss-120b');
        setModeloInformesInst(configuracionInstitucional.modelo_informes || 'openai/gpt-oss-120b');
        if (configuracionInstitucional.presupuesto_mensual_usd !== undefined) {
            setPresupuestoUsd(configuracionInstitucional.presupuesto_mensual_usd);
        }
        if (configuracionInstitucional.alerta_porcentaje !== undefined) {
            setAlertaPct(configuracionInstitucional.alerta_porcentaje);
        }
        if (configuracionInstitucional.solicitudes_diarias_limite !== undefined) {
            setLimiteDiario(configuracionInstitucional.solicitudes_diarias_limite);
        }
        if (configuracionInstitucional.permitir_clave_personal_docentes !== undefined) {
            setPermitirPersonal(Boolean(configuracionInstitucional.permitir_clave_personal_docentes));
        }
        const esSecundario = planesColegio.some((p) => p.id === planId && !p.principal);
        if (esSecundario) setMostrarOtrosProveedores(true);
    }, [configuracionInstitucional]);

    const planesPrincipales = planesColegio.filter((p) => p.principal);
    const planesSecundarios = planesColegio.filter((p) => !p.principal);
    const planActualObj =
        planesColegio.find((p) => p.id === planSeleccionadoId) || planesPrincipales[0] || null;
    const provInstObj = PROVEEDORES_IA.find((p) => p.id === proveedorInst) || PROVEEDORES_IA[0];
    const provPersObj = PROVEEDORES_IA.find((p) => p.id === provPersonal) || PROVEEDORES_IA[0];
    const esPlanPago = planActualObj?.categoria === 'pago';
    const tieneClaveBd = Boolean(configuracionInstitucional?.tiene_clave_bd);
    const mismoProveedorBd = proveedorInst === configuracionInstitucional?.proveedor;

    const elegirPlan = (plan) => {
        setPlanSeleccionadoId(plan.id);
        setProveedorInst(plan.proveedor);
        setModeloChatInst(plan.modelo_chat_sugerido);
        setModeloInformesInst(plan.modelo_informes_sugerido);
        setPresupuestoUsd(plan.presupuesto_sugerido_usd ?? 0);
        setLimiteDiario(plan.solicitudes_diarias_sugeridas ?? 2000);
        setModelosDetectadosInst([]);
        setResultadoInst(null);
    };

    const probarConexionActiva = async () => {
        if (probandoActiva) return;
        setProbandoActiva(true);
        setResultadoActiva(null);
        try {
            const { data } = await axios.post('/configuracion/probar-ia', {
                verificar_respuesta: true,
            });
            setResultadoActiva({
                ok: true,
                latencyMs: data?.latencyMs,
                message: data?.message || 'Conexión y respuesta verificadas.',
            });
        } catch (err) {
            setResultadoActiva({
                ok: false,
                message:
                    err.response?.data?.message ||
                    'No fue posible validar la conexión activa.',
            });
        } finally {
            setProbandoActiva(false);
        }
    };

    const volverAPlanColegio = async () => {
        if (guardandoPers) return;
        setGuardandoPers(true);
        try {
            const { data } = await axios.post('/configuracion/ia', {
                accion: 'usar_plan_institucional',
            });
            setResultadoActiva(null);
            onServidorActualizado?.(data?.configuracionIA, null);
            onNotificar?.(data?.message || 'Plan del colegio activado en tu cuenta.');
        } catch (err) {
            onError?.(err.response?.data?.message || 'No se pudo activar el plan del colegio.');
        } finally {
            setGuardandoPers(false);
        }
    };

    const probarClaveInstitucional = async () => {
        if (probandoInst) return;
        const usaClaveInput = apiKeyInst.trim() !== '';
        if (!usaClaveInput && !configuracionInstitucional?.configurada) {
            setResultadoInst({
                ok: false,
                message: 'Pega primero la API Key para verificarla.',
            });
            return;
        }
        setProbandoInst(true);
        setResultadoInst(null);
        try {
            const payload = usaClaveInput
                ? {
                      proveedor: proveedorInst,
                      api_key: apiKeyInst.trim(),
                      model_id: modeloChatInst.trim(),
                      verificar_respuesta: true,
                  }
                : {
                      probar_institucional: true,
                      model_id: modeloChatInst.trim(),
                      verificar_respuesta: true,
                  };
            const { data } = await axios.post('/configuracion/probar-ia', payload);
            const detectados = Array.isArray(data?.models) ? data.models : [];
            setModelosDetectadosInst(detectados);
            if (detectados.length > 0 && !modeloChatInst.trim()) {
                setModeloChatInst(detectados[0]);
            }
            setResultadoInst({
                ok: true,
                latencyMs: data?.latencyMs,
                message: data?.message || 'Clave y modelo verificados correctamente.',
            });
        } catch (err) {
            const detectados = Array.isArray(err.response?.data?.models)
                ? err.response.data.models
                : [];
            if (detectados.length > 0) setModelosDetectadosInst(detectados);
            setResultadoInst({
                ok: false,
                message:
                    err.response?.data?.message ||
                    'No fue posible validar esta API Key con el proveedor.',
            });
        } finally {
            setProbandoInst(false);
        }
    };

    const guardarPlanInstitucional = async (e) => {
        e.preventDefault();
        if (guardandoInst || !modeloChatInst.trim()) return;

        if (!apiKeyInst.trim() && !tieneClaveBd && !configuracionInstitucional?.tiene_clave_env) {
            onError?.(`Ingresa la API Key de ${provInstObj.nombre} para activar este plan.`);
            return;
        }
        if (!apiKeyInst.trim() && tieneClaveBd && !mismoProveedorBd) {
            onError?.(`Cambiaste a ${provInstObj.nombre}. Ingresa su API Key correspondiente.`);
            return;
        }

        setGuardandoInst(true);
        try {
            const { data } = await axios.post('/configuracion/ia', {
                accion: 'guardar_institucional',
                plan_activo: planSeleccionadoId,
                proveedor: proveedorInst,
                api_key: apiKeyInst.trim() || null,
                modelo_chat: modeloChatInst.trim(),
                modelo_informes: (modeloInformesInst || modeloChatInst).trim(),
                presupuesto_mensual_usd: esPlanPago ? Number(presupuestoUsd) || 0 : 0,
                alerta_porcentaje: Number(alertaPct) || 80,
                solicitudes_diarias_limite: Number(limiteDiario) || 2000,
                permitir_clave_personal_docentes: permitirPersonal,
                verificada: Boolean(resultadoInst?.ok),
            });
            setApiKeyInst('');
            setResultadoActiva(null);
            onServidorActualizado?.(data?.configuracionIA, data?.configuracionInstitucional);
            onNotificar?.(data?.message || 'Plan de IA guardado y activo para todo el colegio.');
        } catch (err) {
            const primerError = Object.values(err.response?.data?.errors || {}).flat()[0];
            onError?.(
                primerError ||
                    err.response?.data?.message ||
                    'No se pudo guardar el plan institucional.'
            );
        } finally {
            setGuardandoInst(false);
        }
    };

    const probarClavePersonal = async () => {
        if (!keyPersonal.trim() || probandoPers) return;
        setProbandoPers(true);
        setResultadoPers(null);
        try {
            const { data } = await axios.post('/configuracion/probar-ia', {
                proveedor: provPersonal,
                api_key: keyPersonal.trim(),
                model_id: modelIdPersonal.trim(),
                verificar_respuesta: true,
            });
            const detectados = Array.isArray(data?.models) ? data.models : [];
            setModelosDetectadosPers(detectados);
            if (
                detectados.length > 0 &&
                (!modelIdPersonal.trim() || !detectados.includes(modelIdPersonal.trim()))
            ) {
                setModelIdPersonal(detectados[0]);
            }
            setResultadoPers({
                ok: true,
                latencyMs: data?.latencyMs,
                message: data?.message || 'API Key personal verificada.',
            });
        } catch (err) {
            const detectados = Array.isArray(err.response?.data?.models)
                ? err.response.data.models
                : [];
            if (detectados.length > 0) setModelosDetectadosPers(detectados);
            setResultadoPers({
                ok: false,
                message:
                    err.response?.data?.message ||
                    'No fue posible validar esta API Key personal.',
            });
        } finally {
            setProbandoPers(false);
        }
    };

    const guardarClavePersonal = async (e) => {
        e.preventDefault();
        if (!keyPersonal.trim() || !modelIdPersonal.trim() || guardandoPers) return;
        setGuardandoPers(true);
        try {
            const nombreLimpio =
                nombrePersonal.trim() ||
                provPersObj.modelosSugeridos?.find((m) => m.id === modelIdPersonal.trim())
                    ?.nombre ||
                modelIdPersonal.trim();

            const { data } = await axios.post('/configuracion/ia', {
                accion: 'agregar_modelo',
                proveedor: provPersonal,
                model_id: modelIdPersonal.trim(),
                nombre: nombreLimpio,
                subtitulo: `${provPersObj.nombre} · Clave personal`,
                api_key: keyPersonal.trim(),
                activar_inmediatamente: true,
            });
            setKeyPersonal('');
            setNombrePersonal('');
            setResultadoPers(null);
            setResultadoActiva(null);
            onServidorActualizado?.(data?.configuracionIA, null);
            onNotificar?.(`Modelo personal "${nombreLimpio}" guardado y activado.`);
        } catch (err) {
            onError?.(
                err.response?.data?.message ||
                    'Revisa el ID del modelo y que la API Key tenga al menos 6 caracteres.'
            );
        } finally {
            setGuardandoPers(false);
        }
    };

    const activarModeloPersonal = async (modelo) => {
        if (guardandoPers) return;
        setGuardandoPers(true);
        try {
            const { data } = await axios.post('/configuracion/ia', {
                accion: 'actualizar_preferencias',
                modelo_activo_id: modelo.id,
                modelo_chat_id: modelo.id,
                modelo_informes_id: modelo.id,
            });
            setResultadoActiva(null);
            onServidorActualizado?.(data?.configuracionIA, null);
            onNotificar?.(`Modelo "${modelo.nombre}" activado.`);
        } catch {
            onError?.('No se pudo activar el modelo seleccionado.');
        } finally {
            setGuardandoPers(false);
        }
    };

    const eliminarModeloPersonal = async (modelo) => {
        if (guardandoPers) return;
        setGuardandoPers(true);
        try {
            const { data } = await axios.post('/configuracion/ia', {
                accion: 'eliminar_modelo',
                modelo_id: modelo.id,
            });
            setResultadoActiva(null);
            onServidorActualizado?.(data?.configuracionIA, null);
            onNotificar?.(`Modelo "${modelo.nombre}" eliminado.`);
        } catch {
            onError?.('No se pudo eliminar el modelo personal.');
        } finally {
            setGuardandoPers(false);
        }
    };

    const sugeridosInst =
        modelosDetectadosInst.length > 0
            ? modelosDetectadosInst.slice(0, 6).map((id) => ({ id, nombre: id, etiqueta: 'Disponible' }))
            : provInstObj.modelosSugeridos || [];

    const sugeridosPers =
        modelosDetectadosPers.length > 0
            ? modelosDetectadosPers.slice(0, 6).map((id) => ({ id, nombre: id, etiqueta: 'Disponible' }))
            : provPersObj.modelosSugeridos || [];

    const estimacionActual = estimarCostoMensualPlan(planActualObj, docentesSim, consultasDiaSim);

    return (
        <div className="space-y-6">
            {/* 1. BARRA DE ESTADO REAL EN VIVO (siempre honesta) */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <span
                            className={`mt-1 w-3 h-3 rounded-full shrink-0 ${
                                conexionActiva?.configurada ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                        />
                        <div>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                                {conexionActiva?.configurada
                                    ? `Conectado · ${conexionActiva.proveedor_nombre}`
                                    : 'Sin API Key activa'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {conexionActiva?.configurada ? (
                                    <>
                                        Modelo activo:{' '}
                                        <strong className="text-slate-800">
                                            {conexionActiva.modelo_nombre}
                                        </strong>{' '}
                                        ({conexionActiva.plan_nombre || 'Plan del colegio'})
                                    </>
                                ) : (
                                    'Elige un proveedor abajo y conecta una API Key para activar el Copiloto e Informes.'
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {conexionActiva?.origen === 'personal' &&
                            configuracionInstitucional?.configurada && (
                                <button
                                    type="button"
                                    onClick={volverAPlanColegio}
                                    disabled={guardandoPers}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Usar plan del colegio
                                </button>
                            )}
                        <button
                            type="button"
                            onClick={probarConexionActiva}
                            disabled={probandoActiva || !conexionActiva?.configurada}
                            className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {probandoActiva ? 'Probando respuesta...' : 'Probar conexión'}
                        </button>
                    </div>
                </div>

                {resultadoActiva && (
                    <div
                        role="status"
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                            resultadoActiva.ok
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                    >
                        <span>{resultadoActiva.message}</span>
                        {resultadoActiva.latencyMs ? (
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-700 shrink-0 tabular-nums">
                                {resultadoActiva.latencyMs} ms
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* 2. HUB MASTER-DETAIL: PROVEEDOR Y PLAN DEL COLEGIO */}
            {esAdministrador ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-900">
                                Proveedor y Plan del Colegio
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Selecciona una tarjeta para configurar la clave institucional compartida por todos los docentes.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMostrarSimulador((v) => !v)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto"
                        >
                            {mostrarSimulador ? 'Ocultar simulador de costos' : 'Simular costo mensual'}
                        </button>
                    </div>

                    {/* MASTER: 3 TARJETAS PRINCIPALES (Groq Free, Groq Developer, OpenAI ChatGPT) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {planesPrincipales.map((plan) => {
                            const seleccionado = planSeleccionadoId === plan.id;
                            const activoEnColegio =
                                configuracionInstitucional?.configurada &&
                                configuracionInstitucional?.plan_activo === plan.id;
                            const est = estimarCostoMensualPlan(plan, docentesSim, consultasDiaSim);

                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => elegirPlan(plan)}
                                    aria-pressed={seleccionado}
                                    className={`p-4 rounded-xl border text-left transition-all bg-white flex flex-col justify-between gap-3 ${
                                        seleccionado
                                            ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-sm font-extrabold text-slate-900 leading-tight">
                                                {plan.nombre}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                                                    activoEnColegio
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : plan.destacado
                                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                {activoEnColegio ? 'Activo' : plan.etiqueta}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{plan.subtitulo}</p>
                                    </div>

                                    <div className="pt-2.5 border-t border-slate-100 flex items-baseline justify-between gap-2">
                                        <span className="text-base font-extrabold text-slate-900 tabular-nums">
                                            {plan.categoria === 'gratuito'
                                                ? '$0 / mes'
                                                : `~${formatearUsd(est.usd)} / mes`}
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                            {plan.categoria === 'gratuito'
                                                ? 'Free Key'
                                                : formatearClpAprox(est.clp)}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Toggle limpio para otros proveedores sin saturar */}
                    {planesSecundarios.length > 0 && (
                        <div className="space-y-2.5">
                            <button
                                type="button"
                                onClick={() => setMostrarOtrosProveedores((v) => !v)}
                                className="text-xs font-bold text-slate-600 hover:text-sape-burdeo transition-colors"
                            >
                                {mostrarOtrosProveedores
                                    ? 'Ocultar otros proveedores'
                                    : 'Ver otros proveedores compatibles (Gemini, OpenRouter, Claude)'}
                            </button>

                            {mostrarOtrosProveedores && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {planesSecundarios.map((plan) => {
                                        const seleccionado = planSeleccionadoId === plan.id;
                                        const est = estimarCostoMensualPlan(
                                            plan,
                                            docentesSim,
                                            consultasDiaSim
                                        );
                                        return (
                                            <button
                                                key={plan.id}
                                                type="button"
                                                onClick={() => elegirPlan(plan)}
                                                aria-pressed={seleccionado}
                                                className={`px-3.5 py-2.5 rounded-xl border text-left transition-all bg-white flex items-center justify-between gap-2 ${
                                                    seleccionado
                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <span className="block text-xs font-extrabold text-slate-900 truncate">
                                                        {plan.nombre}
                                                    </span>
                                                    <span className="block text-[11px] text-slate-500 truncate">
                                                        {plan.etiqueta}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-extrabold text-slate-700 tabular-nums shrink-0">
                                                    ~{formatearUsd(est.usd)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* DETAIL: PANEL ENFOCADO DEL PLAN SELECCIONADO */}
                    <form
                        onSubmit={guardarPlanInstitucional}
                        className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                            <div>
                                <h4 className="text-sm font-extrabold text-slate-900">
                                    Configurar {planActualObj?.nombre}
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {planActualObj?.limites_resumen}
                                </p>
                            </div>
                            {provInstObj.consoleUrl && (
                                <a
                                    href={provInstObj.consoleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sape-burdeo hover:underline self-start sm:self-auto"
                                >
                                    <span>Obtener API Key en {provInstObj.consoleLabel}</span>
                                    <IconoEnlaceExterno />
                                </a>
                            )}
                        </div>

                        {/* API Key + Ping instantáneo */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label
                                    htmlFor="hubApiKeyInst"
                                    className="text-xs font-bold text-slate-700"
                                >
                                    API Key de {provInstObj.nombre}
                                </label>
                                {tieneClaveBd && mismoProveedorBd && (
                                    <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                                        Guardada: {configuracionInstitucional.api_key_masked}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5">
                                <div className="relative flex-1">
                                    <input
                                        id="hubApiKeyInst"
                                        type={mostrarKeyInst ? 'text' : 'password'}
                                        value={apiKeyInst}
                                        onChange={(e) => setApiKeyInst(e.target.value)}
                                        placeholder={
                                            tieneClaveBd && mismoProveedorBd
                                                ? 'Dejar vacío para conservar la clave guardada'
                                                : provInstObj.placeholderKey
                                        }
                                        className="w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 pr-20 focus:border-sape-burdeo focus:ring-sape-burdeo font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarKeyInst((v) => !v)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100"
                                    >
                                        {mostrarKeyInst ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={probarClaveInstitucional}
                                    disabled={probandoInst}
                                    className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                                >
                                    {probandoInst ? 'Verificando...' : 'Probar y cargar modelos'}
                                </button>
                            </div>

                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <IconoCandado />
                                <span>
                                    Cifrada con AES-256 en base de datos. Los nombres y RUTs de estudiantes se anonimizan antes de salir (Ley 19.628).
                                </span>
                            </p>

                            {resultadoInst && (
                                <div
                                    role="status"
                                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                                        resultadoInst.ok
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            : 'bg-red-50 border-red-200 text-red-800'
                                    }`}
                                >
                                    <span>{resultadoInst.message}</span>
                                    {resultadoInst.latencyMs ? (
                                        <span className="font-mono font-bold tabular-nums shrink-0">
                                            {resultadoInst.latencyMs} ms
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Selector de Modelo + Presupuesto */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label
                                    htmlFor="hubModeloChatInst"
                                    className="block text-xs font-bold text-slate-700"
                                >
                                    Modelo principal
                                </label>
                                <input
                                    id="hubModeloChatInst"
                                    type="text"
                                    value={modeloChatInst}
                                    onChange={(e) => {
                                        setModeloChatInst(e.target.value);
                                        if (!mostrarAvanzadoInst) {
                                            setModeloInformesInst(e.target.value);
                                        }
                                    }}
                                    className="w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo font-mono"
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {sugeridosInst.map((mod) => (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => {
                                                setModeloChatInst(mod.id);
                                                if (!mostrarAvanzadoInst) {
                                                    setModeloInformesInst(mod.id);
                                                }
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                                modeloChatInst === mod.id
                                                    ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {mod.nombre}
                                            {mod.etiqueta ? ` · ${mod.etiqueta}` : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="hubPresupuestoInst"
                                    className="block text-xs font-bold text-slate-700"
                                >
                                    {esPlanPago ? 'Presupuesto mensual (USD)' : 'Costo del plan'}
                                </label>
                                {esPlanPago ? (
                                    <>
                                        <div className="flex items-center gap-2.5">
                                            <input
                                                id="hubPresupuestoInst"
                                                type="number"
                                                min="1"
                                                max="5000"
                                                step="1"
                                                value={presupuestoUsd}
                                                onChange={(e) => setPresupuestoUsd(e.target.value)}
                                                className="w-28 rounded-xl border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo tabular-nums"
                                            />
                                            <span className="text-xs text-slate-600 tabular-nums">
                                                Estimado:{' '}
                                                <strong className="text-slate-900">
                                                    ~{formatearUsd(estimacionActual.usd)}/mes
                                                </strong>
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Alerta visual a Dirección al alcanzar {alertaPct}% del tope mensual.
                                        </p>
                                    </>
                                ) : (
                                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                                        <strong className="text-slate-900">$0 USD/mes.</strong> Ideal para iniciar; si aumentan los docentes en cierres de semestre, cambia a{' '}
                                        <strong className="text-slate-900">Groq Developer</strong> o{' '}
                                        <strong className="text-slate-900">OpenAI</strong>.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Progressive Disclosure: Opciones avanzadas */}
                        <div className="pt-2 border-t border-slate-200 space-y-3">
                            <button
                                type="button"
                                onClick={() => setMostrarAvanzadoInst((v) => !v)}
                                className="text-xs font-bold text-slate-600 hover:text-sape-burdeo transition-colors"
                            >
                                {mostrarAvanzadoInst
                                    ? 'Ocultar opciones avanzadas'
                                    : 'Opciones avanzadas (modelo informes, límites y permisos)'}
                            </button>

                            {mostrarAvanzadoInst && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200">
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="hubModeloInformes"
                                            className="block text-xs font-bold text-slate-700"
                                        >
                                            Modelo para Informes
                                        </label>
                                        <input
                                            id="hubModeloInformes"
                                            type="text"
                                            value={modeloInformesInst}
                                            onChange={(e) => setModeloInformesInst(e.target.value)}
                                            className="w-full rounded-lg border-slate-300 text-xs text-slate-900 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="hubLimiteDiario"
                                            className="block text-xs font-bold text-slate-700"
                                        >
                                            Límite diario colegio
                                        </label>
                                        <input
                                            id="hubLimiteDiario"
                                            type="number"
                                            min="100"
                                            max="50000"
                                            step="100"
                                            value={limiteDiario}
                                            onChange={(e) => setLimiteDiario(e.target.value)}
                                            className="w-full rounded-lg border-slate-300 text-xs text-slate-900 tabular-nums"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="hubAlertaPct"
                                            className="block text-xs font-bold text-slate-700"
                                        >
                                            Alerta presupuesto (%)
                                        </label>
                                        <input
                                            id="hubAlertaPct"
                                            type="number"
                                            min="10"
                                            max="100"
                                            value={alertaPct}
                                            onChange={(e) => setAlertaPct(e.target.value)}
                                            className="w-full rounded-lg border-slate-300 text-xs text-slate-900 tabular-nums"
                                        />
                                    </div>
                                    <label className="sm:col-span-3 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                                        <input
                                            type="checkbox"
                                            checked={permitirPersonal}
                                            onChange={(e) => setPermitirPersonal(e.target.checked)}
                                            className="rounded text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                        />
                                        Permitir que cada docente conecte su propia API Key opcional
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={guardandoInst || !modeloChatInst.trim()}
                                className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                            >
                                {guardandoInst
                                    ? 'Guardando...'
                                    : 'Guardar y activar para el colegio'}
                            </button>
                        </div>
                    </form>

                    {/* SIMULADOR DE COSTO MENSUAL DEL COLEGIO */}
                    {mostrarSimulador && (
                        <div className="pt-4 border-t border-slate-200 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-extrabold text-slate-900">
                                        Simulador de Costo Mensual del Colegio
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Estimación sobre 20 días hábiles (~2.000 tokens entrada y ~500 salida por consulta).
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        Docentes:
                                        <input
                                            type="number"
                                            min="1"
                                            max="300"
                                            value={docentesSim}
                                            onChange={(e) => setDocentesSim(Number(e.target.value) || 1)}
                                            className="w-16 rounded-lg border-slate-300 bg-white text-xs text-slate-900 py-1 tabular-nums"
                                        />
                                    </label>
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        Cons./día:
                                        <input
                                            type="number"
                                            min="1"
                                            max="40"
                                            value={consultasDiaSim}
                                            onChange={(e) =>
                                                setConsultasDiaSim(Number(e.target.value) || 1)
                                            }
                                            className="w-14 rounded-lg border-slate-300 bg-white text-xs text-slate-900 py-1 tabular-nums"
                                        />
                                    </label>
                                    <span className="text-xs font-extrabold text-sape-burdeo tabular-nums">
                                        {(docentesSim * consultasDiaSim * 20).toLocaleString('es-CL')} /mes
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                                            <th className="py-2 pr-3 font-bold">Plan</th>
                                            <th className="py-2 px-3 font-bold">Modelo</th>
                                            <th className="py-2 px-3 font-bold">1M tokens</th>
                                            <th className="py-2 px-3 font-bold">Estimado mes</th>
                                            <th className="py-2 pl-3 font-bold text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {planesColegio.map((plan) => {
                                            const est = estimarCostoMensualPlan(
                                                plan,
                                                docentesSim,
                                                consultasDiaSim
                                            );
                                            const elegido = planSeleccionadoId === plan.id;
                                            return (
                                                <tr
                                                    key={plan.id}
                                                    className={elegido ? 'bg-slate-50' : 'bg-white'}
                                                >
                                                    <td className="py-2.5 pr-3">
                                                        <span className="font-extrabold text-slate-900 block">
                                                            {plan.nombre}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {plan.ideal_para}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                                        {plan.modelo_chat_sugerido}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-700 tabular-nums whitespace-nowrap">
                                                        {plan.categoria === 'gratuito'
                                                            ? '$0 / $0'
                                                            : `$${plan.entrada_por_millon} / $${plan.salida_por_millon}`}
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        <span className="font-extrabold text-slate-900 block tabular-nums">
                                                            {plan.categoria === 'gratuito'
                                                                ? '$0 USD'
                                                                : `~${formatearUsd(est.usd)} USD`}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500 tabular-nums">
                                                            {formatearClpAprox(est.clp)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 pl-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => elegirPlan(plan)}
                                                            className={`px-3 py-1 rounded-lg text-xs font-extrabold border transition-colors ${
                                                                elegido
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : 'bg-slate-100 hover:bg-sape-burdeo hover:text-sape-amarillo text-slate-800 border-slate-200'
                                                            }`}
                                                        >
                                                            {elegido ? 'Elegido' : 'Elegir'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Vista limpia de solo lectura del plan del colegio para Docentes */
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-900">
                                Plan de IA del Colegio
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Gestionado por Dirección para el Copiloto Pedagógico y los Informes IA.
                            </p>
                        </div>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold border self-start sm:self-auto ${
                                configuracionInstitucional?.configurada
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                        >
                            {configuracionInstitucional?.configurada ? 'Activo' : 'Pendiente'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <span className="text-xs text-slate-500 font-semibold block">Plan</span>
                            <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                                {configuracionInstitucional?.plan_nombre || 'Groq Cloud · Free Key'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-semibold block">Proveedor</span>
                            <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                                {configuracionInstitucional?.proveedor_nombre || 'Groq Cloud'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-semibold block">Modelo</span>
                            <span className="text-xs font-mono font-bold text-slate-900 block mt-1">
                                {configuracionInstitucional?.modelo_chat || 'openai/gpt-oss-120b'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. MI CLAVE PERSONAL (BYOK OPCIONAL — COLAPSABLE) */}
            {(esAdministrador ||
                configuracionInstitucional?.permitir_clave_personal_docentes !== false) && (
                <div
                    id="agregar-modelo-api-key"
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900">
                                Mi API Key Personal (Opcional)
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Usa tu propia cuenta de Groq, ChatGPT/OpenAI u otro proveedor solo en tu sesión.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAbrirPersonal((v) => !v)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto"
                        >
                            {abrirPersonal ? 'Ocultar' : '+ Conectar clave personal'}
                        </button>
                    </div>

                    {/* Modelos personales guardados */}
                    {modelosPersonalizados.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {modelosPersonalizados.map((mod) => {
                                const esActivo =
                                    conexionActiva?.origen === 'personal' &&
                                    conexionActiva?.modelo_id === mod.id;
                                return (
                                    <div
                                        key={mod.id}
                                        className={`p-4 rounded-xl border bg-white flex flex-col justify-between gap-3 ${
                                            esActivo
                                                ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-extrabold text-slate-900">
                                                    {mod.nombre}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                    {mod.proveedor_nombre}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-mono text-slate-500 truncate">
                                                {mod.model_id}
                                            </p>
                                            {mod.api_key_masked && (
                                                <p className="text-[11px] font-mono text-slate-500">
                                                    Clave: {mod.api_key_masked}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => activarModeloPersonal(mod)}
                                                disabled={guardandoPers}
                                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold border transition-colors ${
                                                    esActivo
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 hover:bg-sape-burdeo hover:text-sape-amarillo text-slate-800 border-slate-200'
                                                }`}
                                            >
                                                {esActivo ? 'Activo' : 'Usar'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => eliminarModeloPersonal(mod)}
                                                disabled={guardandoPers}
                                                className="py-1.5 px-2.5 rounded-lg text-xs font-bold text-red-700 bg-white border border-red-200 hover:bg-red-600 hover:text-white transition-colors"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {abrirPersonal && (
                        <form
                            onSubmit={guardarClavePersonal}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4"
                        >
                            <div className="flex flex-wrap gap-2">
                                {PROVEEDORES_IA.map((prov) => {
                                    const activo = provPersonal === prov.id;
                                    return (
                                        <button
                                            key={prov.id}
                                            type="button"
                                            onClick={() => {
                                                setProvPersonal(prov.id);
                                                setModelosDetectadosPers([]);
                                                setResultadoPers(null);
                                                setNombrePersonal('');
                                                if (prov.modelosSugeridos?.length > 0) {
                                                    setModelIdPersonal(prov.modelosSugeridos[0].id);
                                                }
                                            }}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                                                activo
                                                    ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {prov.nombre}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label
                                        htmlFor="hubKeyPersonal"
                                        className="text-xs font-bold text-slate-700"
                                    >
                                        API Key de {provPersObj.nombre}
                                    </label>
                                    {provPersObj.consoleUrl && (
                                        <a
                                            href={provPersObj.consoleUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sape-burdeo hover:underline"
                                        >
                                            <span>Abrir {provPersObj.consoleLabel}</span>
                                            <IconoEnlaceExterno />
                                        </a>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                    <div className="relative flex-1">
                                        <input
                                            id="hubKeyPersonal"
                                            type={mostrarKeyPersonal ? 'text' : 'password'}
                                            value={keyPersonal}
                                            onChange={(e) => setKeyPersonal(e.target.value)}
                                            placeholder={provPersObj.placeholderKey}
                                            className="w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 pr-20 focus:border-sape-burdeo focus:ring-sape-burdeo font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarKeyPersonal((v) => !v)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100"
                                        >
                                            {mostrarKeyPersonal ? 'Ocultar' : 'Mostrar'}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={probarClavePersonal}
                                        disabled={!keyPersonal.trim() || probandoPers}
                                        className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        {probandoPers ? 'Verificando...' : 'Probar y cargar modelos'}
                                    </button>
                                </div>

                                {resultadoPers && (
                                    <div
                                        role="status"
                                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                                            resultadoPers.ok
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                : 'bg-red-50 border-red-200 text-red-800'
                                        }`}
                                    >
                                        <span>{resultadoPers.message}</span>
                                        {resultadoPers.latencyMs ? (
                                            <span className="font-mono font-bold tabular-nums shrink-0">
                                                {resultadoPers.latencyMs} ms
                                            </span>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="hubModelPersonal"
                                        className="block text-xs font-bold text-slate-700"
                                    >
                                        Modelo
                                    </label>
                                    <input
                                        id="hubModelPersonal"
                                        type="text"
                                        value={modelIdPersonal}
                                        onChange={(e) => setModelIdPersonal(e.target.value)}
                                        className="w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 font-mono"
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {sugeridosPers.map((mod) => (
                                            <button
                                                key={mod.id}
                                                type="button"
                                                onClick={() => {
                                                    setModelIdPersonal(mod.id);
                                                    setNombrePersonal(mod.nombre);
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                                    modelIdPersonal === mod.id
                                                        ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                {mod.nombre}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="hubNombrePersonal"
                                        className="block text-xs font-bold text-slate-700"
                                    >
                                        Nombre corto (opcional)
                                    </label>
                                    <input
                                        id="hubNombrePersonal"
                                        type="text"
                                        value={nombrePersonal}
                                        onChange={(e) => setNombrePersonal(e.target.value)}
                                        maxLength={48}
                                        placeholder="Ej: Mi Groq Developer"
                                        className="w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={
                                        !keyPersonal.trim() ||
                                        !modelIdPersonal.trim() ||
                                        guardandoPers
                                    }
                                    className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {guardandoPers ? 'Guardando...' : 'Guardar y activar en mi cuenta'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
