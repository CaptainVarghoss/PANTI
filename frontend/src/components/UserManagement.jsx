import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdDelete } from "react-icons/md";

function UserManagement() {
    const { token, user, isAdmin } = useAuth();
    const [allUsers, setAllUsers] = useState([]);
    const [editableUsers, setEditableUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // State for password change form
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
    const [passwordChangeError, setPasswordChangeError] = useState('');

    const fetchAllUsers = useCallback(async () => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('/api/users/', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to fetch users.');
            const data = await response.json();
            setAllUsers(data);
            setEditableUsers(JSON.parse(JSON.stringify(data)));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, isAdmin]);

    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    const handleInputChange = (id, field, value) => {
        setEditableUsers(prev =>
            prev.map(u => (u.id === id ? { ...u, [field]: value } : u))
        );
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        setMessage(null);

        const updatePromises = editableUsers.map(u => {
            const originalUser = allUsers.find(orig => orig.id === u.id);
            if (JSON.stringify(u) === JSON.stringify(originalUser)) {
                return Promise.resolve({ ok: true });
            }
            return fetch(`/api/users/${u.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ admin: u.admin, login_allowed: u.login_allowed }),
            });
        });

        try {
            const results = await Promise.all(updatePromises);
            const failed = results.filter(res => !res.ok);
            if (failed.length > 0) throw new Error(`${failed.length} user(s) failed to update.`);
            setMessage('All user changes saved successfully!');
            fetchAllUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordChangeError('');
        setPasswordChangeMessage('');

        if (newPassword !== confirmPassword) {
            setPasswordChangeError("New passwords do not match.");
            return;
        }

        try {
            const response = await fetch('/api/users/me/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    current_password: oldPassword,
                    new_password: newPassword,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to change password.');
            }

            setPasswordChangeMessage('Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setPasswordChangeError(err.message);
        }
    };

    const hasUnsavedChanges = JSON.stringify(allUsers) !== JSON.stringify(editableUsers);

    return (
        <>
            <div className="section-container">
                <div className="section-header">
                    <h3>My Account ({user?.username})</h3>
                </div>
                <form onSubmit={handleChangePassword} className="section-list">
                    <div className="section-item">
                        <div className="section-row">
                            <div className="section-fields">
                                <div className="form-group">
                                    <label>Current Password</label>
                                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="form-input-base" required />
                                </div>
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="form-input-base" required />
                                </div>
                                <div className="form-group">
                                    <label>Confirm New Password</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="form-input-base" required />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="section-footer">
                        <button type="submit" className="btn-base btn-primary">Change Password</button>
                    </div>
                    {passwordChangeMessage && <p className="status-text" style={{ color: 'var(--accent-green)' }}>{passwordChangeMessage}</p>}
                    {passwordChangeError && <p className="error-text">{passwordChangeError}</p>}
                </form>
            </div>

            {isAdmin && (
                <div className="section-container">
                    <div className="section-header">
                        <h3>All Users</h3>
                    </div>
                    {loading ? <p>Loading users...</p> : (
                        <div className="section-list">
                            {editableUsers.map(u => (
                                <div key={u.id} className="section-item">
                                    <div className="section-row">
                                        <div className="section-fields">
                                            <p><strong>Username:</strong> {u.username}</p>
                                            <p><strong>ID:</strong> {u.id}</p>
                                        </div>
                                        <div className="section-fields section-fields-toggles">
                                            <div className="checkbox-container">
                                                <span className="checkbox-label">Admin</span>
                                                <label className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox-base"
                                                        checked={u.admin}
                                                        onChange={(e) => handleInputChange(u.id, 'admin', e.target.checked)}
                                                        disabled={u.id === user.id}
                                                    />
                                                </label>
                                            </div>
                                            <div className="checkbox-container">
                                                <span className="checkbox-label">Login Allowed</span>
                                                <label className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox-base"
                                                        checked={u.login_allowed}
                                                        onChange={(e) => handleInputChange(u.id, 'login_allowed', e.target.checked)}
                                                        disabled={u.id === user.id}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="section-fields">
                                            <button className="btn-base btn-red icon-button" disabled>
                                                <MdDelete size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {hasUnsavedChanges && (
                                <div className="section-footer">
                                    <button onClick={handleSaveChanges} className="btn-base btn-green" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Apply User Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {error && <p className="error-text">{error}</p>}
                    {message && <p className="status-text" style={{ color: 'var(--accent-green)' }}>{message}</p>}
                </div>
            )}
        </>
    );
}

export default UserManagement;