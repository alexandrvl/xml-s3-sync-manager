import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrandConfig } from '../types';
import { readStorage, writeStorage } from '../utils/storage';

interface BrandContextType {
  brand: BrandConfig;
  updateBrand: (updates: Partial<BrandConfig>) => void;
  resetBrand: () => void;
  toggleThemeMode: () => void;
}

const DEFAULT_BRAND: BrandConfig = {
  companyName: 'XML S3 Sync Manager',
  tagline: 'XML editor and S3 catalog',
  logoUrl: '',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  themeMode: 'light',
  borderRadius: 12,
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brand, setBrand] = useState<BrandConfig>(() =>
    readStorage<BrandConfig>('brand_settings', DEFAULT_BRAND)
  );

  useEffect(() => {
    writeStorage('brand_settings', brand);
  }, [brand]);

  const updateBrand = (updates: Partial<BrandConfig>) => {
    setBrand((prev) => ({ ...prev, ...updates }));
  };

  const resetBrand = () => {
    setBrand(DEFAULT_BRAND);
  };

  const toggleThemeMode = () => {
    setBrand((prev) => ({
      ...prev,
      themeMode: prev.themeMode === 'light' ? 'dark' : 'light',
    }));
  };

  // Dynamically compute the MUI Theme based on brand tokens
  const muiTheme: Theme = useMemo(() => {
    const isDark = brand.themeMode === 'dark';
    return createTheme({
      palette: {
        mode: brand.themeMode,
        primary: {
          main: brand.primaryColor,
        },
        secondary: {
          main: brand.secondaryColor,
        },
        divider: isDark ? '#334155' : '#e2e8f0',
        background: {
          default: isDark ? '#0b1120' : '#f8fafc',
          paper: isDark ? '#1e293b' : '#ffffff',
        },
        text: {
          primary: isDark ? '#f8fafc' : '#0f172a',
          secondary: isDark ? '#94a3b8' : '#64748b',
        },
      },
      shape: {
        borderRadius: brand.borderRadius,
      },
      typography: {
        fontFamily: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        button: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: brand.borderRadius,
              boxShadow: 'none',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              '&:hover': {
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: brand.borderRadius,
              backgroundImage: 'none',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderColor: isDark ? '#334155' : '#f1f5f9',
            },
          },
        },
      },
    });
  }, [brand]);

  return (
    <BrandContext.Provider value={{ brand, updateBrand, resetBrand, toggleThemeMode }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};
