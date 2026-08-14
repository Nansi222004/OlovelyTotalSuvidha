import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoading } from '../../context/LoadingContext';
import './iconLoader.css';

interface IconLoaderProps {
  forceShow?: boolean;
}

const IconLoader: React.FC<IconLoaderProps> = ({ forceShow = false }) => {
  const { isRouteLoading } = useLoading();
  const show = isRouteLoading || forceShow;
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    if (show && !animationData) {
      fetch('/animations/loading.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.error('Failed to load animation:', err));
    }
  }, [show, animationData]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="global-loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="loader-container">
            <div className="lottie-wrapper">
              {animationData ? (
                <Lottie
                  animationData={animationData}
                  loop={true}
                  className="loader-lottie"
                />
              ) : (
                <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IconLoader;
