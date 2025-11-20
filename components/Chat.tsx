import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendMessageToTutor } from '../services/gemini';
import { Send, Image as ImageIcon, Loader2, User, Bot } from 'lucide-react';

interface ChatProps {
  messages: ChatMessage[];
  setMessages: (msgs: ChatMessage[]) => void;
  pendingAttachment?: string | null; // base64 data url
  onClearPendingAttachment?: () => void;
}

const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const renderText = () => {
      const katex = (window as any).katex;
      const marked = (window as any).marked;
      
      // If libraries aren't loaded yet, just show plain text
      if (!katex || !marked) {
        contentRef.current!.innerText = text;
        return;
      }

      // Strategy: Identify math blocks, replace with unique placeholders, 
      // parse Markdown, then restore placeholders with rendered math HTML.
      // This avoids conflicts where Markdown tries to parse math symbols (e.g., *, _).

      const mathMap = new Map<string, string>();
      
      // Helper to render and store math
      const processMath = (equation: string, displayMode: boolean) => {
        const id = `MATH_PLACEHOLDER_${Math.random().toString(36).slice(2, 11)}`;
        try {
          const html = katex.renderToString(equation, { 
            displayMode, 
            throwOnError: false,
            output: 'html' // generate html output
          });
          mathMap.set(id, html);
          return id;
        } catch (e) {
          console.error("KaTeX Render Error", e);
          return equation; // Fallback to raw text
        }
      };

      // 1. Process Block Math: $$...$$
      let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, equation) => {
        return processMath(equation, true);
      });

      // 2. Process Inline Math: $...$
      processed = processed.replace(/\$([^$\n]+?)\$/g, (match, equation) => {
        return processMath(equation, false);
      });

      // 3. Process Block LaTeX: \[...\]
      processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, equation) => {
        return processMath(equation, true);
      });

      // 4. Process Inline LaTeX: \(...\)
      processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, equation) => {
        return processMath(equation, false);
      });

      // 5. Parse Markdown
      let html = "";
      try {
         html = marked.parse(processed) as string;
      } catch (e) {
         html = processed;
      }

      // 6. Restore Math Placeholders
      mathMap.forEach((renderedHtml, id) => {
        html = html.replace(new RegExp(id, 'g'), renderedHtml);
      });

      contentRef.current!.innerHTML = html;
    };

    if ((window as any).katex && (window as any).marked) {
      renderText();
    } else {
      const timer = setTimeout(renderText, 200);
      return () => clearTimeout(timer);
    }

  }, [text]);

  return <div ref={contentRef} className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words" />;
};

const Chat: React.FC<ChatProps> = ({ messages, setMessages, pendingAttachment, onClearPendingAttachment }) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{ mimeType: string; data: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle incoming pending attachments from Whiteboard
  useEffect(() => {
    if (pendingAttachment) {
        const base64Data = pendingAttachment.split(',')[1];
        setAttachment({
            mimeType: 'image/png',
            data: base64Data
        });
        setInput("Please analyze this selected area and help me solve it.");
        onClearPendingAttachment?.();
        // Focus the input so user can just hit enter
        inputRef.current?.focus();
    }
  }, [pendingAttachment, onClearPendingAttachment]);

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
      attachments: attachment ? [attachment] : undefined
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    const currentAttachment = attachment;
    setAttachment(null); // Clear immediately
    setIsLoading(true);

    try {
      const aiResponseText = await sendMessageToTutor(updatedMessages, userMsg.text, currentAttachment);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText,
        timestamp: Date.now()
      };

      setMessages([...updatedMessages, aiMsg]);
    } catch (error) {
      console.error("Chat Error", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      setAttachment({
        mimeType: file.type,
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Bot className="text-indigo-500" /> AI Tutor
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Gemini 2.5 • Step-by-Step Learning</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            <Bot size={48} className="mx-auto mb-2 opacity-20" />
            <p>Start a conversation to learn math!</p>
            <p className="text-sm">Ask about algebra, geometry, or use the <b>Scan</b> tool on the whiteboard.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
            }`}>
              {msg.attachments && msg.attachments.map((att, idx) => (
                <img 
                  key={idx} 
                  src={`data:${att.mimeType};base64,${att.data}`} 
                  alt="User upload" 
                  className="max-w-full h-auto rounded-md mb-2 border border-white/20"
                />
              ))}
              <MessageContent text={msg.text} />
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex justify-start">
             <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 flex items-center gap-2 text-slate-500">
               <Loader2 className="animate-spin" size={16} /> Thinking...
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        {attachment && (
             <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded">
                <ImageIcon size={12} /> Image attached 
                <button onClick={() => setAttachment(null)} className="text-red-500 hover:underline ml-auto">Remove</button>
             </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-indigo-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Upload Image"
          >
            <ImageIcon size={20} />
          </button>
          
          <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask a math question..."
                className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 resize-none max-h-32"
                rows={1}
              />
          </div>
          
          <button 
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !attachment)}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;