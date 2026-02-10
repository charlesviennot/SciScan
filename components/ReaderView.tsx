import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UploadedFile } from '../types';
import { extractDocumentSegments, generateSpeech } from '../services/gemini';
import { playAudioData } from '../utils/audio';
import { Play, Pause, Loader2, Headphones, AlertTriangle, Languages, Eye, FileText as FileTextIcon, Download, ExternalLink, SkipForward } from 'lucide-react';
import { Button } from './ui/Button';

interface ReaderViewProps {
  file: UploadedFile;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ file }) => {
  const [segments, setSegments] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(-1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Options
  const [language, setLanguage] = useState<'fr' | 'original'>('fr');
  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf');
  
  // Refs for loop control and scrolling
  const isPlayingRef = useRef(false);
  const segmentsContainerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  
  // Audio control refs
  const stopCurrentAudioRef = useRef<(() => void) | null>(null);
  const audioCacheRef = useRef<Map<number, Promise<string>>>(new Map());

  // 1. Convert Base64 to Blob URL for reliable PDF display
  const fileUrl = useMemo(() => {
    if (file.type === 'text') return null;
    try {
      const byteCharacters = atob(file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.mimeType || 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Error creating blob URL", e);
      return null;
    }
  }, [file]);

  // Cleanup Blob URL
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // 2. Extraction when file or language changes
  useEffect(() => {
    const loadSegments = async () => {
      setIsExtracting(true);
      // Stop playing if language changes
      isPlayingRef.current = false;
      if (stopCurrentAudioRef.current) stopCurrentAudioRef.current();
      setIsPlaying(false);
      audioCacheRef.current.clear(); // Clear audio cache
      setCurrentSegmentIndex(-1); // Reset index on new extraction
      
      try {
        const textSegments = await extractDocumentSegments(file, language);
        setSegments(textSegments);
      } catch (e) {
        console.error(e);
      } finally {
        setIsExtracting(false);
      }
    };
    loadSegments();
  }, [file, language]);

  // 3. Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && segmentsContainerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentSegmentIndex]);

  // Helper to fetch audio (cached or new)
  const getAudioForSegment = (index: number, textSegments: string[]) => {
    if (index >= textSegments.length) return null;
    
    if (!audioCacheRef.current.has(index)) {
        // Start fetch and store promise
        const promise = generateSpeech(textSegments[index]);
        audioCacheRef.current.set(index, promise);
    }
    return audioCacheRef.current.get(index);
  };

  // 4. Robust Playback Loop with Buffering
  const startReadingLoop = async (startIndex: number) => {
    if (startIndex >= segments.length) return;

    isPlayingRef.current = true;
    setIsPlaying(true);
    setCurrentSegmentIndex(startIndex);

    let index = startIndex;

    while (index < segments.length && isPlayingRef.current) {
      setCurrentSegmentIndex(index);
      
      try {
        // A. Start pre-fetching the NEXT segment immediately (background)
        if (index + 1 < segments.length) {
            getAudioForSegment(index + 1, segments);
        }

        // B. Get CURRENT audio (wait if not ready)
        setIsLoadingAudio(true);
        const audioPromise = getAudioForSegment(index, segments);
        
        if (!audioPromise) break;
        
        const base64Audio = await audioPromise;

        // Check if stopped while waiting for API
        if (!isPlayingRef.current) {
            setIsLoadingAudio(false);
            break;
        }
        setIsLoadingAudio(false);
        
        // C. Play
        const { promise, stop } = playAudioData(base64Audio);
        stopCurrentAudioRef.current = stop;
        
        // Wait for playback to finish (or be skipped via stop())
        await promise;

        // Move to next
        index++;
      } catch (e) {
        console.error("Playback error", e);
        isPlayingRef.current = false;
        break;
      }
    }

    setIsPlaying(false);
    stopCurrentAudioRef.current = null;
    
    // Only reset index if we naturally reached the end of the document
    if (index >= segments.length) {
        setCurrentSegmentIndex(-1);
    }
  };

  const handleStart = () => {
    // If we have a stored index from a pause (and it's not the end), resume from there.
    // Otherwise start from 0.
    const startFrom = currentSegmentIndex >= 0 && currentSegmentIndex < segments.length 
        ? currentSegmentIndex 
        : 0;
    startReadingLoop(startFrom);
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    if (stopCurrentAudioRef.current) {
        stopCurrentAudioRef.current();
    }
    setIsPlaying(false);
    // Do NOT reset setCurrentSegmentIndex(-1) here, so we can resume later
  };

  const handleSkip = () => {
    // Calling stop on the current audio will resolve the promise in the loop
    // causing the loop to proceed to index++ immediately.
    if (stopCurrentAudioRef.current) {
        stopCurrentAudioRef.current();
    }
  };

  const handleSegmentClick = (index: number) => {
    handleStop();
    // Allow a tiny tick for cleanup before restarting
    setTimeout(() => startReadingLoop(index), 50);
  };

  return (
    <div className="flex flex-col h-auto gap-4 animate-in fade-in pb-10">
      
      {/* Controls Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 text-slate-700">
           <Headphones size={20} className="text-science-600" />
           <span className="font-semibold hidden sm:inline">Lecteur Immersif</span>
        </div>

        <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('pdf')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                        viewMode === 'pdf' ? 'bg-white shadow-sm text-science-700' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Eye size={14} /> Visuel
                </button>
                <button 
                    onClick={() => setViewMode('text')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                        viewMode === 'text' ? 'bg-white shadow-sm text-science-700' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <FileTextIcon size={14} /> Texte
                </button>
            </div>

            <div className="w-px h-6 bg-slate-200"></div>

            {/* Language Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setLanguage('fr')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        language === 'fr' ? 'bg-white shadow-sm text-science-700' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    🇫🇷 Français
                </button>
                <button 
                    onClick={() => setLanguage('original')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        language === 'original' ? 'bg-white shadow-sm text-science-700' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Original
                </button>
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-[calc(100vh-220px)] gap-4">
        {/* Left: Document Visual */}
        <div className="w-full md:w-3/5 bg-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col border border-slate-700 relative group">
            <div className="bg-slate-900 text-slate-300 px-4 py-2 text-sm flex justify-between items-center border-b border-slate-700">
                <span className="font-medium">{viewMode === 'pdf' ? 'Document Original' : 'Texte Transcrit'}</span>
                <span className="opacity-50 truncate max-w-[200px] text-xs">{file.name}</span>
            </div>
            
            <div className="flex-1 relative overflow-hidden bg-slate-200 flex items-center justify-center">
            {viewMode === 'pdf' ? (
                file.type === 'pdf' && fileUrl ? (
                  <>
                    <iframe
                        src={`${fileUrl}#toolbar=0&navpanes=0`}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                    />
                    {/* Fallback / External Open Button (always visible on hover for safety) */}
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-slate-900/80 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 hover:bg-slate-800 shadow-lg backdrop-blur-sm"
                         >
                            <ExternalLink size={14} /> Ouvrir le PDF externe
                         </a>
                    </div>
                  </>
                ) : file.type === 'image' ? (
                <img 
                    src={`data:${file.mimeType};base64,${file.content}`} 
                    className="max-w-full max-h-full object-contain" 
                    alt="Document"
                />
                ) : (
                <div className="p-8 whitespace-pre-wrap font-mono text-sm w-full h-full overflow-y-auto bg-white text-slate-800">
                    {file.content}
                </div>
                )
            ) : (
                // Clean Text Mode
                <div className="w-full h-full bg-white p-8 overflow-y-auto">
                    {segments.length > 0 ? (
                        <div className="prose max-w-none">
                            {segments.map((seg, i) => (
                                <p key={i} className="mb-6 text-slate-800 leading-relaxed font-serif text-lg text-justify">{seg}</p>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p>Transcription intégrale en cours...</p>
                        </div>
                    )}
                </div>
            )}
            </div>
        </div>

        {/* Right: Smart Reader */}
        <div className="w-full md:w-2/5 bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-4 flex flex-col gap-3 z-10 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-lg">
                        {language === 'fr' ? 'Lecture Intégrale (FR)' : 'Lecture Intégrale (Original)'}
                    </h3>
                    {segments.length > 0 && (
                        <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded-full text-slate-500">
                            {segments.length} paragraphes
                        </span>
                    )}
                </div>
                
                <div className="flex gap-2">
                    {!isPlaying ? (
                    <Button 
                        onClick={handleStart} 
                        disabled={isExtracting || segments.length === 0}
                        className="flex-1 bg-science-600 hover:bg-science-500 text-white py-3 shadow-md"
                    >
                        <Play size={18} className="mr-2 fill-current" /> 
                        {currentSegmentIndex > 0 ? 'Reprendre la Lecture' : 'Démarrer la Lecture'}
                    </Button>
                    ) : (
                    <>
                        <Button 
                            onClick={handleStop} 
                            variant="secondary"
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 py-3"
                        >
                            <Pause size={18} className="mr-2 fill-current" /> Pause
                        </Button>
                        <Button 
                            onClick={handleSkip} 
                            variant="secondary"
                            className="w-16 border-slate-200 text-slate-600 hover:bg-slate-50 py-3"
                            title="Passer au paragraphe suivant"
                        >
                            <SkipForward size={18} />
                        </Button>
                    </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative scrollbar-thin scroll-smooth bg-slate-50" ref={segmentsContainerRef}>
            {isExtracting ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Extraction du texte complet...</p>
                </div>
            ) : segments.length === 0 ? (
                <div className="text-center text-slate-400 py-10 px-4">
                  <p className="mb-2">Impossible d'extraire le texte.</p>
                  <p className="text-xs">Vérifiez que le document contient du texte sélectionnable.</p>
                </div>
            ) : (
                segments.map((text, idx) => (
                <div 
                    key={idx}
                    ref={idx === currentSegmentIndex ? activeSegmentRef : null}
                    onClick={() => handleSegmentClick(idx)}
                    className={`p-4 rounded-xl transition-all cursor-pointer border ${
                    idx === currentSegmentIndex 
                        ? 'bg-white border-science-500 shadow-lg ring-1 ring-science-500 transform scale-[1.02] z-10' 
                        : 'bg-white border-slate-200 hover:border-science-300 text-slate-500'
                    }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${idx === currentSegmentIndex ? 'text-science-600' : 'text-slate-300'}`}>
                            Paragraphe {idx + 1}
                        </span>
                        {idx === currentSegmentIndex && isLoadingAudio && (
                             <Loader2 size={14} className="animate-spin text-science-600" />
                        )}
                    </div>
                    <p className={`text-sm leading-relaxed line-clamp-4 ${
                    idx === currentSegmentIndex ? 'text-slate-800 font-medium' : 'text-slate-400'
                    }`}>
                    {text}
                    </p>
                </div>
                ))
            )}
            </div>
        </div>
      </div>
    </div>
  );
};