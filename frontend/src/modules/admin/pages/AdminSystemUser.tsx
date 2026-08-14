import { useState, useEffect } from 'react';
import {
  getAllSystemUsers,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  SystemUser as SystemUserType,
  CreateSystemUserData,
  UpdateSystemUserData,
} from '../../../services/api/admin/adminSystemUserService';

export default function AdminSystemUser() {
  const [formData, setFormData] = useState({
    role: '' as '' | 'Admin' | 'Super Admin',
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Only Admin and Super Admin roles
  const roles: ('Admin' | 'Super Admin')[] = ['Admin', 'Super Admin'];

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when search changes
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch system users on component mount and when filters change
  useEffect(() => {
    fetchSystemUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, entriesPerPage, searchTerm, sortColumn, sortDirection]);

  const fetchSystemUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAllSystemUsers({
        page: currentPage,
        limit: entriesPerPage,
        search: searchTerm || undefined,
        sortBy: sortColumn || 'createdAt',
        sortOrder: sortDirection,
      });

      if (response.success && response.data) {
        setSystemUsers(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.pages);
          setTotalUsers(response.pagination.total);
        }
      } else {
        setError(response.message || 'Failed to fetch system users');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching system users');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      role: '',
      firstName: '',
      lastName: '',
      mobile: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setEditingId(null);
  };

  const handleAddSystemUser = async () => {
    setError('');
    setSuccessMessage('');

    // Validation
    if (!formData.role) {
      setError('Please select a role');
      return;
    }
    if (!formData.firstName.trim()) {
      setError('Please enter first name');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Please enter last name');
      return;
    }
    if (!formData.mobile.trim()) {
      setError('Please enter mobile number');
      return;
    }
    if (!/^[0-9]{10}$/.test(formData.mobile)) {
      setError('Mobile number must be exactly 10 digits');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (editingId === null && !formData.password.trim()) {
      setError('Please enter password');
      return;
    }
    if (formData.password.trim() && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match');
      return;
    }

    setLoading(true);
    try {
      if (editingId !== null) {
        // Update existing user
        const updateData: UpdateSystemUserData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          mobile: formData.mobile,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password.trim()) {
          updateData.password = formData.password;
        }

        const response = await updateSystemUser(editingId, updateData);
        if (response.success) {
          setSuccessMessage('System user updated successfully!');
          resetForm();
          fetchSystemUsers();
        } else {
          setError(response.message || 'Failed to update system user');
        }
      } else {
        // Create new user
        const createData: CreateSystemUserData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          mobile: formData.mobile,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        };

        const response = await createSystemUser(createData);
        if (response.success) {
          setSuccessMessage('System user added successfully!');
          resetForm();
          fetchSystemUsers();
        } else {
          setError(response.message || 'Failed to create system user');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving system user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    const user = systemUsers.find((u) => u.id === id);
    if (user) {
      setFormData({
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        email: user.email,
        password: '',
        confirmPassword: '',
      });
      setEditingId(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this system user?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await deleteSystemUser(id);
      if (response.success) {
        setSuccessMessage('System user deleted successfully!');
        fetchSystemUsers();
      } else {
        setError(response.message || 'Failed to delete system user');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting system user');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSort = (column: string) => {
    // Map frontend column names to backend field names
    const columnMap: Record<string, string> = {
      'id': '_id',
      'name': 'firstName',
      '_id': '_id',
      'firstName': 'firstName',
      'mobile': 'mobile',
      'email': 'email',
      'role': 'role',
    };
    const backendColumn = columnMap[column] || column;
    
    if (sortColumn === backendColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(backendColumn);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Use backend data directly (already filtered, sorted, and paginated)
  const displayedUsers = systemUsers;

  const SortIcon = ({ column }: { column: string }) => {
    // Map frontend column names to backend field names for comparison
    const columnMap: Record<string, string> = {
      'id': '_id',
      'name': 'firstName',
      '_id': '_id',
      'firstName': 'firstName',
      'mobile': 'mobile',
      'email': 'email',
      'role': 'role',
    };
    const backendColumn = columnMap[column] || column;
    
    if (sortColumn !== backendColumn) {
      return (
        <span className="inline-block ml-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 1.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    }
    return (
      <span className="inline-block ml-1">
        {sortDirection === 'asc' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 1.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Header */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">System User</h1>
          <div className="text-sm text-blue-500">
            <span className="text-blue-500 hover:underline cursor-pointer">Home</span>{' '}
            <span className="text-neutral-400">/</span> Dashboard
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel: Add System User */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">Add System User</h2>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center justify-between">
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-red-700 hover:text-red-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}
            
            {/* Success Message */}
            {successMessage && (
              <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center justify-between">
                <p className="text-sm">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="text-green-700 hover:text-green-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}

            <div className="p-6 flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Select role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    >
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Enter First Name"
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Enter Last Name"
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Mobile <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      placeholder="Enter 10-digit Mobile"
                      disabled={loading}
                      maxLength={10}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter Email"
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Password {editingId === null && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={editingId === null ? "Enter Password" : "Leave blank to keep current"}
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Confirm Password {editingId === null && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder={editingId === null ? "Enter Confirm Password" : "Leave blank to keep current"}
                      disabled={loading}
                      className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4">
                {editingId !== null ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSystemUser}
                      disabled={loading}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded text-sm font-medium transition-colors"
                    >
                      {loading ? 'Updating...' : 'Update System User'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={loading}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 py-2.5 rounded text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddSystemUser}
                    disabled={loading}
                    className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded text-sm font-medium transition-colors"
                  >
                    {loading ? 'Adding...' : 'Add System User'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: View System User */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">View System User</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              {/* Search and Entries Per Page */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-700">Show</span>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => {
                      setEntriesPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    disabled={loading}
                    className="px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-neutral-700">entries</span>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search..."
                  disabled={loading}
                  className="px-3 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <p className="mt-2 text-sm text-neutral-600">Loading...</p>
                  </div>
                </div>
              )}

              {/* Table */}
              {!loading && (
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 cursor-pointer hover:bg-neutral-100"
                          onClick={() => handleSort('_id')}
                        >
                          <div className="flex items-center">
                            Id
                            <SortIcon column="_id" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 cursor-pointer hover:bg-neutral-100"
                          onClick={() => handleSort('firstName')}
                        >
                          <div className="flex items-center">
                            Name
                            <SortIcon column="firstName" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 cursor-pointer hover:bg-neutral-100"
                          onClick={() => handleSort('mobile')}
                        >
                          <div className="flex items-center">
                            Mobile
                            <SortIcon column="mobile" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 cursor-pointer hover:bg-neutral-100"
                          onClick={() => handleSort('email')}
                        >
                          <div className="flex items-center">
                            Email
                            <SortIcon column="email" />
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 cursor-pointer hover:bg-neutral-100"
                          onClick={() => handleSort('role')}
                        >
                          <div className="flex items-center">
                            Role
                            <SortIcon column="role" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                            No system users found
                          </td>
                        </tr>
                      ) : (
                        displayedUsers.map((user) => (
                          <tr key={user.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                            <td className="px-4 py-3 text-sm text-neutral-700">{user.id}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">
                              {user.firstName} {user.lastName}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{user.mobile}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{user.email}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{user.role}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEdit(user.id)}
                                  disabled={loading}
                                  className="p-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                                  title="Edit"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"></path>
                                    <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"></path>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  disabled={loading}
                                  className="p-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                                  title="Delete"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6H5H21"></path>
                                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"></path>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-neutral-200">
                  <div className="text-sm text-neutral-600">
                    Showing {displayedUsers.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to {Math.min(currentPage * entriesPerPage, totalUsers)} of {totalUsers} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || loading}
                      className="px-3 py-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18L9 12L15 6"></path>
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        disabled={loading}
                        className={`px-3 py-1.5 border rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentPage === page
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || loading}
                      className="px-3 py-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18L15 12L9 6"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4 px-6">
        Copyright © 2025. Developed By{' '}
        <a href="#" className="text-teal-600 hover:text-teal-700">
          Olovely Total Suvidha
        </a>
      </div>
    </div>
  );
}

