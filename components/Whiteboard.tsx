import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingPath, Point } from '../types';
import { Undo, Eraser, Pen, MousePointer, ZoomIn, ZoomOut, Trash2, Square, Circle, Minus } from 'lucide-react';

interface WhiteboardProps {
  paths: DrawingPath[];
  setPaths: (paths: DrawingPath[]) => void;
  viewport: { x: number; y: number; scale: number };
  setViewport: (viewport: { x: number; y: number; scale: number }) => void;
  readOnly?: boolean;
}

type Tool = 'pen' | 'eraser' | 'highlighter' | 'pan' | 'rectangle' | 'circle' | 'line';

const Whiteboard: React.FC<WhiteboardProps> = ({ paths, setPaths, viewport, setViewport, readOnly = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);

  const handleUndo = () => {
    if (paths.length > 0) {
      const newPaths = [...paths];
      newPaths.pop();
      setPaths(newPaths);
    }
  };

  const handleClear = () => {
    if (window.confirm("Clear whiteboard?")) {
      setPaths([]);
    }
  };

  // Drawing Logic
  const getCanvasPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - viewport.x) / viewport.scale,
      y: (e.clientY - rect.top - viewport.y) / viewport.scale,
      pressure: e.pressure,
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (currentTool === 'pan') return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const point = getCanvasPoint(e);

    setCurrentPath({
      id: Date.now().toString(),
      points: [point],
      color: currentTool === 'eraser' ? '#ffffff' : (currentTool === 'highlighter' ? color + '50' : color), // Simple hack for highlighter transparency
      width: currentTool === 'eraser' ? 20 : (currentTool === 'highlighter' ? 15 : width),
      tool: currentTool as any,
    });
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !currentPath) {
      // Panning logic
      if (currentTool === 'pan' && e.buttons === 1) {
         setViewport({
           ...viewport,
           x: viewport.x + e.movementX,
           y: viewport.y + e.movementY
         });
      }
      return;
    }

    const point = getCanvasPoint(e);
    
    if (['pen', 'eraser', 'highlighter'].includes(currentTool)) {
        setCurrentPath(prev => prev ? ({
            ...prev,
            points: [...prev.points, point]
        }) : null);
    } else {
        setCurrentPath(prev => {
            if (!prev) return null;
            return {
                ...prev,
                points: [prev.points[0], point]
            };
        });
    }
  };

  const stopDrawing = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (currentPath) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
    }
  };

  // Zoom Logic
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // e.deltaY < 0 means scrolling up (pushing away) -> Zoom In
    // e.deltaY > 0 means scrolling down (pulling close) -> Zoom Out
    
    // Normalize delta roughly
    const zoomIntensity = 0.1;
    const direction = -Math.sign(e.deltaY); 
    const delta = direction * zoomIntensity;

    // Limits
    const newScale = Math.min(Math.max(0.1, viewport.scale * (1 + delta)), 5);
    
    // Zoom focused on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - viewport.x) / viewport.scale;
    const worldY = (mouseY - viewport.y) / viewport.scale;
    
    const newX = mouseX - worldX * newScale;
    const newY = mouseY - worldY * newScale;
    
    setViewport({ x: newX, y: newY, scale: newScale });
  }, [viewport, setViewport]);

  const manualZoom = (delta: number) => {
    const newScale = Math.min(Math.max(0.1, viewport.scale + delta), 5);
    // Zoom focused on center of screen
    const canvas = canvasRef.current;
    if (canvas) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const worldX = (centerX - viewport.x) / viewport.scale;
        const worldY = (centerY - viewport.y) / viewport.scale;
        const newX = centerX - worldX * newScale;
        const newY = centerY - worldY * newScale;
        setViewport({ x: newX, y: newY, scale: newScale });
    } else {
         setViewport({ ...viewport, scale: newScale });
    }
  };
  
  const handleSliderZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newScale = parseFloat(e.target.value);
      // Zoom focused on center
      const canvas = canvasRef.current;
      if (canvas) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const worldX = (centerX - viewport.x) / viewport.scale;
        const worldY = (centerY - viewport.y) / viewport.scale;
        const newX = centerX - worldX * newScale;
        const newY = centerY - worldY * newScale;
        setViewport({ x: newX, y: newY, scale: newScale });
      } else {
        setViewport({ ...viewport, scale: newScale });
      }
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Background
    drawGrid(ctx, canvas.width, canvas.height, viewport);

    // Apply Transform
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);

    // Draw paths
    [...paths, currentPath].forEach(path => {
      if (!path) return;
      drawPath(ctx, path);
    });

    ctx.restore();

  }, [paths, currentPath, viewport, isDrawing]);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, vp: {x:number, y:number, scale:number}) => {
      const gridSize = 40 * vp.scale;
      const offsetX = vp.x % gridSize;
      const offsetY = vp.y % gridSize;

      ctx.beginPath();
      ctx.strokeStyle = '#e2e8f0'; // Light grid color
      ctx.lineWidth = 1;

      // If grid gets too dense, fade it out or double size
      if (gridSize < 10) ctx.globalAlpha = 0.2;
      else ctx.globalAlpha = 1;

      for (let x = offsetX; x < w; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
      }
      for (let y = offsetY; y < h; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
  };

  const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length < 1) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.width;

    if (path.tool === 'pen' || path.tool === 'eraser' || path.tool === 'highlighter') {
        if (path.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'; 
            ctx.strokeStyle = '#ffffff'; 
        } else {
             ctx.globalCompositeOperation = 'source-over';
        }

        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    } else if (['rectangle', 'circle', 'line'].includes(path.tool)) {
        const start = path.points[0];
        const end = path.points[path.points.length - 1];
        
        if (path.tool === 'line') {
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        } else if (path.tool === 'rectangle') {
            ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (path.tool === 'circle') {
            const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            ctx.beginPath();
            ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }
  };

  return (
    <div 
        className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900" 
        onWheel={handleWheel}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 z-10 border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-[95%]">
        <button onClick={() => setCurrentTool('pan')} className={`p-2 rounded-full shrink-0 ${currentTool === 'pan' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Pan">
           <MousePointer size={20} />
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>
        <button onClick={() => setCurrentTool('pen')} className={`p-2 rounded-full shrink-0 ${currentTool === 'pen' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Pen">
           <Pen size={20} />
        </button>
        <button onClick={() => setCurrentTool('highlighter')} className={`p-2 rounded-full shrink-0 ${currentTool === 'highlighter' ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Highlighter">
           <Pen size={20} className="opacity-50" />
        </button>
        <button onClick={() => setCurrentTool('eraser')} className={`p-2 rounded-full shrink-0 ${currentTool === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Eraser">
           <Eraser size={20} />
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>
        <button onClick={() => setCurrentTool('rectangle')} className={`p-2 rounded-full shrink-0 ${currentTool === 'rectangle' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
           <Square size={20} />
        </button>
         <button onClick={() => setCurrentTool('circle')} className={`p-2 rounded-full shrink-0 ${currentTool === 'circle' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
           <Circle size={20} />
        </button>
         <button onClick={() => setCurrentTool('line')} className={`p-2 rounded-full shrink-0 ${currentTool === 'line' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
           <Minus size={20} className="transform -rotate-45" />
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0"></div>
        <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded-full overflow-hidden border-0 p-0 cursor-pointer shrink-0"
        />
        <input 
            type="range" 
            min="1" max="20" 
            value={width} 
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-20 accent-indigo-600 shrink-0"
            title="Brush Size"
        />
      </div>

      {/* Action Bar */}
      <div className="absolute bottom-4 right-4 flex gap-2 items-center pointer-events-none z-10">
         <div className="flex gap-2 pointer-events-auto">
            <button onClick={handleUndo} className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Undo">
                <Undo size={20} />
            </button>
            <button onClick={handleClear} className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 border border-slate-200 dark:border-slate-700" title="Clear Board">
                <Trash2 size={20} />
            </button>
            
            {/* Zoom Controls */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-md flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                 <button onClick={() => manualZoom(-0.25)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300">
                    <ZoomOut size={20} />
                 </button>
                 
                 <div className="flex items-center gap-1 w-24 justify-center">
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-8 text-right">{Math.round(viewport.scale * 100)}%</span>
                    <input 
                        type="range" 
                        min="0.1" 
                        max="5" 
                        step="0.1" 
                        value={viewport.scale} 
                        onChange={handleSliderZoom}
                        className="w-12 h-1 accent-indigo-600 cursor-pointer"
                    />
                 </div>

                 <button onClick={() => manualZoom(0.25)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300">
                    <ZoomIn size={20} />
                 </button>
            </div>
         </div>
      </div>

      <canvas 
        ref={canvasRef}
        className="touch-none cursor-crosshair w-full h-full"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </div>
  );
};

export default Whiteboard;