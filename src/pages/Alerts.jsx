import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';
import {
  BellIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const Alerts = () => {
  const { theme } = useTheme();
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    alert_type: 'price',
    condition: 'above',
    threshold: '',
    percentage_change: '',
    notes: '',
    is_active: true,
    notification_method: 'in_app'
  });
  const notificationMethodLabels = {
    in_app: 'In-app',
    email: 'Email',
    both: 'In-app + Email'
  };

  useEffect(() => {
    loadAlerts();
    loadNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/alerts');
      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.alerts || []);
      } else {
        toast.error(data.error || 'Failed to load alerts');
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetchWithAuth('/api/alerts/notifications');
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleCreateAlert = async () => {
    if (!newAlert.symbol.trim()) {
      toast.error('Please enter a symbol');
      return;
    }

    if (newAlert.alert_type === 'price' && !newAlert.threshold) {
      toast.error('Please enter a price threshold');
      return;
    }

    if (newAlert.alert_type === 'percentage' && !newAlert.percentage_change) {
      toast.error('Please enter a percentage change');
      return;
    }

    try {
      const payload = {
        symbol: newAlert.symbol.trim().toUpperCase(),
        alert_type: newAlert.alert_type,
        condition: newAlert.condition,
        notes: newAlert.notes,
        is_active: newAlert.is_active,
        notification_method: newAlert.notification_method
      };

      if (newAlert.alert_type === 'price') {
        payload.threshold = parseFloat(newAlert.threshold);
      } else if (newAlert.alert_type === 'percentage') {
        payload.percentage_change = parseFloat(newAlert.percentage_change);
      }

      const response = await fetchWithAuth('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Alert created successfully');
        setShowCreateModal(false);
        setNewAlert({
          symbol: '',
          alert_type: 'price',
          condition: 'above',
          threshold: '',
          percentage_change: '',
          notes: '',
          is_active: true,
          notification_method: 'in_app'
        });
        await loadAlerts();
      } else {
        toast.error(data.error || 'Failed to create alert');
      }
    } catch (error) {
      console.error('Error creating alert:', error);
      toast.error('Failed to create alert');
    }
  };

  const handleEditAlert = async () => {
    if (!editingAlert) return;

    try {
      const payload = {
        symbol: editingAlert.symbol.trim().toUpperCase(),
        alert_type: editingAlert.alert_type,
        condition: editingAlert.condition,
        notes: editingAlert.notes,
        is_active: editingAlert.is_active,
        notification_method: editingAlert.notification_method
      };

      if (editingAlert.alert_type === 'price') {
        payload.threshold = parseFloat(editingAlert.threshold);
      } else if (editingAlert.alert_type === 'percentage') {
        payload.percentage_change = parseFloat(editingAlert.percentage_change);
      }

      const response = await fetchWithAuth(`/api/alerts/${editingAlert._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Alert updated successfully');
        setShowEditModal(false);
        setEditingAlert(null);
        await loadAlerts();
      } else {
        toast.error(data.error || 'Failed to update alert');
      }
    } catch (error) {
      console.error('Error updating alert:', error);
      toast.error('Failed to update alert');
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/alerts/${alertId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Alert deleted successfully');
        await loadAlerts();
      } else {
        toast.error(data.error || 'Failed to delete alert');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const handleToggleActive = async (alert) => {
    try {
      const response = await fetchWithAuth(`/api/alerts/${alert._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !alert.is_active
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadAlerts();
      } else {
        toast.error(data.error || 'Failed to update alert');
      }
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast.error('Failed to update alert');
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const response = await fetchWithAuth(`/api/alerts/notifications/${notificationId}/read`, {
        method: 'PUT'
      });

      if (response.ok) {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetchWithAuth('/api/alerts/notifications/read-all', {
        method: 'PUT'
      });

      if (response.ok) {
        await loadNotifications();
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BellIcon className="w-8 h-8" />
            Price Alerts
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Get notified when stocks hit your target prices
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Alert
        </Button>
      </div>

      {/* Notifications Section */}
      {unreadCount > 0 && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              onClick={handleMarkAllRead}
              variant="outline"
              size="sm"
            >
              Mark all as read
            </Button>
          </div>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {notifications.filter(n => !n.read).slice(0, 5).map((notif) => (
              <div
                key={notif._id}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                onClick={() => handleMarkNotificationRead(notif._id)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkNotificationRead(notif._id);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title="No alerts yet"
          description="Create your first price alert to get notified when stocks hit your target prices"
          actionLabel="Create Alert"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => {
            const methodLabel = notificationMethodLabels[alert.notification_method || 'in_app'];
            return (
            <Card key={alert._id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {alert.symbol}
                    </h3>
                    {alert.is_active ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>
                      {alert.alert_type === 'price' ? (
                        <>
                          Alert when price is <strong>{alert.condition}</strong> ${alert.threshold?.toFixed(2)}
                        </>
                      ) : (
                        <>
                          Alert when change is <strong>{alert.condition}</strong> {alert.percentage_change}%
                        </>
                      )}
                    </p>
                    {alert.trigger_count > 0 && (
                      <p className="text-xs">
                        Triggered {alert.trigger_count} time{alert.trigger_count !== 1 ? 's' : ''}
                        {alert.last_triggered && (
                          <> • Last: {new Date(alert.last_triggered).toLocaleString()}</>
                        )}
                      </p>
                    )}
                    <p className="text-xs">
                      Delivery: {methodLabel}
                    </p>
                    {alert.notes && (
                      <p className="text-xs italic mt-1">{alert.notes}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={() => handleToggleActive(alert)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {alert.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  onClick={() => {
                    setEditingAlert({
                      ...alert,
                      notification_method: alert.notification_method || 'in_app'
                    });
                    setShowEditModal(true);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDeleteAlert(alert._id)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )})}
        </div>
      )}

      {/* Create Alert Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Price Alert"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Symbol *
            </label>
            <input
              type="text"
              value={newAlert.symbol}
              onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
              placeholder="AAPL"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alert Type *
            </label>
            <select
              value={newAlert.alert_type}
              onChange={(e) => setNewAlert({ ...newAlert, alert_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="price">Price Threshold</option>
              <option value="percentage">Percentage Change</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condition *
            </label>
            <select
              value={newAlert.condition}
              onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="equals">Equals</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notification Method *
            </label>
            <select
              value={newAlert.notification_method}
              onChange={(e) => setNewAlert({ ...newAlert, notification_method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="in_app">In-app only</option>
              <option value="email">Email only</option>
              <option value="both">In-app + Email</option>
            </select>
          </div>

          {newAlert.alert_type === 'price' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price Threshold *
              </label>
              <input
                type="number"
                step="0.01"
                value={newAlert.threshold}
                onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                placeholder="150.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Percentage Change *
              </label>
              <input
                type="number"
                step="0.01"
                value={newAlert.percentage_change}
                onChange={(e) => setNewAlert({ ...newAlert, percentage_change: e.target.value })}
                placeholder="5.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={newAlert.notes}
              onChange={(e) => setNewAlert({ ...newAlert, notes: e.target.value })}
              placeholder="Add any notes about this alert..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={newAlert.is_active}
              onChange={(e) => setNewAlert({ ...newAlert, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              Activate immediately
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCreateAlert}
              className="flex-1"
            >
              Create Alert
            </Button>
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Alert Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingAlert(null);
        }}
        title="Edit Alert"
        size="md"
      >
        {editingAlert && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Symbol *
              </label>
              <input
                type="text"
                value={editingAlert.symbol}
                onChange={(e) => setEditingAlert({ ...editingAlert, symbol: e.target.value.toUpperCase() })}
                placeholder="AAPL"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert Type *
              </label>
              <select
                value={editingAlert.alert_type}
                onChange={(e) => setEditingAlert({ ...editingAlert, alert_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="price">Price Threshold</option>
                <option value="percentage">Percentage Change</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Condition *
              </label>
              <select
                value={editingAlert.condition}
                onChange={(e) => setEditingAlert({ ...editingAlert, condition: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="equals">Equals</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notification Method *
              </label>
              <select
                value={editingAlert.notification_method}
                onChange={(e) => setEditingAlert({ ...editingAlert, notification_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="in_app">In-app only</option>
                <option value="email">Email only</option>
                <option value="both">In-app + Email</option>
              </select>
            </div>

            {editingAlert.alert_type === 'price' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price Threshold *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingAlert.threshold || ''}
                  onChange={(e) => setEditingAlert({ ...editingAlert, threshold: e.target.value })}
                  placeholder="150.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Percentage Change *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingAlert.percentage_change || ''}
                  onChange={(e) => setEditingAlert({ ...editingAlert, percentage_change: e.target.value })}
                  placeholder="5.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={editingAlert.notes || ''}
                onChange={(e) => setEditingAlert({ ...editingAlert, notes: e.target.value })}
                placeholder="Add any notes about this alert..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={editingAlert.is_active}
                onChange={(e) => setEditingAlert({ ...editingAlert, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="edit_is_active" className="text-sm text-gray-700 dark:text-gray-300">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleEditAlert}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAlert(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Alerts;

