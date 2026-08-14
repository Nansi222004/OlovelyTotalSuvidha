import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PartyPopperProps {
  show: boolean;
  onComplete?: () => void;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  delay: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  shape: 'circle' | 'rectangle' | 'streamer';
  rotation: number;
  side: 'left' | 'right';
}

export default function PartyPopper({ show, onComplete }: PartyPopperProps) {
  const [leftParticles, setLeftParticles] = useState<ConfettiParticle[]>([]);
  const [rightParticles, setRightParticles] = useState<ConfettiParticle[]>([]);
  const [showPoppers, setShowPoppers] = useState(false);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

  useEffect(() => {
    if (show) {
      // Show poppers first
      setShowPoppers(true);

      // Generate particles for left popper - burst upward and rightward
      const leftParticlesData: ConfettiParticle[] = Array.from({ length: 60 }, (_, i) => {
        const baseAngle = 50; // 50 degrees (diagonal up-right)
        const angleVariation = (Math.random() - 0.5) * 60; // ±30 degrees variation
        const angle = baseAngle + angleVariation;
        const distance = Math.random() * 400 + 250;
        const shapeRand = Math.random();
        const shape = shapeRand > 0.65 ? 'circle' : shapeRand > 0.35 ? 'rectangle' : 'streamer';
        
        return {
          id: i,
          x: 0,
          y: 0,
          delay: Math.random() * 0.2 + 0.15, // Start after popper appears
          angle,
          distance,
          size: shape === 'streamer' ? Math.random() * 4 + 2 : Math.random() * 7 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape,
          rotation: Math.random() * 1080,
          side: 'left',
        };
      });

      // Generate particles for right popper - burst upward and leftward
      const rightParticlesData: ConfettiParticle[] = Array.from({ length: 60 }, (_, i) => {
        const baseAngle = 130; // 130 degrees (diagonal up-left)
        const angleVariation = (Math.random() - 0.5) * 60; // ±30 degrees variation
        const angle = baseAngle + angleVariation;
        const distance = Math.random() * 400 + 250;
        const shapeRand = Math.random();
        const shape = shapeRand > 0.65 ? 'circle' : shapeRand > 0.35 ? 'rectangle' : 'streamer';
        
        return {
          id: i + 60,
          x: 0,
          y: 0,
          delay: Math.random() * 0.2 + 0.15, // Start after popper appears
          angle,
          distance,
          size: shape === 'streamer' ? Math.random() * 4 + 2 : Math.random() * 7 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape,
          rotation: Math.random() * 1080,
          side: 'right',
        };
      });

      setLeftParticles(leftParticlesData);
      setRightParticles(rightParticlesData);

      // Call onComplete after animation
      const timer = setTimeout(() => {
        setShowPoppers(false);
        setLeftParticles([]);
        setRightParticles([]);
        if (onComplete) onComplete();
      }, 2800);

      return () => clearTimeout(timer);
    } else {
      setShowPoppers(false);
      setLeftParticles([]);
      setRightParticles([]);
    }
  }, [show, onComplete]);

  const renderParticle = (particle: ConfettiParticle, startX: number, startY: number) => {
    const radians = particle.angle * Math.PI / 180;
    const endX = startX + Math.cos(radians) * particle.distance;
    const endY = startY + Math.sin(radians) * particle.distance;

    const particleStyle: React.CSSProperties = {
      backgroundColor: particle.color,
      width: particle.shape === 'streamer' ? `${particle.size * 5}px` : `${particle.size}px`,
      height: particle.shape === 'streamer' ? `${particle.size}px` : `${particle.size}px`,
      borderRadius: particle.shape === 'circle' ? '50%' : particle.shape === 'streamer' ? '2px' : '4px',
      boxShadow: `0 2px 4px ${particle.color}60`,
    };

    return (
      <motion.div
        key={particle.id}
        initial={{ 
          x: startX, 
          y: startY, 
          opacity: 0,
          scale: 0,
          rotate: 0
        }}
        animate={{
          x: endX,
          y: endY,
          opacity: [0, 1, 1, 0],
          scale: [0, 1.2, 1, 0.2],
          rotate: particle.rotation,
        }}
        transition={{
          duration: 2,
          delay: particle.delay,
          ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for natural arc
          times: [0, 0.1, 0.7, 1],
        }}
        className="absolute"
        style={particleStyle}
      />
    );
  };

  const PopperIcon = ({ className }: { className?: string }) => (
    <svg
      viewBox="0 0 100 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Popper body */}
      <path
        d="M50 20 L30 100 L70 100 Z"
        fill="url(#popperGradient)"
        stroke="#8b5cf6"
        strokeWidth="2"
      />
      {/* Popper handle */}
      <rect x="45" y="100" width="10" height="20" rx="2" fill="#6b21a8" />
      {/* Decorative lines */}
      <line x1="40" y1="60" x2="60" y2="60" stroke="#a855f7" strokeWidth="1.5" />
      <line x1="35" y1="80" x2="65" y2="80" stroke="#a855f7" strokeWidth="1.5" />
      <defs>
        <linearGradient id="popperGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100]">
          {/* Success Toast at Top - Centered */}
          <div className="fixed top-0 left-0 right-0 flex justify-center z-30 pt-[48px]">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ 
                opacity: showPoppers ? 1 : 0, 
                y: showPoppers ? 0 : -20,
                scale: showPoppers ? 1 : 0.95
              }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ 
                duration: 0.3,
                delay: 0.2,
                ease: [0.34, 1.56, 0.64, 1]
              }}
            >
              <div className="bg-white rounded-lg px-3 py-2 shadow-lg border border-green-200 flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.25, delay: 0.35, repeat: 1 }}
                  className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-green-700">Coupon Applied</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Left Popper */}
          <motion.div
            initial={{ x: '-120px', y: '50%', opacity: 0, scale: 0.3 }}
            animate={{ 
              x: showPoppers ? '18%' : '-120px', 
              y: '50%', 
              opacity: showPoppers ? 1 : 0,
              scale: showPoppers ? [0.3, 1.1, 1] : 0.3,
              rotate: showPoppers ? [0, 8, -8, 0] : 0
            }}
            exit={{ x: '-120px', opacity: 0, scale: 0.3 }}
            transition={{ 
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
            style={{ transform: 'translateY(-50%)' }}
          >
            <div className="w-16 h-20 drop-shadow-2xl">
              <PopperIcon />
            </div>
          </motion.div>

          {/* Right Popper */}
          <motion.div
            initial={{ x: '120px', y: '50%', opacity: 0, scale: 0.3 }}
            animate={{ 
              x: showPoppers ? '-18%' : '120px', 
              y: '50%', 
              opacity: showPoppers ? 1 : 0,
              scale: showPoppers ? [0.3, 1.1, 1] : 0.3,
              rotate: showPoppers ? [0, -8, 8, 0] : 0
            }}
            exit={{ x: '120px', opacity: 0, scale: 0.3 }}
            transition={{ 
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
            style={{ transform: 'translateY(-50%) scaleX(-1)' }}
          >
            <div className="w-16 h-20 drop-shadow-2xl">
              <PopperIcon />
            </div>
          </motion.div>

          {/* Left Confetti Burst */}
          {leftParticles.map((particle) => {
            const startX = window.innerWidth * 0.18;
            const startY = window.innerHeight * 0.5;
            return renderParticle(particle, startX, startY);
          })}

          {/* Right Confetti Burst */}
          {rightParticles.map((particle) => {
            const startX = window.innerWidth * 0.82;
            const startY = window.innerHeight * 0.5;
            return renderParticle(particle, startX, startY);
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

