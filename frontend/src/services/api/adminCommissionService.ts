import api from "./config";

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

export const getCommissionReport = async (): Promise<ApiResponse<any>> => {
    const response = await api.get<ApiResponse<any>>("/admin/wallet/commissions");
    return response.data;
};
