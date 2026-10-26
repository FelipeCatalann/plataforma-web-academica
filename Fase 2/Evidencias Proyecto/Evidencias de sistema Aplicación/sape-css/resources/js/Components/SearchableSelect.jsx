import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function SearchableSelect({
    options = [],
    value = '',
    onChange,
    placeholder = '-- Selecciona una opción --',
    searchPlaceholder = 'Buscar...',
    labelKey = 'name',
    subLabelKey = 'email',
    valueKey = 'id',
    getLabel = null,
    getSubLabel = null,
    emptyTitle = 'No se encontraron resultados',
    itemSingular = 'opción disponible',
    itemPlural = 'opciones disponibles',
    disabled = false,
    required = false,
    name = '',
    error = '',
    className = '',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Cerrar al hacer clic fuera del componente
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Foco automático en el input de búsqueda al abrir el menú
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) {
            setBusqueda('');
        }
    }, [isOpen]);

    // Helpers para obtener etiqueta principal y secundaria
    const obtenerLabel = (item) => {
        if (!item) return '';
        if (typeof getLabel === 'function') return getLabel(item);
        return item[labelKey] || '';
    };

    const obtenerSubLabel = (item) => {
        if (!item) return '';
        if (typeof getSubLabel === 'function') return getSubLabel(item);
        return subLabelKey && item[subLabelKey] ? item[subLabelKey] : '';
    };

    // Normalizar texto para búsqueda insensible a mayúsculas y tildes
    const normalizar = (txt) =>
        (txt || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

    // Filtrar opciones en base al texto buscado
    const opcionesFiltradas = useMemo(() => {
        if (!busqueda.trim()) return options;
        const q = normalizar(busqueda);
        return options.filter((item) => {
            const principal = normalizar(obtenerLabel(item));
            const secundario = normalizar(obtenerSubLabel(item));
            return principal.includes(q) || secundario.includes(q);
        });
    }, [options, busqueda, labelKey, subLabelKey, getLabel, getSubLabel]);

    const itemSeleccionado = useMemo(() => {
        return options.find((item) => String(item[valueKey]) === String(value));
    }, [options, value, valueKey]);

    const handleSelect = (item) => {
        if (onChange) {
            onChange(item ? item[valueKey] : '');
        }
        setIsOpen(false);
        setBusqueda('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange('');
        }
        setBusqueda('');
    };

    const labelSeleccionado = itemSeleccionado ? obtenerLabel(itemSeleccionado) : '';
    const subLabelSeleccionado = itemSeleccionado ? obtenerSubLabel(itemSeleccionado) : '';

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {/* Botón selector principal */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsOpen(false);
                }}
                className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-left flex items-center justify-between shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sape-burdeo focus:border-sape-burdeo ${
                    error
                        ? 'border-red-500 ring-1 ring-red-500'
                        : isOpen
                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20'
                        : 'border-sape-gris hover:border-gray-400'
                } ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2 truncate mr-2 flex-1">
                    {itemSeleccionado ? (
                        <div className="flex items-baseline gap-2 truncate">
                            <span className="font-semibold text-gray-800 text-sm truncate">
                                {labelSeleccionado}
                            </span>
                            {subLabelSeleccionado && (
                                <span className="text-xs text-gray-500 truncate">
                                    ({subLabelSeleccionado})
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-400 text-sm select-none">
                            {placeholder}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {itemSeleccionado && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            title="Limpiar selección"
                            onClick={handleClear}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') handleClear(e);
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </span>
                    )}

                    <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-sape-burdeo' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Input oculto para formularios / accesibilidad */}
            <input
                type="text"
                tabIndex={-1}
                name={name}
                value={value || ''}
                onChange={() => {}}
                required={required}
                className="sr-only"
                aria-hidden="true"
            />

            {/* Menú desplegable */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    {/* Caja de búsqueda integrada */}
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setIsOpen(false);
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-sape-burdeo focus:ring-1 focus:ring-sape-burdeo placeholder-gray-400"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lista con scroll */}
                    <ul
                        className="max-h-60 overflow-y-auto divide-y divide-gray-100"
                        role="listbox"
                    >
                        {opcionesFiltradas.length > 0 ? (
                            opcionesFiltradas.map((item) => {
                                const isSelected = String(item[valueKey]) === String(value);
                                const label = obtenerLabel(item);
                                const subLabel = obtenerSubLabel(item);

                                return (
                                    <li
                                        key={item[valueKey]}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelect(item)}
                                        className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                                            isSelected
                                                ? 'bg-sape-burdeo/10 text-sape-burdeo font-semibold'
                                                : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <div className="flex flex-col text-left truncate mr-3">
                                            <span className="text-sm font-medium text-gray-900 leading-tight">
                                                {label}
                                            </span>
                                            {subLabel && (
                                                <span className="text-xs text-gray-500 mt-0.5 truncate">
                                                    {subLabel}
                                                </span>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <svg className="w-5 h-5 text-sape-burdeo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </li>
                                );
                            })
                        ) : (
                            <li className="px-4 py-6 text-center text-sm text-gray-500">
                                <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="font-medium text-gray-700">{emptyTitle}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    No hay resultados que coincidan con "{busqueda}"
                                </p>
                            </li>
                        )}
                    </ul>

                    {/* Pie del menú */}
                    <div className="px-3.5 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                        <span>
                            {opcionesFiltradas.length}{' '}
                            {opcionesFiltradas.length === 1 ? itemSingular : itemPlural}
                        </span>
                        {itemSeleccionado && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                            >
                                Limpiar selección
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}
