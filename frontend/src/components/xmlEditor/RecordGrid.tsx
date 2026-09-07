import React from 'react';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { EditableCell } from './EditableCell';
import { RecordGridData } from './fieldHelpers';

interface RecordGridProps {
  data: RecordGridData;
  canEdit: boolean;
  onUpdateText: (nodeId: string, value: string) => void;
  onUpdateAttribute: (nodeId: string, attrId: string, name: string, value: string) => void;
  onDelete: (nodeId: string, path: string, tag: string) => void;
}

export const RecordGrid: React.FC<RecordGridProps> = ({
  data,
  canEdit,
  onUpdateText,
  onUpdateAttribute,
  onDelete,
}) => {
  const theme = useTheme();
  return (
    <TableContainer sx={{ maxHeight: 620, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: 60, py: 1 }}>#</TableCell>
            {data.columns.map((col) => (
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
          {data.records.map((rec) => (
            <TableRow key={rec.id} hover>
              <TableCell sx={{ py: 0.8, fontSize: '0.75rem', fontWeight: 600, color: theme.palette.text.secondary }}>
                {rec.index}
              </TableCell>
              {data.columns.map((col) => {
                const cell = rec.fields[col];
                return (
                  <TableCell key={col} sx={{ py: 0.6 }}>
                    {cell ? (
                      <EditableCell
                        value={cell.value}
                        disabled={!canEdit}
                        onCommit={(next) => {
                          if (cell.isAttr && cell.nodeId && cell.attrId) {
                            onUpdateAttribute(cell.nodeId, cell.attrId, col.replace('@', ''), next);
                          } else if (cell.nodeId) {
                            onUpdateText(cell.nodeId, next);
                          }
                        }}
                        sx={{
                          width: '100%',
                          minWidth: 100,
                          px: 1,
                          py: 0.4,
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: `1px solid ${theme.palette.divider}`,
                          backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
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
                  <Tooltip title={`Delete this ${data.recordTag}`}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(rec.id, rec.path, data.recordTag)}
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
  );
};
