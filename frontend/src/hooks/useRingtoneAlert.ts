import { useEffect, useRef, useState, useCallback } from 'react';

export function useRingtoneAlert(soundUrl: string, shouldPlay: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isUnlockedRef = useRef(false);

  // Initialize singleton audio element & pre-unlock on first interaction
  useEffect(() => {
    const audio = new Audio(soundUrl);
    audio.loop = true;
    audio.volume = 1.0;
    audioRef.current = audio;

    const unlockAudio = () => {
      if (isUnlockedRef.current || !audioRef.current) return;
      // Play brief muted audio to unlock browser autoplay restriction
      audioRef.current.volume = 0.001;
      audioRef.current
        .play()
        .then(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 1.0;
          }
          isUnlockedRef.current = true;
          setAutoplayBlocked(false);
          console.log('✅ Ringtone audio context successfully unlocked by user interaction');
        })
        .catch(() => {
          // Ignore pre-unlock errors
        });

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [soundUrl]);

  const enableAndPlaySound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.volume = 1.0;
      await audio.play();
      isUnlockedRef.current = true;
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
      audio.volume = 1.0;
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
