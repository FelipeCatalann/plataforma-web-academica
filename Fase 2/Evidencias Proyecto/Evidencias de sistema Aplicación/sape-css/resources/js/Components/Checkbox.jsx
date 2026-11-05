export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-slate-300 text-sape-burdeo shadow-sm focus:ring-sape-burdeo ' +
                className
            }
        />
    );
}
