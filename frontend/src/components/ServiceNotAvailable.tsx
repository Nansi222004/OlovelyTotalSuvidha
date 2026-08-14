import React from 'react';
import Lottie from 'lottie-react';
import comingSoonAnimation from '../../assets/animation/coming_soon.json';

interface ServiceNotAvailableProps {
    onChangeLocation: () => void;
}

const ServiceNotAvailable: React.FC<ServiceNotAvailableProps> = ({ onChangeLocation }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center bg-white">
            <div className="w-full max-w-md mb-2">
                <Lottie animationData={comingSoonAnimation} loop={true} className="w-full h-auto" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-3">Service Not Available</h2>
            <p className="text-neutral-600 mb-8 max-w-md text-sm md:text-base">
                We're sorry, but we don't deliver to this location yet.
                We are expanding our services rapidly and hope to serve you soon!
            </p>
            <button
                onClick={onChangeLocation}
                className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Change Location
            </button>
        </div>
    );
};

export default ServiceNotAvailable;
