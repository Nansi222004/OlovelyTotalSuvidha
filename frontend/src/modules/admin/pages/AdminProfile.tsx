import { useState, useEffect } from 'react';
import { getProfile, updateProfile, type AdminProfile as AdminProfileType } from '../../../services/api/admin/adminProfileService';
import { useAuth } from '../../../context/AuthContext';

export default function AdminProfile() {
    const { isAuthenticated } = useAuth();
    const [profile, setProfile] = useState<AdminProfileType | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
    });

    // Fetch profile on mount
    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await getProfile();
                if (response.success && response.data) {
                    setProfile(response.data);
                    setFormData({
                        firstName: response.data.firstName,
                        lastName: response.data.lastName,
                        email: response.data.email,
                        mobile: response.data.mobile,
                    });
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError('Failed to load profile. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [isAuthenticated]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            // Validation
            if (!formData.firstName.trim() || !formData.lastName.trim()) {
                setError('First name and last name are required.');
                return;
            }

            if (!formData.email.trim()) {
                setError('Email is required.');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                setError('Please enter a valid email address.');
                return;
            }

            if (!formData.mobile.trim()) {
                setError('Mobile number is required.');
                return;
            }

            if (!/^[0-9]{10}$/.test(formData.mobile)) {
                setError('Mobile number must be 10 digits.');
                return;
            }

            const response = await updateProfile(formData);
            if (response.success && response.data) {
                setProfile(response.data);
                setSuccess('Profile updated successfully!');
                setIsEditing(false);

                // Update localStorage userData
                const userData = localStorage.getItem('userData');
                if (userData) {
                    const parsedData = JSON.parse(userData);
                    parsedData.firstName = response.data.firstName;
                    parsedData.lastName = response.data.lastName;
                    parsedData.email = response.data.email;
                    parsedData.mobile = response.data.mobile;
                    localStorage.setItem('userData', JSON.stringify(parsedData));
                }

                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err: any) {
            console.error('Error updating profile:', err);
            if (err?.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('Failed to update profile. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (profile) {
            setFormData({
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                mobile: profile.mobile,
            });
        }
        setIsEditing(false);
        setError(null);
        setSuccess(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-neutral-600">Loading profile...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-red-600">Failed to load profile</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
                            Admin Profile
                        </h1>
                    </div>
                    <div className="text-sm text-neutral-600">
                        <span className="text-blue-600">Home</span> /{' '}
                        <span className="text-neutral-900">Profile</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50">
                <div className="max-w-3xl mx-auto">
                    {/* Success Message */}
                    {success && (
                        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                            {success}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {/* Profile Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                        {/* Card Header */}
                        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Profile Information
                            </h2>
                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                                >
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* Card Body */}
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* First Name */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        First Name
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="text-neutral-900 py-2">{profile.firstName}</p>
                                    )}
                                </div>

                                {/* Last Name */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Last Name
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="text-neutral-900 py-2">{profile.lastName}</p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Email
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="text-neutral-900 py-2">{profile.email}</p>
                                    )}
                                </div>

                                {/* Mobile */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Mobile
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            name="mobile"
                                            value={formData.mobile}
                                            onChange={handleInputChange}
                                            maxLength={10}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="text-neutral-900 py-2">{profile.mobile}</p>
                                    )}
                                </div>

                                {/* Role (Read-only) */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Role
                                    </label>
                                    <p className="text-neutral-900 py-2">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                            {profile.role}
                                        </span>
                                    </p>
                                </div>

                                {/* Created At */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Created At
                                    </label>
                                    <p className="text-neutral-900 py-2">
                                        {new Date(profile.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons (Edit Mode) */}
                            {isEditing && (
                                <div className="mt-6 flex items-center gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={saving}
                                        className="px-6 py-2 bg-neutral-400 hover:bg-neutral-500 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
