import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Tooltip,
  Chip,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PaletteIcon from '@mui/icons-material/Palette';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckIcon from '@mui/icons-material/Check';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { useBrand } from '../context/BrandContext';

interface BrandCustomizerDrawerProps {
  open: boolean;
  onClose: () => void;
}

const BRAND_PALETTES = [
  { name: 'Corporate Blue', primary: '#1976d2', secondary: '#0288d1' },
  { name: 'Emerald Forest', primary: '#059669', secondary: '#10b981' },
  { name: 'Royal Indigo', primary: '#4f46e5', secondary: '#6366f1' },
  { name: 'Deep Purple', primary: '#7c3aed', secondary: '#a855f7' },
  { name: 'Amber Gold', primary: '#d97706', secondary: '#f59e0b' },
  { name: 'Crimson Red', primary: '#dc2626', secondary: '#ef4444' },
  { name: 'Midnight Slate', primary: '#1e293b', secondary: '#475569' },
];

export const BrandCustomizerDrawer: React.FC<BrandCustomizerDrawerProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { brand, updateBrand, resetBrand } = useBrand();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateBrand({ logoUrl: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 440 },
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaletteIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Company Branding &amp; Style
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Customize your organization's logo, brand colors, typography, and border radius in real time.
        </Typography>

        <Divider />

        {/* Brand Identity */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Corporate Identity
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Company Name"
            value={brand.companyName}
            onChange={(e) => updateBrand({ companyName: e.target.value })}
            placeholder="e.g. Contoso"
          />

          <TextField
            fullWidth
            size="small"
            label="Tagline / Department"
            value={brand.tagline}
            onChange={(e) => updateBrand({ tagline: e.target.value })}
            placeholder="e.g. Cloud Operations Team"
          />

          {/* Logo Customization */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              Company Logo:
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              {brand.logoUrl ? (
                <Box
                  component="img"
                  src={brand.logoUrl}
                  alt="Company Logo"
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: `${brand.borderRadius}px`,
                    objectFit: 'contain',
                    border: `1px solid ${theme.palette.divider}`,
                    p: 0.5,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: `${brand.borderRadius}px`,
                    backgroundColor: brand.primaryColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  {brand.companyName.charAt(0) || 'C'}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  component="label"
                  startIcon={<AddPhotoAlternateIcon fontSize="small" />}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Upload Logo
                  <input
                    type="file"
                    hidden
                    accept="image/*,.svg"
                    onChange={handleFileUpload}
                  />
                </Button>

                {brand.logoUrl && (
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    onClick={() => updateBrand({ logoUrl: '' })}
                    startIcon={<DeleteIcon fontSize="small" />}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            </Box>

          </Box>
        </Box>

        <Divider />

        {/* Color Palettes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Color Theme &amp; Palettes
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {BRAND_PALETTES.map((palette) => (
              <Tooltip key={palette.name} title={palette.name}>
                <Box
                  onClick={() =>
                    updateBrand({
                      primaryColor: palette.primary,
                      secondaryColor: palette.secondary,
                    })
                  }
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    backgroundColor: palette.primary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    border:
                      brand.primaryColor.toLowerCase() === palette.primary.toLowerCase()
                        ? '3px solid #000000'
                        : '2px solid transparent',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.1)' },
                  }}
                >
                  {brand.primaryColor.toLowerCase() === palette.primary.toLowerCase() && (
                    <CheckIcon sx={{ fontSize: 18 }} />
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              size="small"
              label="Primary Hex"
              value={brand.primaryColor}
              onChange={(e) => updateBrand({ primaryColor: e.target.value })}
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: brand.primaryColor,
                        mr: 1,
                        border: '1px solid #ccc',
                      }}
                    />
                  ),
                },
              }}
            />
            <TextField
              size="small"
              label="Secondary Hex"
              value={brand.secondaryColor}
              onChange={(e) => updateBrand({ secondaryColor: e.target.value })}
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: brand.secondaryColor,
                        mr: 1,
                        border: '1px solid #ccc',
                      }}
                    />
                  ),
                },
              }}
            />
          </Box>
        </Box>

        <Divider />

        {/* UI Layout & Theme Mode */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Layout &amp; Surface Styling
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={brand.themeMode === 'dark'}
                onChange={(e) => updateBrand({ themeMode: e.target.checked ? 'dark' : 'light' })}
                color="primary"
              />
            }
            label={brand.themeMode === 'dark' ? 'Dark Mode (Active)' : 'Light Mode (Active)'}
          />

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
              Corner Border Radius: {brand.borderRadius}px
            </Typography>
            <Slider
              value={brand.borderRadius}
              min={2}
              max={16}
              step={2}
              onChange={(_, val) => updateBrand({ borderRadius: val as number })}
              valueLabelDisplay="auto"
            />
          </Box>
        </Box>

        {/* Live Preview Box */}
        <Paper
          sx={{
            p: 2,
            borderRadius: `${brand.borderRadius}px`,
            backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            Theme Component Preview
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" color="primary" size="small">
              Primary
            </Button>
            <Button variant="outlined" color="primary" size="small">
              Outlined
            </Button>
            <Chip label="Brand Tag" color="primary" size="small" />
          </Box>
        </Paper>
      </Box>

      {/* Footer Reset */}
      <Box sx={{ pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={resetBrand}
        >
          Reset to Factory Defaults
        </Button>
      </Box>
    </Drawer>
  );
};
