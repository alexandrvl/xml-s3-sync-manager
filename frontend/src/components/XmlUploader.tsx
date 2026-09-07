import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Alert,
  TextField,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FilePresentIcon from '@mui/icons-material/FilePresent';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useXmlManager } from '../context/XmlManagerContext';
import { useAuth } from '../context/AuthContext';
import { OverwriteConfirmDialog } from './OverwriteConfirmDialog';

export const XmlUploader: React.FC = () => {
  const theme = useTheme();
  const { canEdit: roleCanEdit } = useAuth();
  const { document, loadXmlFile, downloadXmlFile, renameActiveDocument, s3Config, isActiveDocumentInbound } =
    useXmlManager();
  const canEdit = roleCanEdit && isActiveDocumentInbound;
  const canUpload = roleCanEdit;

  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftFileName, setDraftFileName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingOverwriteName, setPendingOverwriteName] = useState<string | null>(null);
  const [overwriteMessage, setOverwriteMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document) {
      setDraftFileName(document.fileName);
      setIsRenaming(false);
      setRenameError(null);
    }
  }, [document?.fileName]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!canUpload) {
      setErrorMessage('Sign in as an editor to upload XML.');
      return;
    }
    setErrorMessage(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.xml') && file.type !== 'text/xml' && file.type !== 'application/xml') {
        setErrorMessage('Please upload a valid .xml file.');
        return;
      }

      const res = await loadXmlFile(file);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to parse XML file.');
      } else if (res.renamedFrom && res.fileName) {
        setSuccessMessage(`Loaded as "${res.fileName}" because "${res.renamedFrom}" already exists.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setSuccessMessage(`Successfully loaded "${res.fileName || file.name}"`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpload) {
      setErrorMessage('Sign in as an editor to upload XML.');
      e.target.value = '';
      return;
    }
    const files = e.target.files;
    if (files && files.length > 0) {
      setErrorMessage(null);
      const res = await loadXmlFile(files[0]);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to parse XML file.');
      } else if (res.renamedFrom && res.fileName) {
        setSuccessMessage(`Loaded as "${res.fileName}" because "${res.renamedFrom}" already exists.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setSuccessMessage(`Successfully loaded "${res.fileName || files[0].name}"`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    }
    e.target.value = '';
  };

  const startRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!document || !canEdit) return;
    setDraftFileName(document.fileName);
    setRenameError(null);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameError(null);
    setDraftFileName(document?.fileName || '');
  };

  const commitRename = (overwrite = false) => {
    const result = renameActiveDocument(draftFileName, overwrite);
    if (result.needsOverwrite) {
      setPendingOverwriteName(draftFileName);
      setOverwriteMessage(result.error || 'A file with this name already exists.');
      return;
    }
    if (!result.success) {
      setRenameError(result.error || 'Could not rename the document.');
      return;
    }
    setPendingOverwriteName(null);
    setIsRenaming(false);
    setRenameError(null);
    if (result.fileName && result.fileName !== document?.fileName) {
      setSuccessMessage(`File name set to "${result.fileName}"`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Box>
          <Paper
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!canUpload) return;
              fileInputRef.current?.click();
            }}
            sx={{
              p: 2.5,
              height: '100%',
              minHeight: 150,
              border: `2px dashed ${
                isDragOver ? theme.palette.primary.main : theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'
              }`,
              backgroundColor: isDragOver
                ? `${theme.palette.primary.main}08`
                : theme.palette.mode === 'dark'
                ? '#1e293b'
                : '#f8fafc',
              borderRadius: '12px',
              textAlign: 'center',
              cursor: canUpload ? 'pointer' : 'not-allowed',
              opacity: canUpload ? 1 : 0.55,
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              '&:hover': {
                borderColor: canUpload ? theme.palette.primary.main : undefined,
              },
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xml,text/xml,application/xml"
              style={{ display: 'none' }}
            />

            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: theme.palette.background.paper,
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
                color: isDragOver && canUpload
                  ? theme.palette.primary.main
                  : theme.palette.mode === 'dark'
                    ? '#94a3b8'
                    : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 24 }} />
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, fontSize: '0.85rem', color: theme.palette.text.primary }}
              >
                Drop XML file here
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', display: 'block' }}
              >
                or click to browse from your computer
              </Typography>
            </Box>
          </Paper>
        </Box>

        <Box>
          <Paper
            sx={{
              p: 2.5,
              height: '100%',
              minHeight: 150,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderRadius: '12px',
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: theme.palette.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <FilePresentIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                Active Document
              </Typography>
              {document && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon sx={{ fontSize: '0.95rem' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadXmlFile();
                  }}
                  sx={{ fontSize: '0.72rem', py: 0.25, px: 1.25, borderRadius: '6px' }}
                >
                  Download XML
                </Button>
              )}
            </Box>

            {document ? (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: '8px',
                  backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                  border: `1px solid ${renameError ? theme.palette.error.main : theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <TextField
                      inputRef={renameInputRef}
                      size="small"
                      value={draftFileName}
                      onChange={(e) => {
                        setDraftFileName(e.target.value);
                        setRenameError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      error={Boolean(renameError)}
                      helperText={renameError}
                      placeholder="document.xml"
                      sx={{
                        flex: 1,
                        minWidth: 160,
                        '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem', py: 0.5 },
                      }}
                    />
                  ) : (
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {document.fileName}
                      </Typography>
                      {s3Config.objectKey && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}
                        >
                          {s3Config.objectKey}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {!isRenaming && (
                    <Chip
                      size="small"
                      label={`<${document.root.tagName}>`}
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.68rem' }}
                    />
                  )}
                  {canEdit &&
                    (isRenaming ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Save name">
                          <IconButton size="small" color="primary" onClick={() => commitRename()} aria-label="Save file name">
                            <CheckIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton size="small" onClick={cancelRename} aria-label="Cancel rename">
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Tooltip title="Change file name">
                        <IconButton size="small" onClick={startRename} aria-label="Change file name">
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    ))}
                </Box>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                  {(document.fileSize / 1024).toFixed(1)} KB • v{document.version}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                No document loaded. Upload an XML file, or reactivate a synced file from History.
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
      <OverwriteConfirmDialog
        open={Boolean(pendingOverwriteName)}
        message={overwriteMessage}
        onCancel={() => setPendingOverwriteName(null)}
        onConfirm={() => commitRename(true)}
      />
    </Box>
  );
};
