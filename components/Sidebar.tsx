import React, { useState } from 'react';
import { FileSystemNode } from '../types';
import { Folder, FileText, ChevronRight, ChevronDown, Plus, Trash2, Moon, Sun, Edit2, FolderPlus, FilePlus } from 'lucide-react';

interface SidebarProps {
  fileSystem: Record<string, FileSystemNode>;
  activeNoteId: string | null;
  expandedFolders: string[];
  darkMode: boolean;
  toggleDarkMode: () => void;
  onSelectNote: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onCreateNode: (type: 'folder' | 'note', parentId: string) => void;
  onDeleteNode: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  fileSystem,
  activeNoteId,
  expandedFolders,
  darkMode,
  toggleDarkMode,
  onSelectNote,
  onToggleFolder,
  onCreateNode,
  onDeleteNode,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  // Simple recursive renderer
  const renderTree = (parentId: string | null, depth = 0) => {
    const nodes = (Object.values(fileSystem) as FileSystemNode[])
      .filter(node => node.parentId === parentId)
      .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1); // Folders first

    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className={`
            flex items-center gap-2 px-4 py-2 cursor-pointer text-sm transition-colors
            ${activeNoteId === node.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium border-r-4 border-indigo-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
          `}
          style={{ paddingLeft: `${depth * 16 + 16}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              onToggleFolder(node.id);
            } else {
              onSelectNote(node.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, id: node.id });
          }}
        >
          {node.type === 'folder' && (
            <span className="text-slate-400">
              {expandedFolders.includes(node.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {node.type === 'folder' ? <Folder size={16} className="text-amber-400" /> : <FileText size={16} className="text-blue-400" />}
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'folder' && expandedFolders.includes(node.id) && renderTree(node.id, depth + 1)}
      </div>
    ));
  };

  // Root folders (parentId: null)
  // We usually have a root folder "My Notes" conceptually, but let's allow root level items
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800" onClick={() => setContextMenu(null)}>
      {/* App Brand */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">
          MathBoard
        </div>
        <button 
            onClick={toggleDarkMode} 
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2">
         {renderTree(null)}
         
         {/* Empty State hint */}
         {Object.keys(fileSystem).length === 0 && (
             <div className="p-4 text-center text-sm text-slate-400">
                 No notes yet. Create one!
             </div>
         )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
        <button 
          onClick={() => onCreateNode('folder', null as any)} // Simplified: Create at root if no selection logic
          className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
        >
          <FolderPlus size={14} /> New Folder
        </button>
        <button 
          onClick={() => onCreateNode('note', null as any)} 
          className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-medium transition-colors shadow-md shadow-indigo-200 dark:shadow-none"
        >
          <FilePlus size={14} /> New Note
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
            className="fixed z-50 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 py-1 w-48"
            style={{ top: contextMenu.y, left: contextMenu.x }}
        >
            {fileSystem[contextMenu.id]?.type === 'folder' && (
                <>
                    <button 
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        onClick={(e) => { e.stopPropagation(); onCreateNode('note', contextMenu.id); setContextMenu(null); }}
                    >
                        <FilePlus size={14} /> New Note Inside
                    </button>
                    <button 
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        onClick={(e) => { e.stopPropagation(); onCreateNode('folder', contextMenu.id); setContextMenu(null); }}
                    >
                        <FolderPlus size={14} /> New Folder Inside
                    </button>
                     <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                </>
            )}
            
            <button 
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); onDeleteNode(contextMenu.id); setContextMenu(null); }}
            >
                <Trash2 size={14} /> Delete
            </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;