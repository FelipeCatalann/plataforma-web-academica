import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    return (
        <input
            {...props}
            type={type}
            className={
                'rounded-xl border-slate-300 bg-slate-50/60 px-3.5 py-2.5 text-slate-800 shadow-sm transition-all duration-200 focus:bg-white focus:border-sape-burdeo focus:ring-2 focus:ring-sape-burdeo/20 ' +
                className
            }
            ref={localRef}
        />
    );
});
