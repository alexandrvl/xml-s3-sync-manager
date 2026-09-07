import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tooltip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import TableRowsIcon from '@mui/icons-material/TableRows';
import CodeIcon from '@mui/icons-material/Code';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DownloadIcon from '@mui/icons-material/Download';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SyncIcon from '@mui/icons-material/Sync';
import LayersIcon from '@mui/icons-material/Layers';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { XmlNode, XmlAttribute } from '../types';
import { useXmlManager } from '../context/XmlManagerContext';
import { useAuth } from '../context/AuthContext';
import { validateXmlString, parseXmlStringToModel, xmlModelToString } from '../utils/xmlParser';
import { PathBreadcrumb, PathStyleMode } from './PathBreadcrumb';

interface FlatFieldRow {
  id: string;
  path: string;
  tag: string;
  value: string;
  attributes: XmlAttribute[];
  isLeaf: boolean;
  depth: number;
  parentNodeId?: string;
  childrenCount: number;
}

export const XmlDynamicEditor: React.FC = () => {
  const theme = useTheme();
  const { canEdit: roleCanEdit } = useAuth();
  const {
    document,
    rawXml,
    updateNodeText,
    updateNodeAttribute,
    addNodeAttribute,
    deleteNodeAttribute,
    addChildNode,
    deleteNode,
    setRawXmlDirectly,
    downloadXmlFile,
    isActiveDocumentInbound,
  } = useXmlManager();
  const canEdit = roleCanEdit && isActiveDocumentInbound;

  // Layout View Modes: 'split' (Table + Raw XML on same page), 'table' (Table only), 'raw' (Raw only)
  const [layoutMode, setLayoutMode] = useState<'split' | 'table' | 'raw'>('split');
  // Split orientation: 'horizontal' (Side-by-Side columns) vs 'vertical' (Stacked top-table/bottom-raw full width)
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  // Split ratio for horizontal: '65_35' (spacious table), '50_50', '75_25'
  const [splitRatio, setSplitRatio] = useState<'65_35' | '50_50' | '75_25'>('65_35');
  // Path readability format
  const [pathStyle, setPathStyle] = useState<PathStyleMode>('breadcrumb');
  // Merge Tag & Path into a single 2-tier column to give maximum width to editable values
  const [mergeTagAndPath, setMergeTagAndPath] = useState(true);

  // Large Value Multi-line modal
  const [editingLargeField, setEditingLargeField] = useState<FlatFieldRow | null>(null);
  const [largeFieldValue, setLargeFieldValue] = useState('');

  // Table Mode: 'flat' (Path as column table), 'records' (Record grid where child paths are column names)
  const [tableMode, setTableMode] = useState<'flat' | 'records'>('flat');

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Raw XML Panel state
  const [rawTextValue, setRawTextValue] = useState(rawXml);
  const [isRawDirectEdit, setIsRawDirectEdit] = useState(false);
  const [rawValidationError, setRawValidationError] = useState<string | null>(null);
  const [rawCopied, setRawCopied] = useState(false);
  const [rawAppliedSuccess, setRawAppliedSuccess] = useState(false);

  // Add Field Dialog State
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newFieldTag, setNewFieldTag] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newFieldParentId, setNewFieldParentId] = useState('');

  // Add / Edit Attribute Dialog
  const [attrDialog, setAttrDialog] = useState<{
    open: boolean;
    nodeId: string;
    attrId?: string;
    name: string;
    value: string;
    isEdit: boolean;
  }>({
    open: false,
    nodeId: '',
    name: '',
    value: '',
    isEdit: false,
  });

  // Delete Confirm Dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    nodeId: string;
    path: string;
    tag: string;
  }>({
    open: false,
    nodeId: '',
    path: '',
    tag: '',
  });

  // Keep raw XML editor text in sync with context when not directly editing
  useEffect(() => {
    if (!isRawDirectEdit) {
      setRawTextValue(rawXml);
      setRawValidationError(null);
    }
  }, [rawXml, isRawDirectEdit]);

  // Flatten XML tree into rows where every field has its Path, Tag, Value, and Attributes
  const flatFields: FlatFieldRow[] = useMemo(() => {
    if (!document || !document.root) return [];
    const list: FlatFieldRow[] = [];

    function traverse(node: XmlNode, depth: number, parentId?: string) {
      const isLeaf = !node.children || node.children.length === 0;
      list.push({
        id: node.id,
        path: node.path,
        tag: node.tagName,
        value: node.textValue ?? '',
        attributes: node.attributes || [],
        isLeaf,
        depth,
        parentNodeId: parentId,
        childrenCount: node.children ? node.children.length : 0,
      });

      if (node.children) {
        for (const child of node.children) {
          traverse(child, depth + 1, node.id);
        }
      }
    }

    traverse(document.root, 0);
    return list;
  }, [document]);

  // Detect repeating records for "Record Grid" mode (e.g. repeated <book>, <employee>, etc.)
  const recordGridData = useMemo(() => {
    if (!document || !document.root) return null;
    const root = document.root;

    // Find parent that has repeated children with same tagName
    let targetParent: XmlNode | null = null;
    let targetChildTag = '';

    function findRepeated(node: XmlNode) {
      if (node.children && node.children.length >= 2) {
        const counts: Record<string, number> = {};
        for (const child of node.children) {
          counts[child.tagName] = (counts[child.tagName] || 0) + 1;
        }
        for (const [tag, count] of Object.entries(counts)) {
          if (count >= 2) {
            targetParent = node;
            targetChildTag = tag;
            return;
          }
        }
      }
      if (node.children) {
        for (const child of node.children) {
          findRepeated(child);
          if (targetParent) return;
        }
      }
    }

    findRepeated(root);

    if (!targetParent || !targetChildTag) return null;

    const parentNode: XmlNode = targetParent;
    const records = (parentNode.children || []).filter((c) => c.tagName === targetChildTag);
    if (records.length < 2) return null;

    // Collect all column names from attributes and child tags
    const columnSet = new Set<string>();
    records.forEach((rec) => {
      rec.attributes?.forEach((attr) => columnSet.add(`@${attr.name}`));
      rec.children?.forEach((child) => columnSet.add(child.tagName));
    });

    const columns = Array.from(columnSet);

    return {
      parentPath: parentNode.path,
      recordTag: targetChildTag,
      columns,
      records: records.map((rec, index) => {
        const rowData: Record<string, { value: string; nodeId?: string; attrId?: string; isAttr?: boolean }> = {};
        rec.attributes?.forEach((attr) => {
          rowData[`@${attr.name}`] = {
            value: attr.value,
            nodeId: rec.id,
            attrId: attr.id,
            isAttr: true,
          };
        });
        rec.children?.forEach((child) => {
          rowData[child.tagName] = {
            value: child.textValue ?? '',
            nodeId: child.id,
            isAttr: false,
          };
        });
        return {
          id: rec.id,
          path: rec.path,
          index: index + 1,
          fields: rowData,
        };
      }),
    };
  }, [document]);

  // Filtered rows for Flat Table
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return flatFields;
    const q = searchQuery.toLowerCase();
    return flatFields.filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.tag.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q) ||
        f.attributes.some((a) => a.name.toLowerCase().includes(q) || a.value.toLowerCase().includes(q))
    );
  }, [flatFields, searchQuery]);

  const paginatedFields = useMemo(() => {
    return filteredFields.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredFields, page, rowsPerPage]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  // Raw XML Actions
  const handleRawTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawTextValue(val);
    const check = validateXmlString(val);
    if (!check.isValid) {
      setRawValidationError(check.error || 'Syntax Error');
    } else {
      setRawValidationError(null);
    }
  };

  const handleApplyRawChanges = () => {
    const res = setRawXmlDirectly(rawTextValue);
    if (!res.success) {
      setRawValidationError(res.error || 'Failed to parse XML');
    } else {
      setRawValidationError(null);
      setRawAppliedSuccess(true);
      setTimeout(() => setRawAppliedSuccess(false), 2500);
    }
  };

  const handleFormatRawXml = () => {
    const res = parseXmlStringToModel(rawTextValue, document?.fileName || 'document.xml');
    if (res.document) {
      const formatted = xmlModelToString(res.document.root);
      setRawTextValue(formatted);
      setRawValidationError(null);
    } else {
      setRawValidationError(res.error || 'Cannot format invalid XML');
    }
  };

  const handleCopyRawXml = () => {
    navigator.clipboard.writeText(rawTextValue);
    setRawCopied(true);
    setTimeout(() => setRawCopied(false), 2000);
  };

  // Add field confirmation
  const handleConfirmAddField = () => {
    if (!newFieldTag.trim()) return;
    const parentId = newFieldParentId || document?.root.id;
    if (parentId) {
      addChildNode(parentId, newFieldTag.trim(), newFieldValue);
    }
    setAddFieldOpen(false);
    setNewFieldTag('');
    setNewFieldValue('');
    setNewFieldParentId('');
  };

  // Attribute confirmation
  const handleSaveAttribute = () => {
    if (!attrDialog.name.trim()) return;
    if (attrDialog.isEdit && attrDialog.attrId) {
      updateNodeAttribute(attrDialog.nodeId, attrDialog.attrId, attrDialog.name.trim(), attrDialog.value);
    } else {
      addNodeAttribute(attrDialog.nodeId, attrDialog.name.trim(), attrDialog.value);
    }
    setAttrDialog({ open: false, nodeId: '', name: '', value: '', isEdit: false });
  };

  // Delete node confirmation
  const handleConfirmDelete = () => {
    if (deleteConfirm.nodeId) {
      deleteNode(deleteConfirm.nodeId);
    }
    setDeleteConfirm({ open: false, nodeId: '', path: '', tag: '' });
  };

  if (!document) {
    return (
      <Paper
        sx={{
          p: 5,
          textAlign: 'center',
          borderRadius: '12px',
          border: `1px dashed ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          No XML Document Loaded
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload an XML file above, or open History to reactivate a synced document.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Top Workspace Toolbar */}
      <Paper
        sx={{
          p: 1.5,
          px: 2,
          borderRadius: '10px',
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        {/* Left: Search filter & Metrics */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: { xs: '100%', sm: 280 } }}>
          <TextField
            size="small"
            placeholder="Filter by path, tag, or value..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                  </InputAdornment>
                ),
                sx: { fontSize: '0.8rem', height: 36, borderRadius: '6px' },
              },
            }}
            sx={{ maxWidth: 360, width: '100%' }}
          />

          <Chip
            size="small"
            label={`${filteredFields.length} fields`}
            variant="outlined"
            sx={{ fontSize: '0.72rem', fontWeight: 600, height: 26 }}
          />

          {/* Table Mode Toggle (if records exist) */}
          {recordGridData && (
            <ButtonGroup size="small" variant="outlined" sx={{ height: 32 }}>
              <Button
                variant={tableMode === 'flat' ? 'contained' : 'outlined'}
                onClick={() => setTableMode('flat')}
                startIcon={<TableRowsIcon sx={{ fontSize: '0.95rem' }} />}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Path Table
              </Button>
              <Button
                variant={tableMode === 'records' ? 'contained' : 'outlined'}
                onClick={() => setTableMode('records')}
                startIcon={<ViewColumnIcon sx={{ fontSize: '0.95rem' }} />}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Record Grid ({recordGridData.records.length} {recordGridData.recordTag}s)
              </Button>
            </ButtonGroup>
          )}
        </Box>

        {/* Right: Layout Switcher & Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Path Format Style Picker */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
              borderRadius: '6px',
              p: 0.25,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{ px: 1, fontWeight: 600, fontSize: '0.7rem', color: theme.palette.text.secondary }}
            >
              Path View:
            </Typography>
            <Tooltip title="Breadcrumb hierarchy style (clean & easy to read in split view)">
              <Button
                size="small"
                variant={pathStyle === 'breadcrumb' ? 'contained' : 'text'}
                color={pathStyle === 'breadcrumb' ? 'primary' : 'inherit'}
                onClick={() => setPathStyle('breadcrumb')}
                sx={{
                  py: 0.2,
                  px: 1,
                  minWidth: 0,
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  borderRadius: '4px',
                  boxShadow: pathStyle === 'breadcrumb' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Hierarchy
              </Button>
            </Tooltip>
            <Tooltip title="Compact path style (... > parent > tag)">
              <Button
                size="small"
                variant={pathStyle === 'compact' ? 'contained' : 'text'}
                color={pathStyle === 'compact' ? 'primary' : 'inherit'}
                onClick={() => setPathStyle('compact')}
                sx={{
                  py: 0.2,
                  px: 1,
                  minWidth: 0,
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  borderRadius: '4px',
                  boxShadow: pathStyle === 'compact' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Compact
              </Button>
            </Tooltip>
            <Tooltip title="Full XPath style (/root/child/...)">
              <Button
                size="small"
                variant={pathStyle === 'full' ? 'contained' : 'text'}
                color={pathStyle === 'full' ? 'primary' : 'inherit'}
                onClick={() => setPathStyle('full')}
                sx={{
                  py: 0.2,
                  px: 1,
                  minWidth: 0,
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  borderRadius: '4px',
                  boxShadow: pathStyle === 'full' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Full XPath
              </Button>
            </Tooltip>
          </Box>

          {/* Split View Customization (Orientation & Ratio) */}
          {layoutMode === 'split' && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
                borderRadius: '6px',
                p: 0.25,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Tooltip title="Side-by-Side Split">
                <IconButton
                  size="small"
                  onClick={() => setSplitOrientation('horizontal')}
                  color={splitOrientation === 'horizontal' ? 'primary' : 'default'}
                  sx={{
                    borderRadius: '4px',
                    p: 0.5,
                    backgroundColor: splitOrientation === 'horizontal' ? theme.palette.background.paper : 'transparent',
                  }}
                >
                  <HorizontalSplitIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Stacked Split (Full screen width for table + full width Raw XML below)">
                <IconButton
                  size="small"
                  onClick={() => setSplitOrientation('vertical')}
                  color={splitOrientation === 'vertical' ? 'primary' : 'default'}
                  sx={{
                    borderRadius: '4px',
                    p: 0.5,
                    backgroundColor: splitOrientation === 'vertical' ? theme.palette.background.paper : 'transparent',
                  }}
                >
                  <VerticalSplitIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
              </Tooltip>

              {splitOrientation === 'horizontal' && (
                <>
                  <Tooltip title="Spacious Table (65% Table / 35% Raw XML)">
                    <Button
                      size="small"
                      variant={splitRatio === '65_35' ? 'contained' : 'text'}
                      color={splitRatio === '65_35' ? 'primary' : 'inherit'}
                      onClick={() => setSplitRatio('65_35')}
                      sx={{
                        py: 0.2,
                        px: 0.8,
                        minWidth: 0,
                        fontSize: '0.68rem',
                        textTransform: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      65/35
                    </Button>
                  </Tooltip>
                  <Tooltip title="Equal Split (50% / 50%)">
                    <Button
                      size="small"
                      variant={splitRatio === '50_50' ? 'contained' : 'text'}
                      color={splitRatio === '50_50' ? 'primary' : 'inherit'}
                      onClick={() => setSplitRatio('50_50')}
                      sx={{
                        py: 0.2,
                        px: 0.8,
                        minWidth: 0,
                        fontSize: '0.68rem',
                        textTransform: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      50/50
                    </Button>
                  </Tooltip>
                </>
              )}
            </Box>
          )}

          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => {
              setNewFieldParentId(document.root.id);
              setAddFieldOpen(true);
            }}
            disabled={!canEdit}
            sx={{ fontSize: '0.75rem', py: 0.6, px: 1.5, borderRadius: '6px', fontWeight: 600 }}
          >
            Add Field
          </Button>

          {/* Layout Mode Selector */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
              borderRadius: '6px',
              p: 0.25,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Tooltip title="Split View: Table + Raw XML on same page">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('split')}
                color={layoutMode === 'split' ? 'primary' : 'default'}
                sx={{
                  borderRadius: '4px',
                  p: 0.6,
                  backgroundColor: layoutMode === 'split' ? theme.palette.background.paper : 'transparent',
                  boxShadow: layoutMode === 'split' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <ViewStreamIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Table Only (Full width)">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('table')}
                color={layoutMode === 'table' ? 'primary' : 'default'}
                sx={{
                  borderRadius: '4px',
                  p: 0.6,
                  backgroundColor: layoutMode === 'table' ? theme.palette.background.paper : 'transparent',
                  boxShadow: layoutMode === 'table' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <TableRowsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Raw XML Only (Full width)">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('raw')}
                color={layoutMode === 'raw' ? 'primary' : 'default'}
                sx={{
                  borderRadius: '4px',
                  p: 0.6,
                  backgroundColor: layoutMode === 'raw' ? theme.palette.background.paper : 'transparent',
                  boxShadow: layoutMode === 'raw' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <CodeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Main Workspace: Side-by-Side or Stacked Split View on Same Page */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg:
              layoutMode !== 'split'
                ? '1fr'
                : splitOrientation === 'vertical'
                ? '1fr'
                : splitRatio === '65_35'
                ? '1.35fr 0.65fr'
                : splitRatio === '75_25'
                ? '1.5fr 0.5fr'
                : '1fr 1fr',
          },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        {/* ========================================================= */}
        {/* PANEL 1: Simplified Table Editor (with Path as Column)    */}
        {/* ========================================================= */}
        {(layoutMode === 'split' || layoutMode === 'table') && (
          <Paper
            sx={{
              borderRadius: '10px',
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            {/* Table Header Bar */}
            <Box
              sx={{
                p: 1.5,
                px: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TableRowsIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {tableMode === 'flat'
                    ? mergeTagAndPath
                      ? 'Fields Table (Element & Hierarchy | Value | Attributes)'
                      : 'Fields Table (Path | Tag | Value | Attributes)'
                    : `Record Grid (${recordGridData?.recordTag} records)`}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tableMode === 'flat' && (
                  <Tooltip title="Combine Tag and Path into a 2-tier column to maximize Value editing width">
                    <Button
                      size="small"
                      variant={mergeTagAndPath ? 'contained' : 'outlined'}
                      color={mergeTagAndPath ? 'primary' : 'inherit'}
                      onClick={() => setMergeTagAndPath(!mergeTagAndPath)}
                      sx={{
                        fontSize: '0.68rem',
                        py: 0.2,
                        px: 1,
                        textTransform: 'none',
                        height: 24,
                        borderRadius: '4px',
                      }}
                    >
                      {mergeTagAndPath ? 'Merged Element & Path' : 'Separate Tag Column'}
                    </Button>
                  </Tooltip>
                )}
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem' }}>
                  Live auto-sync to Raw XML
                </Typography>
              </Box>
            </Box>

            {/* Table View: Mode A - Flat Fields Table */}
            {tableMode === 'flat' && (
              <>
                <TableContainer sx={{ maxHeight: 620, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            width: mergeTagAndPath ? '38%' : '30%',
                            py: 1,
                          }}
                        >
                          {mergeTagAndPath ? 'Element & Hierarchy' : 'Path'}
                        </TableCell>
                        {!mergeTagAndPath && (
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: '14%', py: 1 }}>
                            Tag
                          </TableCell>
                        )}
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            width: mergeTagAndPath ? '42%' : '34%',
                            py: 1,
                          }}
                        >
                          Value (Editable)
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: '12%', py: 1 }}>
                          Attributes
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', width: '8%', py: 1 }}>
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedFields.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={mergeTagAndPath ? 4 : 5}
                            align="center"
                            sx={{ py: 4, color: theme.palette.text.secondary }}
                          >
                            No matching fields found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedFields.map((field) => (
                          <TableRow
                            key={field.id}
                            hover
                            sx={{
                              '&:hover': {
                                backgroundColor:
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.03)'
                                    : 'rgba(0, 0, 0, 0.02)',
                              },
                            }}
                          >
                            {/* Column 1: Path & Hierarchy Breadcrumb */}
                            <TableCell sx={{ py: 0.8, verticalAlign: 'middle' }}>
                              <PathBreadcrumb
                                path={field.path}
                                tagName={field.tag}
                                mode={pathStyle}
                                isSplitView={layoutMode === 'split' && splitOrientation === 'horizontal'}
                              />
                            </TableCell>

                            {/* Column 2: Tag (only if not merged) */}
                            {!mergeTagAndPath && (
                              <TableCell sx={{ py: 0.8, verticalAlign: 'middle' }}>
                                <Chip
                                  size="small"
                                  label={`<${field.tag}>`}
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.72rem',
                                    height: 22,
                                    backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#f1f5f9',
                                    border: `1px solid ${theme.palette.divider}`,
                                  }}
                                />
                              </TableCell>
                            )}

                            {/* Column 3: Value (Directly Editable Cell + Dialog expand) */}
                            <TableCell sx={{ py: 0.6, verticalAlign: 'middle' }}>
                              {field.isLeaf || field.value !== '' ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                                  <Box
                                    component="input"
                                    value={field.value}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      if (canEdit) {
                                        updateNodeText(field.id, e.target.value);
                                      }
                                    }}
                                    disabled={!canEdit}
                                    placeholder="(empty)"
                                    sx={{
                                      flex: 1,
                                      minWidth: 0,
                                      px: 1,
                                      py: 0.5,
                                      fontSize: '0.78rem',
                                      borderRadius: '5px',
                                      border: `1px solid ${theme.palette.divider}`,
                                      backgroundColor:
                                        theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                                      color: theme.palette.text.primary,
                                      fontFamily: 'inherit',
                                      outline: 'none',
                                      transition: 'border-color 0.15s, box-shadow 0.15s',
                                      '&:focus': {
                                        borderColor: theme.palette.primary.main,
                                        boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
                                      },
                                      '&:disabled': {
                                        opacity: 0.6,
                                        cursor: 'not-allowed',
                                      },
                                    }}
                                  />
                                  {canEdit && (
                                    <Tooltip title="Expand & edit in multi-line dialog">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setEditingLargeField(field);
                                          setLargeFieldValue(field.value);
                                        }}
                                        sx={{ p: 0.3, opacity: 0.6, '&:hover': { opacity: 1 } }}
                                      >
                                        <OpenInFullIcon sx={{ fontSize: 13 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              ) : (
                                <Typography
                                  variant="caption"
                                  sx={{ color: theme.palette.text.disabled, fontStyle: 'italic', fontSize: '0.72rem' }}
                                >
                                  (container with {field.childrenCount} children)
                                </Typography>
                              )}
                            </TableCell>

                            {/* Column 4: Attributes */}
                            <TableCell sx={{ py: 0.8, verticalAlign: 'middle' }}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                {field.attributes.map((attr) => (
                                  <Tooltip key={attr.id} title="Click to edit attribute">
                                    <Chip
                                      size="small"
                                      label={`${attr.name}="${attr.value}"`}
                                      onClick={() => {
                                        if (canEdit) {
                                          setAttrDialog({
                                            open: true,
                                            nodeId: field.id,
                                            attrId: attr.id,
                                            name: attr.name,
                                            value: attr.value,
                                            isEdit: true,
                                          });
                                        }
                                      }}
                                      onDelete={
                                        canEdit
                                          ? () => deleteNodeAttribute(field.id, attr.id)
                                          : undefined
                                      }
                                      sx={{
                                        fontSize: '0.68rem',
                                        height: 20,
                                        fontFamily: 'monospace',
                                        cursor: canEdit ? 'pointer' : 'default',
                                        backgroundColor:
                                          theme.palette.mode === 'dark' ? '#1e293b' : '#ede9fe',
                                        color: theme.palette.mode === 'dark' ? '#c4b5fd' : '#6d28d9',
                                        '& .MuiChip-deleteIcon': {
                                          fontSize: 13,
                                        },
                                      }}
                                    />
                                  </Tooltip>
                                ))}
                                {canEdit && (
                                  <Tooltip title="Add attribute">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setAttrDialog({
                                          open: true,
                                          nodeId: field.id,
                                          name: '',
                                          value: '',
                                          isEdit: false,
                                        })
                                      }
                                      sx={{ p: 0.25 }}
                                    >
                                      <AddIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>

                            {/* Column 5: Actions */}
                            <TableCell align="right" sx={{ py: 0.8, verticalAlign: 'middle' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25 }}>
                                {canEdit && (
                                  <>
                                    <Tooltip title="Add child element">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setNewFieldParentId(field.id);
                                          setAddFieldOpen(true);
                                        }}
                                        sx={{ p: 0.5 }}
                                      >
                                        <AddIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    {field.depth > 0 && (
                                      <Tooltip title="Delete element">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() =>
                                            setDeleteConfirm({
                                              open: true,
                                              nodeId: field.id,
                                              path: field.path,
                                              tag: field.tag,
                                            })
                                          }
                                          sx={{ p: 0.5 }}
                                        >
                                          <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredFields.length}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[15, 25, 50, 100]}
                  sx={{
                    borderTop: `1px solid ${theme.palette.divider}`,
                    '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                      fontSize: '0.75rem',
                    },
                  }}
                />
              </>
            )}

            {/* Table View: Mode B - Record Grid (Child paths are columns) */}
            {tableMode === 'records' && recordGridData && (
              <TableContainer sx={{ maxHeight: 620, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: 60, py: 1 }}>
                        #
                      </TableCell>
                      {recordGridData.columns.map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>
                          {col}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', width: 60, py: 1 }}>
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recordGridData.records.map((rec) => (
                      <TableRow key={rec.id} hover>
                        <TableCell sx={{ py: 0.8, fontSize: '0.75rem', fontWeight: 600, color: theme.palette.text.secondary }}>
                          {rec.index}
                        </TableCell>
                        {recordGridData.columns.map((col) => {
                          const cell = rec.fields[col];
                          return (
                            <TableCell key={col} sx={{ py: 0.6 }}>
                              {cell ? (
                                <Box
                                  component="input"
                                  value={cell.value}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    if (canEdit) {
                                      if (cell.isAttr && cell.nodeId && cell.attrId) {
                                        updateNodeAttribute(cell.nodeId, cell.attrId, col.replace('@', ''), e.target.value);
                                      } else if (cell.nodeId) {
                                        updateNodeText(cell.nodeId, e.target.value);
                                      }
                                    }
                                  }}
                                  disabled={!canEdit}
                                  sx={{
                                    width: '100%',
                                    minWidth: 100,
                                    px: 1,
                                    py: 0.4,
                                    fontSize: '0.75rem',
                                    borderRadius: '4px',
                                    border: `1px solid ${theme.palette.divider}`,
                                    backgroundColor:
                                      theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                                    color: theme.palette.text.primary,
                                    outline: 'none',
                                    '&:focus': {
                                      borderColor: theme.palette.primary.main,
                                    },
                                  }}
                                />
                              ) : (
                                <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
                                  —
                                </Typography>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell align="right" sx={{ py: 0.6 }}>
                          {canEdit && (
                            <Tooltip title={`Delete this ${recordGridData.recordTag}`}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setDeleteConfirm({
                                    open: true,
                                    nodeId: rec.id,
                                    path: rec.path,
                                    tag: recordGridData.recordTag,
                                  })
                                }
                                sx={{ p: 0.5 }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* ========================================================= */}
        {/* PANEL 2: Live Raw XML Preview & Editor (On the SAME Page) */}
        {/* ========================================================= */}
        {(layoutMode === 'split' || layoutMode === 'raw') && (
          <Paper
            sx={{
              borderRadius: '10px',
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: theme.palette.mode === 'dark' ? '#0b1120' : '#ffffff',
            }}
          >
            {/* Raw XML Header Bar */}
            <Box
              sx={{
                p: 1.25,
                px: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  Raw XML / Live Preview
                </Typography>
                <Chip
                  size="small"
                  label={isRawDirectEdit ? 'Direct Edit Mode' : 'Live Syncing'}
                  color={isRawDirectEdit ? 'warning' : 'success'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                />
              </Box>

              {/* Raw Action Buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Button
                  size="small"
                  variant={isRawDirectEdit ? 'contained' : 'outlined'}
                  color={isRawDirectEdit ? 'warning' : 'inherit'}
                  onClick={() => setIsRawDirectEdit(!isRawDirectEdit)}
                  startIcon={<EditNoteIcon sx={{ fontSize: '1rem' }} />}
                  sx={{ fontSize: '0.72rem', py: 0.3, px: 1, textTransform: 'none', borderRadius: '5px' }}
                >
                  {isRawDirectEdit ? 'View Formatted' : 'Edit Directly'}
                </Button>

                <Tooltip title="Format / Prettify XML">
                  <IconButton size="small" onClick={handleFormatRawXml} sx={{ p: 0.5 }}>
                    <AutoFixHighIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title={rawCopied ? 'Copied!' : 'Copy XML'}>
                  <IconButton size="small" onClick={handleCopyRawXml} sx={{ p: 0.5 }}>
                    {rawCopied ? (
                      <CheckIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                    ) : (
                      <ContentCopyIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>

                <Tooltip title="Download .xml">
                  <IconButton size="small" onClick={downloadXmlFile} sx={{ p: 0.5 }}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Validation & Sync Alerts */}
            {rawValidationError && (
              <Alert severity="error" sx={{ py: 0.5, px: 2, fontSize: '0.75rem', borderRadius: 0 }}>
                {rawValidationError}
              </Alert>
            )}

            {rawAppliedSuccess && (
              <Alert severity="success" sx={{ py: 0.5, px: 2, fontSize: '0.75rem', borderRadius: 0 }}>
                Changes parsed and applied to table successfully!
              </Alert>
            )}

            {/* Raw XML Body */}
            {isRawDirectEdit ? (
              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                <Box
                  component="textarea"
                  value={rawTextValue}
                  onChange={handleRawTextChange}
                  disabled={!canEdit}
                  spellCheck={false}
                  sx={{
                    width: '100%',
                    height: 520,
                    p: 1.5,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.78rem',
                    lineHeight: 1.6,
                    borderRadius: '6px',
                    border: `1px solid ${rawValidationError ? theme.palette.error.main : theme.palette.divider}`,
                    backgroundColor: theme.palette.mode === 'dark' ? '#030712' : '#f8fafc',
                    color: theme.palette.text.primary,
                    outline: 'none',
                    resize: 'vertical',
                    '&:focus': {
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                />
                {canEdit && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<SyncIcon fontSize="small" />}
                    onClick={handleApplyRawChanges}
                    disabled={!!rawValidationError || rawTextValue === rawXml}
                    sx={{ alignSelf: 'flex-end', fontSize: '0.75rem', py: 0.6, px: 2, borderRadius: '6px' }}
                  >
                    Apply to Table & Document
                  </Button>
                )}
              </Box>
            ) : (
              /* Syntax-Highlighted Live Preview */
              <Box
                sx={{
                  p: 2,
                  maxHeight: 620,
                  overflow: 'auto',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.78rem',
                  lineHeight: 1.65,
                  backgroundColor: theme.palette.mode === 'dark' ? '#030712' : '#fafafa',
                  color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#1e293b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {rawXml.split('\n').map((line, idx) => {
                  return (
                    <Box key={idx} sx={{ display: 'flex', gap: 2 }}>
                      <Box
                        component="span"
                        sx={{
                          width: 34,
                          flexShrink: 0,
                          textAlign: 'right',
                          userSelect: 'none',
                          color: theme.palette.text.disabled,
                          fontSize: '0.7rem',
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          flex: 1,
                          color: line.includes('<?xml')
                            ? '#a855f7'
                            : line.trim().startsWith('<!--')
                            ? '#64748b'
                            : theme.palette.mode === 'dark'
                            ? '#e2e8f0'
                            : '#1e293b',
                        }}
                      >
                        {line}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* ========================================================= */}
      {/* DIALOG 1: Add New Field                                   */}
      {/* ========================================================= */}
      <Dialog open={addFieldOpen} onClose={() => setAddFieldOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Add XML Field</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Tag Name"
            size="small"
            fullWidth
            required
            placeholder="e.g. price, author, title"
            value={newFieldTag}
            onChange={(e) => setNewFieldTag(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
            autoFocus
          />

          <TextField
            label="Text Value"
            size="small"
            fullWidth
            placeholder="Initial field value (optional)"
            value={newFieldValue}
            onChange={(e) => setNewFieldValue(e.target.value)}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Parent Element</InputLabel>
            <Select
              value={newFieldParentId}
              label="Parent Element"
              onChange={(e) => setNewFieldParentId(e.target.value)}
            >
              {flatFields
                .filter((f) => !f.isLeaf || f.depth === 0)
                .map((f) => (
                  <MenuItem key={f.id} value={f.id} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {f.path} ({`<${f.tag}>`})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button size="small" onClick={() => setAddFieldOpen(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleConfirmAddField}
            disabled={!newFieldTag.trim()}
          >
            Add Field
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 2: Add / Edit Attribute                            */}
      {/* ========================================================= */}
      <Dialog
        open={attrDialog.open}
        onClose={() => setAttrDialog({ open: false, nodeId: '', name: '', value: '', isEdit: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {attrDialog.isEdit ? 'Edit Attribute' : 'Add Attribute'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Attribute Name"
            size="small"
            fullWidth
            required
            placeholder="e.g. id, type, currency"
            value={attrDialog.name}
            onChange={(e) =>
              setAttrDialog((prev) => ({ ...prev, name: e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '') }))
            }
            autoFocus
          />
          <TextField
            label="Attribute Value"
            size="small"
            fullWidth
            placeholder="e.g. bk101, USD"
            value={attrDialog.value}
            onChange={(e) => setAttrDialog((prev) => ({ ...prev, value: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            size="small"
            onClick={() =>
              setAttrDialog({ open: false, nodeId: '', name: '', value: '', isEdit: false })
            }
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSaveAttribute}
            disabled={!attrDialog.name.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 3: Delete Confirmation                             */}
      {/* ========================================================= */}
      <Dialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, nodeId: '', path: '', tag: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to delete this element and all of its child fields?
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
          >
            Path: {deleteConfirm.path}
            <br />
            Tag: &lt;{deleteConfirm.tag}&gt;
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            size="small"
            onClick={() => setDeleteConfirm({ open: false, nodeId: '', path: '', tag: '' })}
          >
            Cancel
          </Button>
          <Button size="small" variant="contained" color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG 4: Edit Large / Multi-line Value                   */}
      {/* ========================================================= */}
      <Dialog
        open={Boolean(editingLargeField)}
        onClose={() => setEditingLargeField(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <OpenInFullIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          Edit Field Value
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {editingLargeField && (
            <Paper
              variant="outlined"
              sx={{
                p: 1.2,
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Target Element:
              </Typography>
              <PathBreadcrumb path={editingLargeField.path} tagName={editingLargeField.tag} mode="breadcrumb" />
            </Paper>
          )}
          <TextField
            label="Field Value"
            multiline
            minRows={5}
            maxRows={12}
            fullWidth
            value={largeFieldValue}
            onChange={(e) => setLargeFieldValue(e.target.value)}
            disabled={!canEdit}
            placeholder="Enter or paste full text value..."
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem' }}>
              {largeFieldValue.length} characters | {largeFieldValue.split('\n').length} lines
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem' }}>
              Changes sync directly to XML
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button size="small" onClick={() => setEditingLargeField(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!canEdit}
            onClick={() => {
              if (editingLargeField) {
                updateNodeText(editingLargeField.id, largeFieldValue);
                setEditingLargeField(null);
              }
            }}
          >
            Apply Value
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
