import api from "../config";

export interface HomeSection {
    _id: string;
    title: string;
    slug: string;
    categories?: Array<{
        _id: string;
        name: string;
        slug: string;
        image?: string;
    }>;
    subCategories?: Array<{
        _id: string;
        name: string;
    }>;
    displayType: "subcategories" | "products" | "categories";
    columns: number;
    limit: number;
    pageLocation?: "Home Page" | "Header Category Page";
    targetHeaderCategory?: {
        _id: string;
        name: string;
    } | string;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface HomeSectionFormData {
    title: string;
    slug: string;
    categories?: string[];
    subCategories?: string[];
    displayType: "subcategories" | "products" | "categories";
    columns: number;
    limit: number;
    pageLocation?: "Home Page" | "Header Category Page";
    targetHeaderCategory?: string;
    order?: number;
    isActive: boolean;
}

export interface HomeSectionResponse {
    success: boolean;
    message?: string;
    data?: HomeSection | HomeSection[];
}

// Get all home sections
export const getHomeSections = async (): Promise<HomeSectionResponse> => {
    const response = await api.get<HomeSectionResponse>("/admin/home-sections");
    return response.data;
};

// Get single home section by ID
export const getHomeSectionById = async (
    id: string
): Promise<HomeSectionResponse> => {
    const response = await api.get<HomeSectionResponse>(
        `/admin/home-sections/${id}`
    );
    return response.data;
};

// Create new home section
export const createHomeSection = async (
    data: HomeSectionFormData
): Promise<HomeSectionResponse> => {
    const response = await api.post<HomeSectionResponse>(
        "/admin/home-sections",
        data
    );
    return response.data;
};

// Update home section
export const updateHomeSection = async (
    id: string,
    data: Partial<HomeSectionFormData>
): Promise<HomeSectionResponse> => {
    const response = await api.put<HomeSectionResponse>(
        `/admin/home-sections/${id}`,
        data
    );
    return response.data;
};

// Delete home section
export const deleteHomeSection = async (
    id: string
): Promise<HomeSectionResponse> => {
    const response = await api.delete<HomeSectionResponse>(
        `/admin/home-sections/${id}`
    );
    return response.data;
};

// Reorder home sections
export const reorderHomeSections = async (
    sections: { id: string; order: number }[]
): Promise<HomeSectionResponse> => {
    const response = await api.put<HomeSectionResponse>(
        "/admin/home-sections/reorder",
        { sections }
    );
    return response.data;
};
