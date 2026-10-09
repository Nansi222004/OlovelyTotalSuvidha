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

type MicrophonePermissionState = PermissionState | 'unknown';

const readMicrophonePermission = async (): Promise<MicrophonePermissionState> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    // `microphone` is implemented by some browsers but is not included in every
    // TypeScript DOM lib version (and Safari may reject the query altogether).
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch (_) {
    return 'unknown';
  }
};

export function useVoiceSearch(options: UseVoiceSearchOptions = {}): UseVoiceSearchResult {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isStartingRef = useRef(false);
  const microphonePermissionRef = useRef<MicrophonePermissionState>('unknown');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isSupported = isVoiceSearchSupported();

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    isStartingRef.current = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {
        try {
          recognition.abort();
        } catch (_) {}
      }
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
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

    // A second rapid tap must not create a competing recognizer while the first
    // one is still starting. The active session can be stopped with the mic toggle.
    if (isStartingRef.current || recognitionRef.current) {
      return;
    }

    isStartingRef.current = true;
    microphonePermissionRef.current = 'unknown';
    void readMicrophonePermission().then((state) => {
      // `onstart` is stronger evidence than a Permissions API query (which may
      // resolve late or be unsupported), so do not overwrite a granted session.
      if (microphonePermissionRef.current !== 'granted') {
        microphonePermissionRef.current = state;
      }
    });

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = getSpeechRecognitionLocale(optionsRef.current.lang);

      recognition.onstart = () => {
        if (recognitionRef.current !== recognition) return;
        isStartingRef.current = false;
        microphonePermissionRef.current = 'granted';
        setIsListening(true);
        setIsProcessing(false);
        setError(null);
        optionsRef.current.onStart?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (recognitionRef.current !== recognition) return;
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
          setError(null);
          if (finalTranscript) {
            setIsProcessing(true);
          }
          optionsRef.current.onResult?.(recognizedText, Boolean(finalTranscript));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (recognitionRef.current !== recognition) return;
        isStartingRef.current = false;
        setIsListening(false);
        setIsProcessing(false);
        recognitionRef.current = null;

        if (event.error === 'aborted') {
          return;
        }

        let friendlyMessage = 'Voice recognition failed. Please try again or continue with text search.';
        let errorCode = event.error || 'recognition-failure';
        if (event.error === 'not-allowed') {
          if (microphonePermissionRef.current === 'denied') {
            friendlyMessage = 'Microphone access is denied. Allow it in your browser settings to use voice search.';
            errorCode = 'permission-denied';
          } else if (microphonePermissionRef.current === 'granted') {
            friendlyMessage = 'Voice recognition is unavailable even though microphone access is allowed. Please use text search.';
            errorCode = 'recognition-unavailable';
          } else {
            friendlyMessage = 'Microphone access was blocked or voice recognition is unavailable. Check browser settings or use text search.';
            errorCode = 'permission-unavailable';
          }
        } else if (event.error === 'service-not-allowed') {
          friendlyMessage = 'The browser voice-recognition service is unavailable. Please use text search.';
          errorCode = 'recognition-unavailable';
        } else if (event.error === 'no-speech') {
          friendlyMessage = 'No speech was detected. Please try again.';
        } else if (event.error === 'audio-capture') {
          friendlyMessage = 'Microphone is unavailable. Please check your audio settings.';
        } else if (event.error === 'network') {
          friendlyMessage = 'Network error during voice recognition.';
        } else if (event.error === 'language-not-supported') {
          friendlyMessage = 'Voice recognition does not support the selected language. Please use text search.';
          errorCode = 'recognition-unavailable';
        }

        setError(friendlyMessage);
        optionsRef.current.onError?.(friendlyMessage, errorCode);
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        isStartingRef.current = false;
        setIsListening(false);
        setIsProcessing(false);
        recognitionRef.current = null;
        optionsRef.current.onEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      isStartingRef.current = false;
      setIsListening(false);
      setIsProcessing(false);
      recognitionRef.current = null;
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access was blocked or voice recognition is unavailable. Check browser settings or use text search.'
        : 'Voice recognition could not start. Please try again or continue with text search.';
      setError(msg);
      optionsRef.current.onError?.(msg, err?.name === 'NotAllowedError' ? 'permission-unavailable' : 'start-failed');
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
      isStartingRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.abort();
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
