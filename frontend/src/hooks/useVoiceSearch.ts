import { useState, useRef, useEffect, useCallback } from 'react';

// Web Speech API interface definitions for TypeScript compatibility
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export const getSpeechRecognitionClass = (): (new () => ISpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

export const isVoiceSearchSupported = (): boolean => {
  return Boolean(getSpeechRecognitionClass());
};

/**
 * Maps application language code to standard speech recognition BCP-47 locale.
 * Defaults to Indian English (en-IN) and Hindi (hi-IN) for the target audience.
 */
export const getSpeechRecognitionLocale = (langCode?: string): string => {
  if (!langCode) return 'en-IN';
  const code = langCode.toLowerCase().trim();
  if (code.startsWith('hi')) return 'hi-IN';
  if (code.startsWith('bn')) return 'bn-IN';
  if (code.startsWith('ta')) return 'ta-IN';
  if (code.startsWith('te')) return 'te-IN';
  if (code.startsWith('mr')) return 'mr-IN';
  if (code.startsWith('gu')) return 'gu-IN';
  if (code.startsWith('pa')) return 'pa-IN';
  if (code.startsWith('kn')) return 'kn-IN';
  if (code.startsWith('ml')) return 'ml-IN';
  if (code.startsWith('en')) return 'en-IN';
  return 'en-IN';
};

export interface UseVoiceSearchOptions {
  lang?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string, errorCode: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface UseVoiceSearchResult {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useVoiceSearch(options: UseVoiceSearchOptions = {}): UseVoiceSearchResult {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isSupported = isVoiceSearchSupported();

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  const startListening = useCallback(() => {
    setError(null);

    const SpeechRec = getSpeechRecognitionClass();
    if (!SpeechRec) {
      const msg = "Voice search isn't supported in this browser.";
      setError(msg);
      optionsRef.current.onError?.(msg, 'unsupported');
      return;
    }

    // Abort any existing active session to prevent duplicate recognition sessions
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = getSpeechRecognitionLocale(optionsRef.current.lang);

      recognition.onstart = () => {
        setIsListening(true);
        setIsProcessing(false);
        setError(null);
        optionsRef.current.onStart?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const recognizedText = (finalTranscript || interimTranscript).trim();
        if (recognizedText) {
          if (finalTranscript) {
            setIsProcessing(true);
          }
          optionsRef.current.onResult?.(recognizedText, Boolean(finalTranscript));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        setIsProcessing(false);
        recognitionRef.current = null;

        if (event.error === 'aborted') {
          return;
        }

        let friendlyMessage = 'Voice recognition error. Please try again.';
        if (event.error === 'not-allowed') {
          friendlyMessage = 'Microphone permission is required for voice search.';
        } else if (event.error === 'no-speech') {
          friendlyMessage = 'No speech was detected. Please try again.';
        } else if (event.error === 'audio-capture') {
          friendlyMessage = 'Microphone is unavailable. Please check your audio settings.';
        } else if (event.error === 'network') {
          friendlyMessage = 'Network error during voice recognition.';
        }

        setError(friendlyMessage);
        optionsRef.current.onError?.(friendlyMessage, event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsProcessing(false);
        recognitionRef.current = null;
        optionsRef.current.onEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setIsProcessing(false);
      recognitionRef.current = null;
      const msg = err?.message || 'Failed to start microphone.';
      setError(msg);
      optionsRef.current.onError?.(msg, 'start-failed');
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up recognition instance on component unmount to prevent leaks & stuck microphones
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    isProcessing,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}

export default useVoiceSearch;
