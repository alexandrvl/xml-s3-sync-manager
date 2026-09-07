import { XmlAttribute } from '../../types';

export interface FlatFieldRow {
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
