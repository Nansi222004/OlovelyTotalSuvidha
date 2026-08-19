import { useEffect, useRef, useState, useCallback } from 'react';

export function useRingtoneAlert(soundUrl: string, shouldPlay: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize singleton audio element
  useEffect(() => {
    const audio = new Audio(soundUrl);
    audio.loop = true;
    audio.volume = 0.8;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [soundUrl]);

  const enableAndPlaySound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch (err: any) {
      console.warn('Audio enable play failed:', err);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (shouldPlay) {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((err: any) => {
          console.warn('Audio autoplay blocked by browser:', err?.message || err);
          if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
            setAutoplayBlocked(true);
          }
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setAutoplayBlocked(false);
    }
  }, [shouldPlay]);

  return { isPlaying, autoplayBlocked, enableAndPlaySound };
}
