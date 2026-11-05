import React, { useState, useRef, useEffect, useMemo, useId } from 'react';

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
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    const listRef = useRef(null);
    const uid = useId();
    const listboxId = `${name || 'select'}-${uid}-listbox`;

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

    // Sincronizar índice resaltado cuando cambian las opciones filtradas o se abre el menú
    useEffect(() => {
        if (!isOpen) return;
        const idxActual = opcionesFiltradas.findIndex(
            (item) => String(item[valueKey]) === String(value)
        );
        setHighlightedIndex(idxActual >= 0 ? idxActual : 0);
    }, [isOpen, busqueda, opcionesFiltradas.length]);

    // Asegurar que la opción resaltada sea visible dentro del scroll
    useEffect(() => {
        if (!isOpen || !listRef.current) return;
        const activeEl = listRef.current.querySelector(`[data-option-index="${highlightedIndex}"]`);
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isOpen]);

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

    const manejarTeclado = (e) => {
        if (disabled) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            return;
        }
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setIsOpen(true);
            return;
        }
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (opcionesFiltradas.length > 0) {
                setHighlightedIndex((prev) => (prev + 1) % opcionesFiltradas.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (opcionesFiltradas.length > 0) {
                setHighlightedIndex((prev) =>
                    prev - 1 < 0 ? opcionesFiltradas.length - 1 : prev - 1
                );
            }
        } else if (e.key === 'Home' && opcionesFiltradas.length > 0) {
            e.preventDefault();
            setHighlightedIndex(0);
        } else if (e.key === 'End' && opcionesFiltradas.length > 0) {
            e.preventDefault();
            setHighlightedIndex(opcionesFiltradas.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = opcionesFiltradas[highlightedIndex];
            if (item) {
                handleSelect(item);
            }
        }
    };

    const labelSeleccionado = itemSeleccionado ? obtenerLabel(itemSeleccionado) : '';
    const subLabelSeleccionado = itemSeleccionado ? obtenerSubLabel(itemSeleccionado) : '';
    const activeOptionId =
        isOpen && opcionesFiltradas[highlightedIndex]
            ? `${listboxId}-opt-${highlightedIndex}`
            : undefined;

    return (
        <div
            ref={containerRef}
            className={`relative w-full ${isOpen ? 'z-40' : 'z-10'} ${className}`}
        >
            {/* Contenedor del selector principal con botón de limpiar desanidado */}
            <div className="relative flex items-center">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={manejarTeclado}
                    className={`w-full bg-white border rounded-xl pl-3.5 ${
                        itemSeleccionado && !disabled ? 'pr-16' : 'pr-9'
                    } py-2.5 text-left flex items-center justify-between shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sape-burdeo focus:border-sape-burdeo ${
                        error
                            ? 'border-red-500 ring-1 ring-red-500'
                            : isOpen
                              ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20'
                              : 'border-slate-300 hover:border-slate-400'
                    } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? listboxId : undefined}
                >
                    <div className="flex items-center gap-2 truncate flex-1">
                        {itemSeleccionado ? (
                            <div className="flex items-baseline gap-2 truncate">
                                <span className="font-bold text-slate-900 text-sm truncate">
                                    {labelSeleccionado}
                                </span>
                                {subLabelSeleccionado && (
                                    <span className="text-xs text-slate-600 truncate">
                                        ({subLabelSeleccionado})
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-slate-500 text-sm select-none">
                                {placeholder}
                            </span>
                        )}
                    </div>
                </button>

                <div className="absolute right-2 inset-y-0 flex items-center gap-0.5 pointer-events-none">
                    {itemSeleccionado && !disabled && (
                        <button
                            type="button"
                            title="Limpiar selección"
                            aria-label={`Limpiar selección: ${labelSeleccionado}`}
                            onClick={handleClear}
                            className="pointer-events-auto w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sape-burdeo"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}

                    <span className="w-6 h-6 flex items-center justify-center">
                        <svg
                            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                                isOpen ? 'rotate-180 text-sape-burdeo' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </div>
            </div>

            {/* Input oculto para formularios / validación */}
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
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Caja de búsqueda integrada */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative flex items-center">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                role="combobox"
                                aria-expanded={isOpen}
                                aria-controls={listboxId}
                                aria-activedescendant={activeOptionId}
                                aria-autocomplete="list"
                                aria-label={searchPlaceholder}
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                onKeyDown={manejarTeclado}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sape-burdeo focus:ring-1 focus:ring-sape-burdeo placeholder-slate-500 text-slate-900"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    aria-label="Limpiar texto de búsqueda"
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-1.5 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
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
                        ref={listRef}
                        id={listboxId}
                        className="max-h-60 overflow-y-auto divide-y divide-slate-100"
                        role="listbox"
                    >
                        {opcionesFiltradas.length > 0 ? (
                            opcionesFiltradas.map((item, idx) => {
                                const isSelected = String(item[valueKey]) === String(value);
                                const isHighlighted = idx === highlightedIndex;
                                const label = obtenerLabel(item);
                                const subLabel = obtenerSubLabel(item);

                                return (
                                    <li
                                        key={item[valueKey]}
                                        id={`${listboxId}-opt-${idx}`}
                                        data-option-index={idx}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onClick={() => handleSelect(item)}
                                        className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                                            isSelected
                                                ? 'bg-sape-burdeo/10 text-sape-burdeo font-bold'
                                                : isHighlighted
                                                  ? 'bg-slate-100 text-slate-900'
                                                  : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex flex-col text-left truncate mr-3">
                                            <span className="text-sm font-semibold text-slate-900 leading-tight">
                                                {label}
                                            </span>
                                            {subLabel && (
                                                <span className="text-xs text-slate-600 mt-0.5 truncate">
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
                            <li className="px-4 py-6 text-center text-sm text-slate-600">
                                <p className="font-bold text-slate-800">{emptyTitle}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    No hay resultados que coincidan con "{busqueda}"
                                </p>
                            </li>
                        )}
                    </ul>

                    {/* Pie del menú */}
                    <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 flex justify-between items-center tabular-nums">
                        <span>
                            {opcionesFiltradas.length}{' '}
                            {opcionesFiltradas.length === 1 ? itemSingular : itemPlural}
                        </span>
                        {itemSeleccionado && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-xs text-red-700 hover:text-red-800 font-bold hover:underline"
                            >
                                Limpiar selección
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && <p className="text-red-600 font-semibold text-xs mt-1">{error}</p>}
        </div>
    );
}
