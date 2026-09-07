import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PaletteIcon from '@mui/icons-material/Palette';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import LogoutIcon from '@mui/icons-material/Logout';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useXmlManager } from '../context/XmlManagerContext';

interface HeaderProps {
  onOpenBrandCustomizer?: () => void;
  onOpenS3Modal: () => void;
  onOpenLoginModal: () => void;
  currentTab: number;
  onTabChange: (tabIndex: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBrandCustomizer,
  onOpenS3Modal,
  onOpenLoginModal,
  currentTab,
  onTabChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { brand, toggleThemeMode } = useBrand();
  const { user, isAuthenticated, logout, canSyncS3, canManageBrand } = useAuth();
  const { document, isSyncing, isActiveDocumentInbound } = useXmlManager();

  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, minHeight: 68 }}>
        {/* Brand & Logo Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {brand.logoUrl ? (
            <Box
              component="img"
              src={brand.logoUrl}
              alt={brand.companyName}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '6px',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '6px',
                backgroundColor: theme.palette.primary.main,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '-0.02em',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }}
            >
              {brand.companyName.charAt(0) || 'X'}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                color: theme.palette.text.primary,
              }}
            >
              XML <Box component="span" sx={{ color: theme.palette.primary.main }}>Editor</Box>
            </Typography>
          </Box>
        </Box>

        {/* Center Nav Tabs (Desktop) */}
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '8px',
              p: 0.5,
              gap: 0.5,
            }}
          >
            <Button
              size="small"
              variant={currentTab === 0 ? 'contained' : 'text'}
              color={currentTab === 0 ? 'primary' : 'inherit'}
              startIcon={<DescriptionIcon sx={{ fontSize: '1.1rem' }} />}
              onClick={() => onTabChange(0)}
              sx={{
                px: 2,
                py: 0.6,
                fontSize: '0.8rem',
                fontWeight: currentTab === 0 ? 600 : 500,
                backgroundColor: currentTab === 0 ? theme.palette.primary.main : 'transparent',
                color: currentTab === 0 ? '#ffffff' : theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: currentTab === 0 ? theme.palette.primary.dark : theme.palette.mode === 'dark' ? '#1e293b' : '#e2e8f0',
                },
              }}
            >
              XML Editor
            </Button>
            <Button
              size="small"
              variant={currentTab === 1 ? 'contained' : 'text'}
              color={currentTab === 1 ? 'primary' : 'inherit'}
              startIcon={<HistoryIcon sx={{ fontSize: '1.1rem' }} />}
              onClick={() => onTabChange(1)}
              sx={{
                px: 2,
                py: 0.6,
                fontSize: '0.8rem',
                fontWeight: currentTab === 1 ? 600 : 500,
                backgroundColor: currentTab === 1 ? theme.palette.primary.main : 'transparent',
                color: currentTab === 1 ? '#ffffff' : theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: currentTab === 1 ? theme.palette.primary.dark : theme.palette.mode === 'dark' ? '#1e293b' : '#e2e8f0',
                },
              }}
            >
              History
            </Button>
          </Box>
        )}

        {/* Right Actions & Auth */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
          {/* Quick S3 Sync CTA */}
          <Tooltip title="Sync document to Cloud Storage">
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<CloudUploadIcon sx={{ fontSize: '1.1rem' }} />}
              onClick={() => onOpenS3Modal()}
              disabled={isSyncing || !document || !canSyncS3 || !isActiveDocumentInbound}
              sx={{
                fontWeight: 600,
                fontSize: '0.8rem',
                px: 2,
                py: 0.75,
                borderRadius: '6px',
                backgroundColor: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              {isSyncing ? 'Syncing...' : 'Sync to S3'}
            </Button>
          </Tooltip>

          {canManageBrand && onOpenBrandCustomizer && (
            <Tooltip title="Branding">
              <IconButton onClick={onOpenBrandCustomizer} size="small" color="inherit" sx={{ p: 0.75 }}>
                <PaletteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Theme Mode Toggle */}
          <Tooltip title={theme.palette.mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
            <IconButton onClick={toggleThemeMode} size="small" color="inherit" sx={{ p: 0.75 }}>
              {theme.palette.mode === 'dark' ? (
                <Brightness7Icon fontSize="small" />
              ) : (
                <Brightness4Icon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {/* User / SSO Profile */}
          {isAuthenticated && user ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={`${user.name} (${user.role}) - Click for options`}>
                <Box
                  onClick={handleUserMenuOpen}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    cursor: 'pointer',
                    p: 0.5,
                    borderRadius: '8px',
                    '&:hover': { backgroundColor: `${theme.palette.primary.main}10` },
                  }}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        lineHeight: 1.2,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {user.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.625rem',
                        color: theme.palette.text.secondary,
                        display: 'block',
                      }}
                    >
                      {user.authProvider === 'local' ? 'Local session' : 'Signed in'}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                      border: '2px solid #ffffff',
                      boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.palette.text.primary,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}
                  >
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Box>
                </Box>
              </Tooltip>

              <Tooltip title="Sign Out">
                <IconButton
                  onClick={() => void logout()}
                  size="small"
                  sx={{
                    color: theme.palette.text.secondary,
                    '&:hover': { color: '#ef4444' },
                    p: 0.75,
                  }}
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    sx: { width: 260, p: 1, mt: 1 },
                  },
                }}
              >
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {user.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {user.email}
                  </Typography>
                  <Box sx={{ mt: 0.75, display: 'flex', gap: 0.5 }}>
                    <Chip
                      size="small"
                      label={user.role}
                      color={user.role === 'Administrator' ? 'primary' : 'default'}
                    />
                    {user.authProvider === 'remote' && (
                      <Chip size="small" label="API session" variant="outlined" />
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {canManageBrand && onOpenBrandCustomizer && (
                  <MenuItem
                    onClick={() => {
                      handleUserMenuClose();
                      onOpenBrandCustomizer();
                    }}
                  >
                    <ListItemIcon>
                      <PaletteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Branding" />
                  </MenuItem>
                )}

                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    onOpenLoginModal();
                  }}
                >
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Account" />
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    void logout();
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon sx={{ color: 'error.main' }}>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Sign Out" />
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={onOpenLoginModal}
              startIcon={<SecurityIcon />}
              sx={{ fontWeight: 600 }}
            >
              Sign In
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
