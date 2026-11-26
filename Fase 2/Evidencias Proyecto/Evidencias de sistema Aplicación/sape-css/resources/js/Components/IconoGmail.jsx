import React from 'react';

export default function IconoGmail({ className = 'w-4 h-4 shrink-0', monocromo = false }) {
    if (monocromo) {
        return (
            <svg
                className={className}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 6l-10 7L2 6" />
            </svg>
        );
    }

    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M2 6.75V18a2 2 0 002 2h2.25V11.4L2 8.2V6.75z"
            />
            <path
                fill="#34A853"
                d="M22 6.75V18a2 2 0 01-2 2h-2.25V11.4L22 8.2V6.75z"
            />
            <path
                fill="#FBBC05"
                d="M17.75 11.4V6.05L20.1 4.3A1.75 1.75 0 0122 5.7v2.5l-4.25 3.2z"
            />
            <path
                fill="#EA4335"
                d="M6.25 11.4V6.05L12 10.35l5.75-4.3v5.35L12 15.7l-5.75-4.3z"
            />
            <path
                fill="#C5221F"
                d="M2 5.7a1.75 1.75 0 011.9-1.4l2.35 1.75v5.35L2 8.2V5.7z"
            />
        </svg>
    );
}
