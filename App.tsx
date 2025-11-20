import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Whiteboard from './components/Whiteboard';
import { AppState, FileSystemNode, NoteContent, ChatMessage, DrawingPath } from './types';

// Initial Data
const INITIAL_ROOT_ID = 'root-folder';
const INITIAL_NOTE_ID = 'welcome-note';

const initialFileSystem: Record<string, FileSystemNode> = {
  [INITIAL_ROOT_ID]: {
    id: INITIAL_ROOT_ID,
    parentId: null,
    name: 'My Notes',
    type: 'folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  [INITIAL_NOTE_ID]: {
    id: INITIAL_NOTE_ID,
    parentId: INITIAL_ROOT_ID,
    name: 'Welcome to MathBoard',
    type: 'note',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
};

const initialNoteContent: NoteContent = {
  id: INITIAL_NOTE_ID,
  messages: [
    { id: '1', role: 'model', text: 'Hello! I am your AI Math Tutor. Use the whiteboard on the right to draw problems, and ask me questions here. I can help with everything from basic arithmetic to calculus!', timestamp: Date.now() }
  ],
  paths: [],
  viewport: { x: 0, y: 0, scale: 1 }
};

const App: React.FC = () => {
  // -- State --
  const [fileSystem, setFileSystem] = useState<Record<string, FileSystemNode>>(initialFileSystem);
  const [notes, setNotes] = useState<Record<string, NoteContent>>({ [INITIAL_NOTE_ID]: initialNoteContent });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(INITIAL_NOTE_ID);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([INITIAL_ROOT_ID]);
  const [darkMode, setDarkMode] = useState(false);
  
  // State to bridge Whiteboard selection to Chat
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // -- Effects --

  // Load from LocalStorage on Mount
  useEffect(() => {
    const savedState = localStorage.getItem('mathboard_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setFileSystem(parsed.fileSystem || initialFileSystem);
        setNotes(parsed.notes || { [INITIAL_NOTE_ID]: initialNoteContent });
        setActiveNoteId(parsed.activeNoteId || INITIAL_NOTE_ID);
        setExpandedFolders(parsed.expandedFolders || [INITIAL_ROOT_ID]);
        setDarkMode(parsed.darkMode || false);
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  // Auto-Save to LocalStorage
  useEffect(() => {
    const timeout = setTimeout(() => {
      const stateToSave = {
        fileSystem,
        notes,
        activeNoteId,
        expandedFolders,
        darkMode
      };
      localStorage.setItem('mathboard_state', JSON.stringify(stateToSave));
    }, 2000); // Save every 2 seconds of inactivity

    return () => clearTimeout(timeout);
  }, [fileSystem, notes, activeNoteId, expandedFolders, darkMode]);

  // Dark Mode Class Toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // -- Handlers --

  const handleCreateNode = (type: 'folder' | 'note', parentId: string | null) => {
    const pid = parentId || INITIAL_ROOT_ID; // Default to root if null
    const id = Date.now().toString();
    const newNode: FileSystemNode = {
      id,
      parentId: pid,
      name: type === 'folder' ? 'New Folder' : 'New Note',
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setFileSystem(prev => ({ ...prev, [id]: newNode }));

    if (type === 'note') {
      setNotes(prev => ({
        ...prev,
        [id]: {
          id,
          messages: [],
          paths: [],
          viewport: { x: 0, y: 0, scale: 1 }
        }
      }));
      setActiveNoteId(id);
    } else {
        setExpandedFolders(prev => [...prev, id]);
    }
  };

  const handleDeleteNode = (id: string) => {
    if (id === INITIAL_ROOT_ID) return; // Prevent deleting root
    
    const node = fileSystem[id];
    if (!node) return;

    if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
       const newFS = { ...fileSystem };
       const newNotes = { ...notes };
       
       // Recursive delete function
       const deleteRecursive = (nodeId: string) => {
           // Find children
           (Object.values(newFS) as FileSystemNode[]).forEach(n => {
               if (n.parentId === nodeId) deleteRecursive(n.id);
           });
           delete newFS[nodeId];
           if (newNotes[nodeId]) delete newNotes[nodeId];
       };

       deleteRecursive(id);
       setFileSystem(newFS);
       setNotes(newNotes);
       if (activeNoteId === id) setActiveNoteId(null);
    }
  };

  const handleToggleFolder = (id: string) => {
    setExpandedFolders(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  // Note Content Updaters
  const updateActiveNotePaths = useCallback((paths: DrawingPath[]) => {
    if (!activeNoteId) return;
    setNotes(prev => ({
        ...prev,
        [activeNoteId]: { ...prev[activeNoteId], paths }
    }));
  }, [activeNoteId]);

  const updateActiveNoteViewport = useCallback((viewport: {x:number, y:number, scale:number}) => {
    if (!activeNoteId) return;
    setNotes(prev => ({
        ...prev,
        [activeNoteId]: { ...prev[activeNoteId], viewport }
    }));
  }, [activeNoteId]);

  const updateActiveNoteMessages = useCallback((messages: ChatMessage[]) => {
    if (!activeNoteId) return;
    setNotes(prev => ({
        ...prev,
        [activeNoteId]: { ...prev[activeNoteId], messages }
    }));
  }, [activeNoteId]);

  const handleWhiteboardCapture = (imageDataUrl: string) => {
      setCapturedImage(imageDataUrl);
  };


  // -- Render --
  const activeNote = activeNoteId ? notes[activeNoteId] : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar (15% approx, fixed width usually better) */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
        <Sidebar 
          fileSystem={fileSystem}
          activeNoteId={activeNoteId}
          expandedFolders={expandedFolders}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          onSelectNote={setActiveNoteId}
          onToggleFolder={handleToggleFolder}
          onCreateNode={handleCreateNode}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {!activeNoteId ? (
            <div className="flex-1 flex items-center justify-center flex-col text-slate-400">
                <p className="text-xl font-semibold mb-2">No Note Selected</p>
                <p className="text-sm">Select a note from the sidebar or create a new one.</p>
            </div>
        ) : (
            <>
                {/* Chat Interface (40%) */}
                <div className="w-[40%] h-full flex flex-col border-r border-slate-200 dark:border-slate-800 z-10 shadow-xl">
                    {activeNote && (
                        <Chat 
                            messages={activeNote.messages} 
                            setMessages={updateActiveNoteMessages}
                            pendingAttachment={capturedImage}
                            onClearPendingAttachment={() => setCapturedImage(null)}
                        />
                    )}
                </div>

                {/* Whiteboard (60%) */}
                <div className="w-[60%] h-full relative bg-white dark:bg-slate-900">
                     {activeNote && (
                        <Whiteboard 
                            paths={activeNote.paths}
                            setPaths={updateActiveNotePaths}
                            viewport={activeNote.viewport}
                            setViewport={updateActiveNoteViewport}
                            onCapture={handleWhiteboardCapture}
                        />
                     )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default App;