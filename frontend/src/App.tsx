import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Typography,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import HistoryIcon from '@mui/icons-material/History';
import { BrandProvider } from './context/BrandContext';
import { AuthProvider } from './context/AuthContext';
import { XmlManagerProvider } from './context/XmlManagerContext';
import { Header } from './components/Header';
import { XmlUploader } from './components/XmlUploader';
import { XmlDynamicEditor } from './components/xmlEditor/XmlDynamicEditor';
import { HistoryTable } from './components/HistoryTable';
import { S3SyncModal } from './components/S3SyncModal';
import { LoginModal } from './components/LoginModal';
import { BrandCustomizerDrawer } from './components/BrandCustomizerDrawer';

const MainAppContent: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [currentTab, setCurrentTab] = useState(0);
  const [s3ModalOpen, setS3ModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Header
        onOpenS3Modal={() => setS3ModalOpen(true)}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onOpenBrandCustomizer={() => setBrandDrawerOpen(true)}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      />

      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          py: { xs: 2, md: 3 },
          px: { xs: 1.5, sm: 2.5, md: 3 },
          pb: { xs: 8, md: 4 },
        }}
      >
        <XmlUploader />

        {isMobile && (
          <Paper
            sx={{
              mt: 2,
              mb: 2,
              borderRadius: '8px',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Tabs
              value={currentTab}
              onChange={(_, val) => setCurrentTab(val)}
              variant="fullWidth"
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab
                label="XML Editor"
                icon={<DescriptionIcon fontSize="small" />}
                iconPosition="start"
                sx={{ fontSize: '0.78rem', minHeight: 44 }}
              />
              <Tab
                label="History"
                icon={<HistoryIcon fontSize="small" />}
                iconPosition="start"
                sx={{ fontSize: '0.78rem', minHeight: 44 }}
              />
            </Tabs>
          </Paper>
        )}

        <Box sx={{ mt: 2.5 }}>
          {currentTab === 0 && <XmlDynamicEditor />}
          {currentTab === 1 && <HistoryTable onSwitchToEditor={() => setCurrentTab(0)} />}
        </Box>
      </Container>

      {isMobile && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
          elevation={3}
        >
          <BottomNavigation
            showLabels
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
          >
            <BottomNavigationAction label="XML Editor" icon={<DescriptionIcon />} />
            <BottomNavigationAction label="History" icon={<HistoryIcon />} />
          </BottomNavigation>
        </Paper>
      )}

      <Box
        component="footer"
        sx={{
          py: 1.5,
          px: 3,
          mt: 'auto',
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          fontSize: '0.75rem',
          color: theme.palette.text.secondary,
        }}
      >
        <Typography variant="caption">XML S3 Sync Manager</Typography>
        <Typography variant="caption">W3C XML</Typography>
      </Box>

      <S3SyncModal
        open={s3ModalOpen}
        onClose={() => setS3ModalOpen(false)}
        onSynced={() => setCurrentTab(1)}
      />
      <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <BrandCustomizerDrawer open={brandDrawerOpen} onClose={() => setBrandDrawerOpen(false)} />
    </Box>
  );
};

export default function App() {
  return (
    <BrandProvider>
      <AuthProvider>
        <XmlManagerProvider>
          <MainAppContent />
        </XmlManagerProvider>
      </AuthProvider>
    </BrandProvider>
  );
}
