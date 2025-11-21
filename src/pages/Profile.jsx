import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { fetchWithAuth } from '../utils/api';
import { toast } from 'react-hot-toast';
import {
  UserCircleIcon,
  EnvelopeIcon,
  CalendarIcon,
  Cog6ToothIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState({
    name: '',
    picture: ''
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [profileRes, statsRes] = await Promise.all([
        fetchWithAuth('/api/profile'),
        fetchWithAuth('/api/profile/stats')
      ]);
      
      const profileData = await profileRes.json();
      const statsData = await statsRes.json();
      
      if (profileData.success) {
        setProfile(profileData.profile);
        setEditForm({
          name: profileData.profile.name || user?.name || '',
          picture: profileData.profile.picture || user?.picture || ''
        });
      }
      
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetchWithAuth('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Profile updated successfully');
        setProfile(data.profile);
        // Update auth context user
        if (setUser) {
          setUser(prev => ({
            ...prev,
            name: data.profile.name,
            picture: data.profile.picture
          }));
        }
        setShowEditModal(false);
        loadProfileData();
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetchWithAuth('/api/profile', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Account deleted successfully');
        // Clear auth and redirect
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      } else {
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error deleting account');
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || '';
  const displayEmail = profile?.email || user?.email || '';
  const displayPicture = profile?.picture || user?.picture || '';
  const memberSince = profile?.first_login_date 
    ? new Date(profile.first_login_date).toLocaleDateString()
    : 'N/A';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <UserCircleIcon className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400" />
          Profile
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <div className="text-center">
            {displayPicture ? (
              <img
                src={displayPicture}
                alt={displayName}
                className="h-24 w-24 rounded-full mx-auto mb-4 shadow-lg"
              />
            ) : (
              <div className="h-24 w-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-3xl font-semibold">
                  {displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {displayName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {displayEmail}
            </p>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowEditModal(true)}
              >
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Account Information
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <UserCircleIcon className="h-6 w-6 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Full Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <EnvelopeIcon className="h-6 w-6 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{displayEmail}</p>
              </div>
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                Verified
              </span>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {memberSince}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Theme</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current: {theme === 'dark' ? 'Dark' : 'Light'} mode
                </p>
              </div>
              <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Activity
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Saved Strategies</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats?.saved_queries ?? '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Watchlist Items</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats?.watchlist_items ?? '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Journal Entries</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats?.journal_entries ?? '--'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
          Danger Zone
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button 
          variant="danger"
          onClick={() => setShowDeleteModal(true)}
        >
          <TrashIcon className="h-5 w-5 mr-2" />
          Delete Account
        </Button>
      </Card>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Profile"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="Enter your name"
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Profile Picture URL (optional)
            </label>
            <input
              type="url"
              value={editForm.picture}
              onChange={(e) => setEditForm({ ...editForm, picture: e.target.value })}
              placeholder="https://example.com/picture.jpg"
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            {editForm.picture && (
              <img
                src={editForm.picture}
                alt="Preview"
                className="mt-2 h-20 w-20 rounded-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={() => setShowEditModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              variant="primary"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
              ⚠️ Warning: This action cannot be undone
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Deleting your account will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
              <li>All your saved strategies</li>
              <li>Your watchlist items</li>
              <li>Your trading journal entries</li>
              <li>All account data and preferences</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              id="deleteConfirm"
              placeholder="DELETE"
              className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-base sm:text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const confirmInput = document.getElementById('deleteConfirm');
                if (confirmInput?.value === 'DELETE') {
                  handleDeleteAccount();
                } else {
                  toast.error('Please type DELETE to confirm');
                }
              }}
              variant="danger"
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;

