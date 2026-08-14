export interface AppConfig {
    deliveryFee: number;
    freeDeliveryThreshold: number;
    platformFee: number;
    taxes: {
        gst: number;
    };
    estimatedDeliveryTime: string;
}

// Default configuration (fallback)
const defaultConfig: AppConfig = {
    deliveryFee: 40,
    freeDeliveryThreshold: 199,
    platformFee: 2,
    taxes: {
        gst: 18
    },
    estimatedDeliveryTime: '12-15 mins'
};

/**
 * Get application configuration
 * In the future, this should fetch from an API endpoint like /customer/config
 */
export const getAppConfig = async (): Promise<AppConfig> => {
    // Simulate API delay
    // return new Promise((resolve) => {
    //   setTimeout(() => resolve(defaultConfig), 100);
    // });

    // For now, return sync/static config or fetch if endpoint existed
    return defaultConfig;
};

// Synchronous helper for immediate UI needs (until async context is fully adopted)
export const appConfig = defaultConfig;
