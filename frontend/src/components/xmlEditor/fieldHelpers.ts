import { XmlNode } from '../../types';
import { FlatFieldRow } from './types';

export function flattenFields(root: XmlNode | undefined): FlatFieldRow[] {
  if (!root) return [];
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

  traverse(root, 0);
  return list;
}

export function filterFields(fields: FlatFieldRow[], searchQuery: string): FlatFieldRow[] {
  if (!searchQuery.trim()) return fields;
  const q = searchQuery.toLowerCase();
  return fields.filter(
    (f) =>
      f.path.toLowerCase().includes(q) ||
      f.tag.toLowerCase().includes(q) ||
      f.value.toLowerCase().includes(q) ||
      f.attributes.some((a) => a.name.toLowerCase().includes(q) || a.value.toLowerCase().includes(q))
  );
}

export interface RecordGridCell {
  value: string;
  nodeId?: string;
  attrId?: string;
  isAttr?: boolean;
}

export interface RecordGridData {
  parentPath: string;
  recordTag: string;
  columns: string[];
  records: {
    id: string;
    path: string;
    index: number;
    fields: Record<string, RecordGridCell>;
  }[];
}

export function buildRecordGrid(root: XmlNode | undefined): RecordGridData | null {
  if (!root) return null;

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
      const rowData: Record<string, RecordGridCell> = {};
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
}
