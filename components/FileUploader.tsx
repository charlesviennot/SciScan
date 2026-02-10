import React, { useCallback, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Clipboard, X } from 'lucide-react';
import { UploadedFile } from '../types';
import { Button } from './ui/Button';

interface FileUploaderProps {
  onFileSelect: (file: UploadedFile) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = (file: File) => {
    const reader = new FileReader();

    if (file.type === 'application/pdf') {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Strip base64 header
        const base64Data = result.split(',')[1];
        
        onFileSelect({
          name: file.name,
          content: base64Data,
          type: 'pdf',
          mimeType: 'application/pdf'
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64Data = result.split(',')[1]; 
        
        onFileSelect({
          name: file.name,
          content: base64Data,
          type: 'image',
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        onFileSelect({
          name: file.name,
          content: e.target?.result as string,
          type: 'text'
        });
      };
      reader.readAsText(file);
    } else {
      alert("Format non supporté. Veuillez utiliser PDF, Images (.png, .jpg) ou Texte (.txt, .md).");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    onFileSelect({
      name: "Texte collé",
      content: pasteText,
      type: 'text'
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex mb-4 bg-slate-100 p-1 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'upload' ? 'bg-white text-science-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Fichier
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'paste' ? 'bg-white text-science-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Coller Texte
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div 
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            dragActive ? 'border-science-500 bg-science-50' : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="hidden"
            id="file-upload"
            accept=".txt,.md,.pdf,image/*"
            onChange={handleChange}
          />
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-science-100 text-science-600 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Glissez-déposez votre article (PDF, Image, Texte)</h3>
              <p className="text-slate-500 mt-1 text-sm">Supporte PDF, Text (.txt, .md) et Images (.png, .jpg)</p>
            </div>
            <label 
              htmlFor="file-upload"
              className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Parcourir les fichiers
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <textarea
            className="w-full h-64 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent outline-none resize-none text-slate-700 placeholder-slate-400"
            placeholder="Collez le texte de l'article scientifique ici..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          ></textarea>
          <div className="mt-4 flex justify-end">
            <Button onClick={handlePasteSubmit} disabled={!pasteText.trim()} icon={<FileText size={18}/>}>
              Analyser le texte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};