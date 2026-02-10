import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles } from 'lucide-react';
import { ChatMessage, UploadedFile } from '../types';
import { Button } from './ui/Button';
import { chatWithPaper } from '../services/gemini';
import { TextToSpeechButton } from './ui/TextToSpeechButton';

interface ChatInterfaceProps {
  file: UploadedFile;
  initialHistory?: ChatMessage[];
  onUpdateHistory: (history: ChatMessage[]) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ file, initialHistory, onUpdateHistory }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory && initialHistory.length > 0 ? initialHistory : [
    {
      id: 'welcome',
      role: 'model',
      text: "Je connais le contenu de cet article par cœur. Posez-moi une question !",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync with parent when messages change
  useEffect(() => {
      // Avoid syncing on initial mount if we just loaded the props
      if (messages !== initialHistory) {
          onUpdateHistory(messages);
      }
  }, [messages, onUpdateHistory, initialHistory]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await chatWithPaper(messages, userMsg.text, file);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Désolé, j'ai rencontré une erreur en essayant de répondre.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-science-600" />
        <h3 className="font-semibold text-slate-700">Discuter avec l'Article</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-science-100 text-science-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
            </div>
            
            <div className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-slate-800 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {msg.text}
              
              {/* TTS Button positioned absolute next to bubble */}
              <div className={`absolute top-1 ${msg.role === 'user' ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                 <TextToSpeechButton text={msg.text} size={14} />
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-science-100 text-science-600 flex items-center justify-center shrink-0">
               <Sparkles size={16} />
             </div>
             <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3">
               <div className="flex space-x-2">
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-science-500 focus:outline-none"
            placeholder="Posez une question sur l'article..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()} 
            className="px-3"
          >
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};