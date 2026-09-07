import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Alert,
  Tooltip,
  useTheme,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import { useXmlManager } from '../context/XmlManagerContext';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { OverwriteConfirmDialog } from './OverwriteConfirmDialog';

interface S3StorageDashboardProps {
  onOpenS3Modal: () => void;
}

export const S3StorageDashboard: React.FC<S3StorageDashboardProps> = ({ onOpenS3Modal }) => {
  const theme = useTheme();
  const { brand } = useBrand();
  const { canSyncS3 } = useAuth();
  const {
    document,
    s3Config,
    s3UploadHistory,
    history,
    isSyncing,
    performS3Sync,
    isActiveDocumentInbound,
  } = useXmlManager();

  const pendingChanges = history.filter((h) => h.status === 'pending');
  const [overwriteMessage, setOverwriteMessage] = useState<string | null>(null);

  const runSync = async (overwrite = false) => {
    const result = await performS3Sync(undefined, overwrite);
    if (result.needsOverwrite) {
      setOverwriteMessage(result.error || 'A file with this name already exists.');
      return;
    }
    if (result.success) {
      setOverwriteMessage(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Banner / S3 Overview Card */}
      <Paper
        sx={{
          p: 3,
          borderRadius: `${brand.borderRadius}px`,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: `${brand.borderRadius}px`,
                backgroundColor: `${theme.palette.primary.main}14`,
                color: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorageIcon fontSize="medium" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Storage sync
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Push XML through the REST API. Credentials never leave the server.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={onOpenS3Modal}
            >
              Configure S3
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<CloudUploadIcon />}
              onClick={() => {
                void runSync(false);
              }}
              disabled={isSyncing || !canSyncS3 || !document || !isActiveDocumentInbound}
            >
              {isSyncing ? 'Syncing...' : 'Sync to S3 Now'}
            </Button>
          </Box>
        </Box>

        {/* Configuration Summary Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Object key
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {s3Config.objectKey || '—'}
            </Typography>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Pending Sync Queue
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                size="small"
                label={`${pendingChanges.length} pending changes`}
                color={pendingChanges.length > 0 ? 'warning' : 'success'}
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Pending Changes Awaiting S3 Push */}
      {pendingChanges.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => { void runSync(false); }} disabled={!canSyncS3 || isSyncing || !isActiveDocumentInbound}>
              Sync Now
            </Button>
          }
        >
          You have <strong>{pendingChanges.length} unsynced changes</strong> ready for S3 synchronization.
        </Alert>
      )}

      {/* S3 Upload History Log */}
      <Paper
        sx={{
          p: 2.5,
          borderRadius: `${brand.borderRadius}px`,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Recent S3 PutObject Transmissions
          </Typography>
          <Chip label={`${s3UploadHistory.length} sync records`} size="small" />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Target S3 URI</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ETag / Checksum</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Version ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s3UploadHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No S3 sync executions yet. Click "Sync to S3 Now" above to upload your XML file.
                  </TableCell>
                </TableRow>
              ) : (
                s3UploadHistory.map((item) => (
                  <TableRow key={item.syncId} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                      {item.s3Uri}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {item.etag}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {item.versionId}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {(item.sizeBytes / 1024).toFixed(2)} KB
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={<CheckCircleIcon />}
                        label="VERIFIED"
                        color="success"
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <OverwriteConfirmDialog
        open={Boolean(overwriteMessage)}
        message={overwriteMessage || ''}
        onCancel={() => setOverwriteMessage(null)}
        onConfirm={() => {
          void runSync(true);
        }}
      />
    </Box>
  );
};
