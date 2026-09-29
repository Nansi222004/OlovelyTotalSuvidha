import React from 'react';

export interface VoiceSearchMicButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const VoiceSearchMicButton: React.FC<VoiceSearchMicButtonProps> = ({
  isListening,
  isProcessing = false,
  onClick,
  size = 'md',
  className = '',
  disabled = false,
  ariaLabel,
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 p-1 text-xs',
    md: 'w-8 h-8 p-1.5 text-sm',
    lg: 'w-9 h-9 p-2 text-base',
  };

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  const computedAriaLabel =
    ariaLabel ||
    (isListening
      ? 'Listening... Click to stop voice search'
      : isProcessing
        ? 'Processing voice search...'
        : 'Search by voice');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={computedAriaLabel}
      aria-pressed={isListening}
      title={computedAriaLabel}
      className={`relative flex items-center justify-center rounded-full transition-all duration-200 outline-none select-none cursor-pointer ${sizeClasses[size]} ${
        isListening
          ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-2 ring-red-400 shadow-sm'
          : isProcessing
            ? 'text-green-600 bg-green-50 hover:bg-green-100'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 active:scale-95'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Subtle pulse ring animation while actively recording */}
      {isListening && (
        <span
          className="absolute inset-0 rounded-full bg-red-400/40 animate-ping opacity-75 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {isProcessing ? (
        // Small loading / processing spinner
        <svg
          className="animate-spin text-green-600"
          width={iconSizes[size]}
          height={iconSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : isListening ? (
        // Active recording microphone with wave indicator
        <span className="relative flex items-center justify-center">
          <svg
            width={iconSizes[size]}
            height={iconSizes[size]}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="currentColor" fillOpacity="0.15" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span className="sr-only">Listening...</span>
        </span>
      ) : (
        // Standard Idle Microphone Icon
        <svg
          width={iconSizes[size]}
          height={iconSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
};

export default VoiceSearchMicButton;
