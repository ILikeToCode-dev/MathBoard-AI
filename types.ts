export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingPath {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser' | 'highlighter' | 'rectangle' | 'circle' | 'line';
  isFilled?: boolean; // For shapes
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  attachments?: {
    mimeType: string;
    data: string; // base64
  }[];
}

export type FileType = 'folder' | 'note';

export interface FileSystemNode {
  id: string;
  parentId: string | null;
  name: string;
  type: FileType;
  children?: string[]; // IDs of children
  createdAt: number;
  updatedAt: number;
}

export interface NoteContent {
  id: string; // Matches the FileSystemNode id
  messages: ChatMessage[];
  paths: DrawingPath[];
  viewport: { x: number; y: number; scale: number };
}

export interface AppState {
  fileSystem: Record<string, FileSystemNode>;
  notes: Record<string, NoteContent>;
  activeNoteId: string | null;
  expandedFolders: string[];
  darkMode: boolean;
}