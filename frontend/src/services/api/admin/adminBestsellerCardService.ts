import api from "../config";

export interface BestsellerCard {
    _id: string;
    name: string;
    category: {
        _id: string;
        name: string;
        slug: string;
        image?: string;
    };
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BestsellerCardFormData {
    name: string;
    category: string;
    order?: number;
    isActive: boolean;
}

export interface BestsellerCardResponse {
    success: boolean;
    message?: string;
    data?: BestsellerCard | BestsellerCard[];
}

// Get all bestseller cards
export const getBestsellerCards = async (): Promise<BestsellerCardResponse> => {
    const response = await api.get<BestsellerCardResponse>("/admin/bestseller-cards");
    return response.data;
};

// Get single bestseller card by ID
export const getBestsellerCardById = async (
    id: string
): Promise<BestsellerCardResponse> => {
    const response = await api.get<BestsellerCardResponse>(
        `/admin/bestseller-cards/${id}`
    );
    return response.data;
};

// Create new bestseller card
export const createBestsellerCard = async (
    data: BestsellerCardFormData
): Promise<BestsellerCardResponse> => {
    const response = await api.post<BestsellerCardResponse>(
        "/admin/bestseller-cards",
        data
    );
    return response.data;
};

// Update bestseller card
export const updateBestsellerCard = async (
    id: string,
    data: Partial<BestsellerCardFormData>
): Promise<BestsellerCardResponse> => {
    const response = await api.put<BestsellerCardResponse>(
        `/admin/bestseller-cards/${id}`,
        data
    );
    return response.data;
};

// Delete bestseller card
export const deleteBestsellerCard = async (
    id: string
): Promise<BestsellerCardResponse> => {
    const response = await api.delete<BestsellerCardResponse>(
        `/admin/bestseller-cards/${id}`
    );
    return response.data;
};

// Reorder bestseller cards
export const reorderBestsellerCards = async (
    cards: { id: string; order: number }[]
): Promise<BestsellerCardResponse> => {
    const response = await api.put<BestsellerCardResponse>(
        "/admin/bestseller-cards/reorder",
        { cards }
    );
    return response.data;
};

