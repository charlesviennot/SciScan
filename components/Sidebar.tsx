import React from 'react';
import { HistoryItem } from '../types';
import { FileText, Clock, Trash2, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from './ui/Button';

interface SidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  currentId?: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  history, 
  onSelect, 
  onDelete, 
  currentId,
  isOpen,
  setIsOpen
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`fixed left-0 top-16 bottom-0 w-72 bg-white border-r border-slate-200 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 overflow-y-auto`}
      >
        <div className="p-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock size={14} /> Historique
          </h2>
          
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookOpen size={24} className="mx-auto mb-2 opacity-50" />
              <p>Aucun article analysé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`group relative p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    currentId === item.id 
                      ? 'bg-science-50 border-science-200 shadow-sm' 
                      : 'bg-white border-slate-100 hover:border-science-100'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xl">{item.summary.emoji}</span>
                    <button 
                      onClick={(e) => onDelete(item.id, e)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <h3 className={`font-medium text-sm line-clamp-2 mb-1 ${
                    currentId === item.id ? 'text-science-900' : 'text-slate-700'
                  }`}>
                    {item.summary.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    {!item.fileContent && (
                      <span className="text-amber-500" title="Contenu fichier non disponible">⚠ Résumé seul</span>
                    )}
                  </div>

                  {currentId === item.id && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-science-500 rounded-l-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};