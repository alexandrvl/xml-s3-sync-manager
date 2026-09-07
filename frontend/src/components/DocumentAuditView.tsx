import React, { useState, useMemo, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Divider,
  useTheme,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CodeIcon from '@mui/icons-material/Code';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import StorageIcon from '@mui/icons-material/Storage';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AuditDocument } from '../types';
import { useXmlManager } from '../context/XmlManagerContext';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { parseXmlStringToModel } from '../utils/xmlParser';
import { extractDocumentValues, extractKeySummary } from '../utils/auditHelper';
import { inboundObjectKey, isInboundObjectKey, objectKeyForNewCopy, parentFoldersForKey, sortParentFolders } from '../utils/fileName';
import { readStorage, writeStorage } from '../utils/storage';
import { OverwriteConfirmDialog } from './OverwriteConfirmDialog';

const LATEST_COUNT_OPTIONS = [1, 3, 5, 10, 20, 50] as const;
const DEFAULT_LATEST_COUNT = 10;

function readLatestCount(): number {
  const stored = readStorage<number>('audit_latest_count', DEFAULT_LATEST_COUNT);
  return (LATEST_COUNT_OPTIONS as readonly number[]).includes(stored)
    ? stored
    : DEFAULT_LATEST_COUNT;
}

interface DocumentAuditViewProps {
  onSwitchToEditor?: () => void;
}

