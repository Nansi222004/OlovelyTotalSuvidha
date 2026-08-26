import { useState, useEffect } from 'react';
import { getAllSellers, Seller as SellerType } from '../../../services/api/sellerService';
import SellerServiceMap from '../components/SellerServiceMap';

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  serviceRadiusKm?: number;
  status: 'Approved' | 'Pending' | 'Rejected';
}

export default function AdminSellerLocation() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected'>('All');

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await getAllSellers();
        // Handle ApiResponse format: { success: boolean, data: Seller[] }
        if (response.success && response.data) {
          const mappedSellers: Seller[] = response.data.map((seller: SellerType) => ({
            _id: seller._id,
            sellerName: seller.sellerName || 'Unknown',
            storeName: seller.storeName || 'Unknown Store',
            email: seller.email || '',
            phone: seller.mobile || '',
            address: seller.address,
            city: seller.city,
            searchLocation: seller.searchLocation,
            latitude: seller.latitude,
            longitude: seller.longitude,
            serviceRadiusKm: seller.serviceRadiusKm,
            status: seller.status || 'Pending',
          }));

          // Filter sellers with valid location data
          const sellersWithLocation = mappedSellers.filter(
            (seller) => seller.latitude && seller.longitude
          );

          setSellers(sellersWithLocation);
        } else {
          // No data available
          setSellers([]);
        }
      } catch (error) {
        console.error('Error fetching sellers:', error);
        // Show empty on error
        setSellers([]);
      }
    };

    fetchSellers();
  }, []);

  // Filter sellers based on search and status
  const filteredSellers = sellers.filter((seller) => {
    const q = String(searchQuery || "").toLowerCase();
    const matchesSearch =
      String(seller.sellerName || "").toLowerCase().includes(q) ||
      String(seller.storeName || "").toLowerCase().includes(q) ||
      String(seller.city || "").toLowerCase().includes(q) ||
      String(seller.address || "").toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'All' || seller.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSellerClick = (seller: Seller) => {
    setSelectedSeller(seller);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl font-semibold text-neutral-800">Seller Locations</h1>
        <div className="text-sm text-neutral-600">
          <span className="text-teal-600 hover:text-teal-700 cursor-pointer">Home</span>
          <span className="mx-2">/</span>
          <span className="text-neutral-800">Seller Locations</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Search Sellers
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, store, city, or address..."
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="All">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content - Map and List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Map Section - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 px-4 sm:px-6 py-3">
            <h2 className="text-white text-lg font-semibold">Seller Locations Map</h2>
          </div>
          <div className="h-96 sm:h-[600px] w-full">
            {selectedSeller && selectedSeller.latitude && selectedSeller.longitude ? (
              <SellerServiceMap
                latitude={parseFloat(selectedSeller.latitude)}
                longitude={parseFloat(selectedSeller.longitude)}
                radiusKm={selectedSeller.serviceRadiusKm || 10}
                storeName={selectedSeller.storeName}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-neutral-50 text-neutral-500">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-neutral-300">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <p className="text-lg font-medium">Select a seller to view service area</p>
                <p className="text-sm mt-1">Only sellers with coordinates are listed</p>
              </div>
            )}
          </div>
          {selectedSeller && (
            <div className="p-4 sm:p-6 border-t border-neutral-200 bg-teal-50">
              <h3 className="font-semibold text-neutral-900 mb-2">Selected Seller</h3>
              <p className="text-sm text-neutral-700">
                <span className="font-medium">{selectedSeller.storeName}</span> - {selectedSeller.sellerName}
              </p>
              <p className="text-sm text-neutral-600 mt-1">
                {selectedSeller.address}, {selectedSeller.city}
              </p>
              {selectedSeller.latitude && selectedSeller.longitude && (
                <p className="text-xs text-neutral-500 mt-1">
                  Coordinates: {selectedSeller.latitude}, {selectedSeller.longitude}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sellers List - Takes 1 column */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 px-4 sm:px-6 py-3">
            <h2 className="text-white text-lg font-semibold">
              Sellers ({filteredSellers.length})
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredSellers.length === 0 ? (
              <div className="p-6 text-center text-neutral-500">
                <p>No sellers found with location data.</p>
                <p className="text-sm mt-2">Make sure sellers have latitude and longitude set.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {filteredSellers.map((seller) => (
                  <div
                    key={seller._id}
                    onClick={() => handleSellerClick(seller)}
                    className={`p-4 cursor-pointer transition-colors ${selectedSeller?._id === seller._id
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'hover:bg-neutral-50'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900 text-sm">
                          {seller.storeName}
                        </h3>
                        <p className="text-xs text-neutral-600 mt-1">{seller.sellerName}</p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                          seller.status
                        )}`}
                      >
                        {seller.status}
                      </span>
                    </div>
                    {seller.address && (
                      <p className="text-xs text-neutral-500 mt-2 line-clamp-2">
                        ðŸ“ {seller.address}
                        {seller.city && `, ${seller.city}`}
                      </p>
                    )}
                    {seller.latitude && seller.longitude && (
                      <p className="text-xs text-neutral-400 mt-1">
                        {seller.latitude}, {seller.longitude}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <span>📞 {seller.phone}</span>
                      {seller.email && <span>✉️ {seller.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{' '}
        <a href="#" className="text-teal-600 hover:text-teal-700">
          Olovely Total Suvidha
        </a>
      </div>
    </div>
  );
}

