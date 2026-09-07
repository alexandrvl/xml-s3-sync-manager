import React, { useEffect, useState } from 'react';
import { SxProps, Theme } from '@mui/material/styles';
import { Box } from '@mui/material';

interface EditableCellProps {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  sx?: SxProps<Theme>;
}

export const EditableCell: React.FC<EditableCellProps> = ({ value, disabled, onCommit, sx }) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Box
      component="input"
      value={draft}
      disabled={disabled}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={() => {
        if (!disabled && draft !== value) {
          onCommit(draft);
        }
      }}
      sx={sx}
    />
  );
};