export const DocumentAuditView: React.FC<DocumentAuditViewProps> = ({ onSwitchToEditor }) => {
  const theme = useTheme();
  const { brand } = useBrand();
  const { canEdit } = useAuth();
  const {
    s3StoredDocs,
    s3ParentFolders,
    document: activeDoc,
    loadAuditDocAsActive,
    createXmlFromAuditDoc,
    suggestNameFromAuditDoc,
    refreshS3Listing,
    isListingS3,
  } = useXmlManager();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocForInspect, setSelectedDocForInspect] = useState<AuditDocument | null>(null);
  const [selectedDocForRawXml, setSelectedDocForRawXml] = useState<AuditDocument | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{ message: string; severity: 'success' | 'info' | 'warning' } | null>(null);
  const [createFromDoc, setCreateFromDoc] = useState<AuditDocument | null>(null);
  const [newXmlFileName, setNewXmlFileName] = useState('');
  const [createObjectKey, setCreateObjectKey] = useState('');
  const [createPathTouched, setCreatePathTouched] = useState(false);
  const [createNameError, setCreateNameError] = useState<string | null>(null);
  const [reactivateDoc, setReactivateDoc] = useState<AuditDocument | null>(null);
  const [reactivateObjectKey, setReactivateObjectKey] = useState('');
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [overwriteAction, setOverwriteAction] = useState<'create' | 'reactivate' | null>(null);
  const [overwriteMessage, setOverwriteMessage] = useState('');
  const [latestCount, setLatestCount] = useState<number>(readLatestCount);
  const [folderFilter, setFolderFilter] = useState(() => readStorage<string>('audit_folder_filter', ''));

  useEffect(() => {
    writeStorage('audit_latest_count', latestCount);
  }, [latestCount]);

  useEffect(() => {
    writeStorage('audit_folder_filter', folderFilter);
  }, [folderFilter]);

  useEffect(() => {
    const delay = searchQuery.trim() ? 300 : 0;
    const timer = window.setTimeout(() => {
      void refreshS3Listing(latestCount, folderFilter || undefined, searchQuery);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [latestCount, folderFilter, searchQuery, refreshS3Listing]);

  const currentS3Docs: AuditDocument[] = useMemo(() => {
    return [...s3StoredDocs]
      .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
      .map((doc) => {
        const parsed = parseXmlStringToModel(doc.content, doc.fileName);
        const values = parsed.document ? extractDocumentValues(parsed.document.root) : [];
        const lastModifiedMs = Date.parse(doc.lastModified);
        return {
          id: doc.key,
          fileName: doc.fileName,
          fileSize: doc.sizeBytes,
          lastModified: Number.isNaN(lastModifiedMs) ? Date.now() : lastModifiedMs,
          timestamp: Number.isNaN(lastModifiedMs)
            ? doc.lastModified
            : new Date(lastModifiedMs).toLocaleString(),
          user: 'S3',
          userEmail: '',
          s3Uri: doc.s3Uri,
          etag: doc.etag,
          versionId: doc.versionId,
          status: 'synced' as const,
          description: `Current object at ${doc.s3Uri}`,
          rawXml: doc.content,
          rootTag: parsed.document?.root.tagName || 'xml',
          values,
          keySummary: extractKeySummary(values),
        };
      });
  }, [s3StoredDocs]);

  const folderOptions = useMemo(() => {
    return sortParentFolders(folderFilter ? [...s3ParentFolders, folderFilter] : s3ParentFolders);
  }, [folderFilter, s3ParentFolders]);

  const filteredDocs = useMemo(() => {
    const inFolder = folderFilter
      ? currentS3Docs.filter((doc) => doc.id === folderFilter || doc.id.startsWith(`${folderFilter}/`))
      : currentS3Docs;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return inFolder;

    return inFolder.filter((doc) => {
      const matchName = doc.fileName.toLowerCase().includes(q);
      const matchS3 = doc.s3Uri?.toLowerCase().includes(q) || false;
      const matchKey = doc.id.toLowerCase().includes(q);
      const matchValues = doc.values.some(
        (v) => v.tag.toLowerCase().includes(q) || v.value.toLowerCase().includes(q) || v.path.toLowerCase().includes(q)
      );
      return matchName || matchS3 || matchKey || matchValues;
    });
  }, [currentS3Docs, searchQuery, folderFilter]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openCreateNewXmlDialog = (doc: AuditDocument) => {
    const suggested = suggestNameFromAuditDoc(doc.id) || `${doc.fileName.replace(/\.xml$/i, '')}-copy.xml`;
    setCreateFromDoc(doc);
    setNewXmlFileName(suggested);
    setCreateObjectKey(inboundObjectKey(suggested));
    setCreatePathTouched(false);
    setCreateNameError(null);
  };

  const handleConfirmCreateNewXml = (overwrite = false) => {
    if (!createFromDoc) return;
    const result = createXmlFromAuditDoc(createFromDoc.id, newXmlFileName, createObjectKey, overwrite);
    if (result.needsOverwrite) {
      setOverwriteAction('create');
      setOverwriteMessage(result.error || 'A file with this name already exists.');
      return;
    }
    if (!result.success) {
      setCreateNameError(result.error || 'Could not create the document.');
      return;
    }
    setOverwriteAction(null);
    setCreateFromDoc(null);
    setActionAlert({
      message: `Created "${result.fileName}" from "${createFromDoc.fileName}". Sync will store it as ${result.objectKey || result.fileName} without replacing the original.`,
      severity: 'success',
    });
    if (onSwitchToEditor) {
      setTimeout(() => onSwitchToEditor(), 800);
    }
  };

  // Action: Reactivate a synced doc (optionally in a different IN/ folder)
  const openReactivateDialog = (doc: AuditDocument) => {
    if (!isInboundObjectKey(doc.id)) {
      setActionAlert({
        message: `"${doc.fileName}" is outside IN/ and is audit-only.`,
        severity: 'warning',
      });
      return;
    }
    setReactivateDoc(doc);
    setReactivateObjectKey(doc.id);
    setReactivateError(null);
  };

  const handleConfirmReactivate = (overwrite = false) => {
    if (!reactivateDoc) return;
    const result = loadAuditDocAsActive(reactivateDoc.id, reactivateObjectKey, overwrite);
    if (result.needsOverwrite) {
      setOverwriteAction('reactivate');
      setOverwriteMessage(result.error || 'A file with this name already exists.');
      return;
    }
    if (!result.success) {
      setReactivateError(result.error || 'Could not reactivate the document.');
      return;
    }
    const folderChanged = (result.objectKey || reactivateObjectKey) !== reactivateDoc.id;
    setOverwriteAction(null);
    setReactivateDoc(null);
    setActionAlert({
      message: folderChanged
        ? `Reactivated "${reactivateDoc.fileName}" for ${result.objectKey}. Sync will write to that IN/ path.`
        : `Reactivated "${reactivateDoc.fileName}" in the editor.`,
      severity: 'info',
    });
    if (onSwitchToEditor) {
      setTimeout(() => onSwitchToEditor(), 800);
    }
  };

  const handleOpenInspect = (doc: AuditDocument) => {
    setSelectedDocForInspect(doc);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Informative Header / Guide Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: `${brand.borderRadius}px`,
          backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <StorageIcon color="primary" sx={{ fontSize: '1.4rem' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                Current S3 State
              </Typography>
              <Chip
                label={`${currentS3Docs.length} latest`}
                size="small"
                color="primary"
                sx={{ fontWeight: 600, fontSize: '0.72rem', height: 24 }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 750 }}>
              Live listing of XML objects across all bucket folders (IN, OUT, and nested paths).
              After a file is synced it leaves the editor. Reactivate it here to edit again, or
              change its IN/ folder before the next sync. Filter by parent folder. Files outside
              IN/ stay audit-only.
            </Typography>
          </Box>

          {/* Quick Active Editor Status */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 240,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
              CURRENT ACTIVE EDITOR DOCUMENT
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: activeDoc ? theme.palette.primary.main : 'text.disabled' }}>
              {activeDoc ? activeDoc.fileName : 'None Loaded'}
            </Typography>
            {!activeDoc && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                Synced files stay here until you reactivate one.
              </Typography>
            )}
            {activeDoc && onSwitchToEditor && (
              <Button
                size="small"
                variant="text"
                onClick={onSwitchToEditor}
                sx={{ p: 0, mt: 0.5, fontSize: '0.7rem', textTransform: 'none' }}
              >
                Go to XML Editor &rarr;
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Search Filter Bar */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={
            folderFilter
              ? `Search by file name in ${folderFilter}…`
              : 'Search by file name, S3 URI, tag name, or specific value...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 220, backgroundColor: theme.palette.background.paper }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Autocomplete
          size="small"
          options={folderOptions}
          value={folderFilter || null}
          onChange={(_event, next) => setFolderFilter(next || '')}
          sx={{ minWidth: 260, backgroundColor: theme.palette.background.paper }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Parent folder"
              placeholder="Search folders by name…"
            />
          )}
        />
        <FormControl size="small" sx={{ minWidth: 180, backgroundColor: theme.palette.background.paper }}>
          <InputLabel id="latest-files-count-label">Latest files</InputLabel>
          <Select
            labelId="latest-files-count-label"
            label="Latest files"
            value={latestCount}
            onChange={(e) => setLatestCount(Number(e.target.value))}
          >
            {LATEST_COUNT_OPTIONS.map((count) => (
              <MenuItem key={count} value={count}>
                {count === 1 ? '1 latest file' : `${count} latest files`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          variant="outlined"
          onClick={() => refreshS3Listing(latestCount, folderFilter || undefined, searchQuery)}
          disabled={isListingS3}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {isListingS3 ? 'Reading S3…' : 'Refresh from S3'}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          Showing {filteredDocs.length} of {currentS3Docs.length} latest objects
        </Typography>
      </Box>

      {/* 10 Documents Cards with Values */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredDocs.length === 0 ? (
          <Paper
            sx={{
              p: 5,
              textAlign: 'center',
              borderRadius: `${brand.borderRadius}px`,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <StorageIcon sx={{ fontSize: '3rem', color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {currentS3Docs.length === 0 ? 'No XML objects in S3' : 'No documents matched your search'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {currentS3Docs.length === 0
                ? 'Sync a document to S3 from the editor, then refresh this list to see current state.'
                : 'Try a different keyword, increase the latest-files count, or clear the search field.'}
            </Typography>
            <Button size="small" variant="outlined" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          </Paper>
        ) : (
          filteredDocs.map((doc, index) => {
            const inbound = isInboundObjectKey(doc.id);
            const parentFolder = parentFoldersForKey(doc.id).at(-1) || '/';
            return (
            <Paper
              key={doc.id}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: `${brand.borderRadius}px`,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.06)',
                },
              }}
            >
              {/* Document Header Line */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                      fontWeight: 700,
                      color: 'text.secondary',
                    }}
                  >
                    #{index + 1}
                  </Typography>

                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '0.95rem',
                      color: theme.palette.text.primary,
                    }}
                  >
                    {doc.fileName}
                  </Typography>

                  <Chip
                    label={doc.status.toUpperCase()}
                    size="small"
                    color={doc.status === 'synced' ? 'success' : 'default'}
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                  />

                  {doc.s3Uri && (
                    <Tooltip title="Synced to Amazon S3">
                      <Chip
                        icon={<CloudDoneIcon sx={{ fontSize: '0.85rem !important' }} />}
                        label="S3 STORED"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                      />
                    </Tooltip>
                  )}
                  <Chip
                    label={parentFolder}
                    size="small"
                    variant="outlined"
                    onClick={() => setFolderFilter(parentFolder)}
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, fontFamily: 'monospace' }}
                  />
                  {!inbound && (
                    <Chip
                      label="AUDIT ONLY"
                      size="small"
                      color="warning"
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                  )}
                </Box>

                {/* Timestamp & User */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary', fontSize: '0.75rem' }}>
                  <span>Updated {doc.timestamp}</span>
                  <span>•</span>
                  <span>{(doc.fileSize / 1024).toFixed(2)} KB</span>
                </Box>
              </Box>

              {/* S3 URI details */}
              {doc.s3Uri && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1.5,
                    p: 0.75,
                    px: 1.25,
                    backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <StorageIcon sx={{ fontSize: '0.9rem', color: theme.palette.primary.main }} />
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', color: 'text.secondary', flex: 1, wordBreak: 'break-all' }}
                  >
                    {doc.s3Uri}
                  </Typography>
                  {doc.etag && (
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.68rem' }}>
                      ETag: {doc.etag}
                    </Typography>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(doc.s3Uri || '', `s3_${doc.id}`)}
                    sx={{ p: 0.5 }}
                  >
                    {copiedKey === `s3_${doc.id}` ? (
                      <CheckIcon sx={{ fontSize: '0.85rem', color: 'success.main' }} />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: '0.85rem' }} />
                    )}
                  </IconButton>
                </Box>
              )}

              {/* Document Key Field Values Summary (Visual data preview to help fill new XML) */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    color: 'text.secondary',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  Document Values Summary ({doc.values.length} leaf fields):
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 1,
                  }}
                >
                  {doc.keySummary.slice(0, 8).map((item, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 600, display: 'block' }}
                      >
                        {item.tag}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: theme.palette.text.primary,
                        }}
                        title={item.value}
                      >
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Primary User Action Controls for Filling New XML */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Tooltip title="Create a brand-new XML document with a different file name so the original is not overwritten">
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => openCreateNewXmlDialog(doc)}
                      disabled={!canEdit}
                      sx={{ fontWeight: 600, textTransform: 'none', fontSize: '0.8rem' }}
                    >
                      Create New XML From This
                    </Button>
                  </Tooltip>

                  {/* Open Entire Document in Editor */}
                  <Tooltip
                    title={
                      inbound
                        ? 'Load this synced document into the editor. You can change its IN/ folder first.'
                        : 'Files outside IN/ are processed by another system and cannot be edited'
                    }
                  >
                    <span>
                      <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => openReactivateDialog(doc)}
                        disabled={!inbound}
                        sx={{ fontWeight: 500, textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        Reactivate
                      </Button>
                    </span>
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* Inspect & Pick Values Button */}
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleOpenInspect(doc)}
                    sx={{ fontSize: '0.78rem', textTransform: 'none' }}
                  >
                    Inspect All {doc.values.length} Values
                  </Button>

                  {/* View Raw XML */}
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<CodeIcon />}
                    onClick={() => setSelectedDocForRawXml(doc)}
                    sx={{ fontSize: '0.78rem', textTransform: 'none' }}
                  >
                    Raw XML
                  </Button>
                </Box>
              </Box>
            </Paper>
          );
          })
        )}
      </Box>

      <Dialog
        open={Boolean(selectedDocForInspect)}
        onClose={() => setSelectedDocForInspect(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VisibilityIcon color="primary" />
            <span>Document Field Values: {selectedDocForInspect?.fileName}</span>
          </Box>
          <Chip
            label={`${selectedDocForInspect?.values.length || 0} fields`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
            Click the copy icon to copy a value to the clipboard.
          </Typography>

          <TableContainer sx={{ maxHeight: 400, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Field Name / Tag</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>XML Path</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Copy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedDocForInspect?.values.map((field) => (
                    <TableRow key={field.path} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {field.tag}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary' }}>
                        {field.path}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                        {field.value}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(field.value, field.path)}
                          title="Copy field value"
                        >
                          {copiedKey === field.path ? (
                            <CheckIcon sx={{ fontSize: '0.85rem', color: 'success.main' }} />
                          ) : (
                            <ContentCopyIcon sx={{ fontSize: '0.85rem' }} />
                          )}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedDocForInspect(null)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(createFromDoc)}
        onClose={() => setCreateFromDoc(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Create New XML</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Copy values from <strong>{createFromDoc?.fileName}</strong> into a new editable document.
            The destination must stay under IN/. The original object is not overwritten.
          </Typography>
          <TextField
            autoFocus
            label="New file name"
            fullWidth
            size="small"
            value={newXmlFileName}
            onChange={(e) => {
              const nextName = e.target.value;
              setNewXmlFileName(nextName);
              setCreateNameError(null);
              if (!createPathTouched) {
                setCreateObjectKey(inboundObjectKey(nextName));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmCreateNewXml();
              }
            }}
            error={Boolean(createNameError)}
            helperText={createNameError || undefined}
          />
          <TextField
            label="Destination path"
            fullWidth
            size="small"
            value={createObjectKey}
            onChange={(e) => {
              setCreatePathTouched(true);
              setCreateObjectKey(e.target.value);
              setCreateNameError(null);
            }}
            placeholder={objectKeyForNewCopy('', newXmlFileName || 'document.xml')}
            helperText="Must start with IN/. You can change the year/month/day folders or file name."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateFromDoc(null)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={() => handleConfirmCreateNewXml()} disabled={!newXmlFileName.trim()}>
            Create XML
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reactivateDoc)}
        onClose={() => setReactivateDoc(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Reactivate document</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Load <strong>{reactivateDoc?.fileName}</strong> back into the editor. Keep the current
            path to edit in place, or change the IN/ folder so the next sync writes there.
          </Typography>
          <TextField
            autoFocus
            label="Destination path"
            fullWidth
            size="small"
            value={reactivateObjectKey}
            onChange={(e) => {
              setReactivateObjectKey(e.target.value);
              setReactivateError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmReactivate();
              }
            }}
            error={Boolean(reactivateError)}
            helperText={reactivateError || 'Must stay under IN/. Changing the folder does not move the original object until you sync.'}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReactivateDoc(null)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={() => handleConfirmReactivate()} disabled={!reactivateObjectKey.trim()}>
            Open in editor
          </Button>
        </DialogActions>
      </Dialog>

      {/* Raw XML Preview Dialog */}
      <Dialog
        open={Boolean(selectedDocForRawXml)}
        onClose={() => setSelectedDocForRawXml(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Raw XML: {selectedDocForRawXml?.fileName}</span>
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopy(selectedDocForRawXml?.rawXml || '', 'raw_xml')}
          >
            {copiedKey === 'raw_xml' ? 'Copied!' : 'Copy XML'}
          </Button>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <Box
            component="pre"
            sx={{
              p: 2,
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              overflowX: 'auto',
              maxHeight: 500,
              m: 0,
            }}
          >
            {selectedDocForRawXml?.rawXml}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedDocForRawXml(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <OverwriteConfirmDialog
        open={Boolean(overwriteAction)}
        message={overwriteMessage}
        onCancel={() => setOverwriteAction(null)}
        onConfirm={() => {
          if (overwriteAction === 'create') {
            handleConfirmCreateNewXml(true);
          } else if (overwriteAction === 'reactivate') {
            handleConfirmReactivate(true);
          }
        }}
      />

      {/* User Feedback Notification */}
      <Snackbar
        open={Boolean(actionAlert)}
        autoHideDuration={4000}
        onClose={() => setActionAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setActionAlert(null)}
          severity={actionAlert?.severity || 'info'}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {actionAlert?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
