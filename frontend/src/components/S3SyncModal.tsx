import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Paper,
  Tooltip,
  IconButton,
  useTheme,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { useXmlManager } from '../context/XmlManagerContext';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { isRemoteApiEnabled } from '../api';
import { OverwriteConfirmDialog } from './OverwriteConfirmDialog';

interface S3SyncModalProps {
  open: boolean;
  onClose: () => void;
  onSynced?: () => void;
}

export const S3SyncModal: React.FC<S3SyncModalProps> = ({ open, onClose, onSynced }) => {
  const theme = useTheme();
  const { brand } = useBrand();
  const { canSyncS3 } = useAuth();
  const {
    document,
    s3Config,
    updateS3Config,
    performS3Sync,
    isSyncing,
    syncProgress,
    syncResult,
    s3UploadHistory,
    isActiveDocumentInbound,
  } = useXmlManager();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'history'>('sync');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [overwriteMessage, setOverwriteMessage] = useState<string | null>(null);
  const remote = isRemoteApiEnabled();

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const runSync = async (overwrite = false) => {
    setSyncError(null);
    const result = await performS3Sync(undefined, overwrite);
    if (result.needsOverwrite) {
      setOverwriteMessage(result.error || 'A file with this name already exists.');
      return;
    }
    if (!result.success) {
      setSyncError(result.error || 'Sync failed.');
      return;
    }
    setOverwriteMessage(null);
    onSynced?.();
  };

  const handleSyncSubmit = async () => {
    await runSync(false);
  };

  return (
    <>
    <Dialog open={open} onClose={isSyncing ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Sync to storage
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={isSyncing} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          <Button
            size="small"
            variant={activeTab === 'sync' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('sync')}
          >
            Push
          </Button>
          <Button
            size="small"
            variant={activeTab === 'history' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('history')}
          >
            History ({s3UploadHistory.length})
          </Button>
        </Box>

        {activeTab === 'sync' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Alert severity="info">
              {remote
                ? 'The backend stores the file. Bucket, credentials, and encryption stay on the server.'
                : 'No API base URL is set. This session uses the local adapter until you point VITE_API_BASE_URL at the backend from openapi.yaml.'}
            </Alert>
            {!canSyncS3 && (
              <Alert severity="warning">Sign in as an Administrator to sync.</Alert>
            )}
            {syncError && (
              <Alert severity="error" onClose={() => setSyncError(null)}>
                {syncError}
              </Alert>
            )}

            <Paper
              sx={{
                p: 2.5,
                borderRadius: `${brand.borderRadius}px`,
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Object key
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Destination path"
                value={s3Config.objectKey}
                onChange={(e) => updateS3Config({ objectKey: e.target.value })}
                placeholder="IN/2026/09/07/app-settings.xml"
                disabled={isSyncing || !canSyncS3}
                helperText="Must stay under IN/. Storage location is decided by the API."
              />
            </Paper>

            {isSyncing && (
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: `${brand.borderRadius}px`,
                  backgroundColor: `${theme.palette.primary.main}08`,
                  border: `1px solid ${theme.palette.primary.main}40`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {syncProgress.step}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                    {syncProgress.percent}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={syncProgress.percent}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Paper>
            )}

            {syncResult && !isSyncing && (
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: `${brand.borderRadius}px`,
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(34, 197, 94, 0.1)'
                      : 'rgba(34, 197, 94, 0.08)',
                  border: `1px solid ${theme.palette.success.main}50`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CheckCircleIcon color="success" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                    Sync completed
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  The file is no longer in the editor. Use History to reactivate it or change its IN/ folder.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {syncResult.s3Uri || syncResult.key}
                  </Typography>
                  {syncResult.s3Uri && (
                    <Tooltip title={copiedField === 'uri' ? 'Copied' : 'Copy URI'}>
                      <IconButton size="small" onClick={() => handleCopy(syncResult.s3Uri || '', 'uri')}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {(syncResult.sizeBytes / 1024).toFixed(2)} KB
                    {syncResult.etag ? ` · ${syncResult.etag}` : ''}
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        ) : (
          <Box>
            {s3UploadHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No uploads yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {s3UploadHistory.map((item) => (
                  <Paper
                    key={item.syncId}
                    sx={{
                      p: 2,
                      borderRadius: `${brand.borderRadius}px`,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {item.s3Uri || item.key}
                      </Typography>
                      <Chip size="small" label="OK" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {new Date(item.timestamp).toLocaleString()} · {(item.sizeBytes / 1024).toFixed(2)} KB
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} disabled={isSyncing}>
          Close
        </Button>
        {activeTab === 'sync' && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={handleSyncSubmit}
            disabled={isSyncing || !canSyncS3 || !document || !isActiveDocumentInbound}
            sx={{ fontWeight: 600, px: 3 }}
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
    <OverwriteConfirmDialog
      open={Boolean(overwriteMessage)}
      message={overwriteMessage || ''}
      onCancel={() => setOverwriteMessage(null)}
      onConfirm={() => {
        void runSync(true);
      }}
    />
    </>
  );
};
