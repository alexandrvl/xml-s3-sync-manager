import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginModal: React.FC<LoginModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { user, isAuthenticated, isRemote, isEntra, isTestProfile, testEmail, testName, login, loginTest, loginEntra, logout } =
    useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Viewer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && isTestProfile && !email) {
      setEmail(testEmail);
    }
  }, [open, isTestProfile, testEmail, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!isTestProfile && !EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (isTestProfile && !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (isRemote && !password) {
      setError('Password is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login(trimmed, password || 'local', isRemote ? undefined : selectedRole);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Sign in
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {isAuthenticated && user && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => void logout()}>
                  Sign Out
                </Button>
              }
            >
              Signed in as <strong>{user.name}</strong> ({user.role}).
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            {isTestProfile
              ? `TEST profile is active. Sign in as ${testName} with ${testEmail} and the TEST password (AUTH_TEST_TOKEN). Entra ID is skipped.`
              : isEntra
                ? 'Sign in with Microsoft Entra ID. The API validates your access token and assigns a role from app roles.'
                : isRemote
                  ? 'Credentials are verified by POST /api/v1/auth/login. The API assigns your role.'
                  : 'Local adapter is active (VITE_API_BASE_URL is empty). Role is used only until the backend is connected.'}
          </Typography>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isTestProfile && Boolean((import.meta.env.VITE_TEST_TOKEN || '').trim()) && (
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={busy}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  await loginTest();
                  onClose();
                } catch (err) {
                  setError((err as Error).message || 'Test user sign-in failed.');
                } finally {
                  setBusy(false);
                }
              }}
              sx={{ py: 1, fontWeight: 600 }}
            >
              {busy ? 'Signing in...' : `Sign in as ${testName} (${testEmail})`}
            </Button>
          )}

          {isEntra && (
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={busy}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  await loginEntra();
                } catch (err) {
                  setError((err as Error).message || 'Microsoft sign-in failed.');
                  setBusy(false);
                }
              }}
              sx={{ py: 1, fontWeight: 600 }}
            >
              {busy ? 'Redirecting...' : 'Sign in with Microsoft'}
            </Button>
          )}

          {!isEntra && (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              type={isTestProfile ? 'text' : 'email'}
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isTestProfile ? testEmail : 'you@company.com'}
              autoComplete="username"
              required
            />
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isTestProfile ? 'TEST password' : undefined}
              helperText={isTestProfile ? `Test user: ${testEmail}` : undefined}
              autoComplete="current-password"
              required={isRemote}
            />

            {!isRemote && (
              <FormControl fullWidth size="small">
                <InputLabel>Application Role</InputLabel>
                <Select
                  value={selectedRole}
                  label="Application Role"
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                >
                  <MenuItem value="Administrator">Administrator (edit and sync)</MenuItem>
                  <MenuItem value="Content Editor">Content Editor (edit XML)</MenuItem>
                  <MenuItem value="Viewer">Viewer (read-only)</MenuItem>
                </Select>
              </FormControl>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={busy}
              sx={{ py: 1, fontWeight: 600 }}
            >
              {busy ? 'Signing in...' : isRemote ? 'Sign In' : `Sign In as ${selectedRole}`}
            </Button>
          </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
