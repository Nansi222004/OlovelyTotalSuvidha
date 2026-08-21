import { useState, useEffect } from 'react';
import * as taxService from '../../../services/api/taxService';

export default function SellerTaxes() {
    const [taxes, setTaxes] = useState<taxService.Tax[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        const fetchTaxes = async () => {
            setLoading(true);
            try {
                const response = await taxService.getTaxes();
                if (response.success) {
                    setTaxes(response.data);
                }
            } catch (err) {
                console.error('Error fetching taxes:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTaxes();
    }, []);

    const filteredTaxes = taxes.filter(tax =>
        String(tax?.name || "").toLowerCase().includes(String(searchTerm || "").toLowerCase())
    );

    const totalPages = Math.ceil(filteredTaxes.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedTaxes = filteredTaxes.slice(startIndex, endIndex);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className="text-neutral-300 text-[10px]">
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-neutral-800">Tax</h1>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex-1 flex flex-col">
                {/* Controls */}
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">Show</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const headers = ['ID', 'Name', 'Rate (%)', 'Status'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredTaxes.map(tax => [
                                        tax._id,
                                        `"${tax.name}"`,
                                        tax.percentage,
                                        tax.status
                                    ].join(','))
                                ].join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `taxes_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">Search:</span>
                            <input
                                type="text"
                                className="pl-14 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse border border-neutral-200">
                        <thead>
                            <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                                <th
                                    className="p-4 w-16 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center justify-between">
                                        ID <SortIcon column="id" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center justify-between">
                                        Tax Name <SortIcon column="name" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('percentage')}
                                >
                                    <div className="flex items-center justify-between">
                                        Tax Rate (%) <SortIcon column="percentage" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center justify-between">
                                        Status <SortIcon column="status" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-neutral-400 border border-neutral-200">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                                            <span>Loading tax data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayedTaxes.map((tax, index) => (
                                <tr key={tax._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                                    <td className="p-4 align-middle border border-neutral-200">{startIndex + index + 1}</td>
                                    <td className="p-4 align-middle border border-neutral-200 font-medium">{tax.name}</td>
                                    <td className="p-4 align-middle border border-neutral-200">{tax.percentage}%</td>
                                    <td className="p-4 align-middle border border-neutral-200">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tax.status === 'Active'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                            }`}>
                                            {tax.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && displayedTaxes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-neutral-400 border border-neutral-200">
                                        No taxes found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <div className="text-xs sm:text-sm text-neutral-700">
                        Showing {filteredTaxes.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, filteredTaxes.length)} of {filteredTaxes.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 border border-teal-600 rounded ${currentPage === 1
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-teal-600 hover:bg-teal-50'
                                }`}
                            aria-label="Previous page"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M15 18L9 12L15 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                        <button
                            className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm"
                        >
                            {currentPage}
                        </button>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-teal-600 hover:bg-teal-50'
                                }`}
                            aria-label="Next page"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M9 18L15 12L9 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

