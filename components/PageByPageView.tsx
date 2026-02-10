import React, { useState, useRef, useEffect } from 'react';
import { PageAnalysis } from '../types';
import { Card } from './ui/Card';
import { FileText, Loader2, Play, Pause, Headphones, Volume2, Square } from 'lucide-react';
import { Button } from './ui/Button';
import { generateSpeech } from '../services/gemini';
import { playAudioData } from '../utils/audio';

interface PageByPageViewProps {
  pages?: PageAnalysis[];
  isLoading: boolean;
  onGenerate: () => void;
}

export const PageByPageView: React.FC<PageByPageViewProps> = ({ pages, isLoading, onGenerate }) => {
  const [readingState, setReadingState] = useState<{
    isPlaying: boolean;
    currentIndex: number;
    isLoadingAudio: boolean;
    mode: 'all' | 'single'; // Track if we are reading all or just one
  }>({ isPlaying: false, currentIndex: -1, isLoadingAudio: false, mode: 'all' });

  const isPlayingRef = useRef(false);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // Scroll to active card if in "Read All" mode
  useEffect(() => {
    if (activeCardRef.current && readingState.isPlaying && readingState.mode === 'all') {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [readingState.currentIndex, readingState.isPlaying, readingState.mode]);

  const stopReading = () => {
    isPlayingRef.current = false;
    setReadingState(prev => ({ ...prev, isPlaying: false, isLoadingAudio: false }));
  };

  const startReadingAll = async () => {
    if (!pages) return;
    stopReading(); // Stop any current playback
    
    // Small delay to allow state to settle
    setTimeout(async () => {
        isPlayingRef.current = true;
        setReadingState({ isPlaying: true, currentIndex: 0, isLoadingAudio: true, mode: 'all' });

        let i = 0;
        while (i < pages.length && isPlayingRef.current) {
            setReadingState(prev => ({ ...prev, currentIndex: i, isLoadingAudio: true }));
            
            try {
                const page = pages[i];
                const textToRead = `Page ${page.page_number}. ${page.title}. Résumé : ${page.summary}. Points importants : ${page.key_points.join('. ')}`;
                const base64Audio = await generateSpeech(textToRead);
                
                if (!isPlayingRef.current) break;
                
                setReadingState(prev => ({ ...prev, isLoadingAudio: false }));
                await playAudioData(base64Audio);
                
                i++;
            } catch (e) {
                console.error("Error reading page", e);
                isPlayingRef.current = false;
                break;
            }
        }
        setReadingState(prev => ({ ...prev, isPlaying: false, currentIndex: -1, isLoadingAudio: false }));
    }, 100);
  };

  const readSinglePage = async (index: number) => {
    if (!pages) return;
    
    // If clicking the same page while playing, stop it
    if (readingState.isPlaying && readingState.currentIndex === index) {
        stopReading();
        return;
    }

    stopReading();
    
    setTimeout(async () => {
        isPlayingRef.current = true;
        setReadingState({ isPlaying: true, currentIndex: index, isLoadingAudio: true, mode: 'single' });
        
        try {
            const page = pages[index];
            const textToRead = `${page.title}. ${page.summary}. ${page.key_points.join('. ')}`;
            const base64Audio = await generateSpeech(textToRead);

            if (isPlayingRef.current) {
                setReadingState(prev => ({ ...prev, isLoadingAudio: false }));
                await playAudioData(base64Audio);
            }
        } catch (e) {
             console.error("Error reading single page", e);
        } finally {
            // Only reset if we are still targeting this specific play session
            if (isPlayingRef.current) {
                setReadingState(prev => ({ ...prev, isPlaying: false, currentIndex: -1 }));
                isPlayingRef.current = false;
            }
        }
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 animate-in fade-in">
        <Loader2 className="w-12 h-12 text-science-600 animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-slate-800">Analyse détaillée en cours...</h3>
        <p className="text-slate-500 mt-2 max-w-md">
          L'IA parcourt chaque page de votre document pour extraire les détails spécifiques. Cela peut prendre un peu de temps.
        </p>
      </div>
    );
  }

  if (!pages) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed">
        <div className="w-16 h-16 bg-science-50 text-science-600 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800">Analyse Page par Page</h3>
        <p className="text-slate-500 mt-2 mb-6 max-w-md">
          Obtenez une analyse précise et séquentielle de chaque page ou section de votre document. Idéal pour les lectures approfondies.
        </p>
        <Button onClick={onGenerate} icon={<FileText size={18} />}>
          Lancer l'analyse détaillée
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="sticky top-20 z-20 bg-slate-50/95 backdrop-blur-sm py-4 -mx-4 px-4 border-b border-slate-200 md:rounded-lg md:mx-0 md:px-0 md:bg-transparent md:backdrop-filter-none md:border-none md:static flex items-center justify-between mb-4">
         <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Analyse Séquentielle</h2>
            <span className="text-sm font-medium bg-science-100 text-science-700 px-3 py-1 rounded-full">
            {pages.length} Pages
            </span>
         </div>
         
         {readingState.isPlaying && readingState.mode === 'all' ? (
            <Button 
                onClick={stopReading} 
                variant="secondary" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                icon={<Pause size={18} />}
            >
                Arrêter Tout
            </Button>
         ) : (
            <Button 
                onClick={startReadingAll} 
                icon={<Headphones size={18} />}
                className="bg-slate-800 hover:bg-slate-700"
            >
                Lire tout le document
            </Button>
         )}
      </div>

      <div className="grid gap-6 pb-20">
        {pages.map((page, idx) => {
            const isActive = readingState.isPlaying && readingState.currentIndex === idx;
            
            return (
                <div 
                    key={page.page_number} 
                    ref={isActive ? activeCardRef : null}
                    className={`flex gap-4 md:gap-6 group transition-opacity duration-500 ${
                        readingState.isPlaying && readingState.mode === 'all' && !isActive ? 'opacity-40' : 'opacity-100'
                    }`}
                >
                    {/* Timeline / Page Number */}
                    <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md z-10 transition-all duration-300 ${
                        isActive 
                            ? 'bg-science-600 text-white scale-110 ring-4 ring-science-100' 
                            : 'bg-slate-800 text-white group-hover:bg-science-600'
                    }`}>
                        {page.page_number}
                    </div>
                    <div className="w-0.5 bg-slate-200 flex-1 h-full min-h-[50px] mt-2 group-last:hidden"></div>
                    </div>

                    {/* Content Card */}
                    <Card 
                        className={`flex-1 mb-2 transition-all duration-300 relative ${
                            isActive 
                                ? 'border-science-400 ring-2 ring-science-100 shadow-lg' 
                                : 'hover:border-science-300'
                        }`}
                    >
                    {/* Individual Play Button in Header */}
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                readSinglePage(idx);
                            }}
                            className={`p-2 rounded-full transition-all ${
                                isActive 
                                    ? 'bg-science-100 text-science-600' 
                                    : 'bg-slate-100 text-slate-400 hover:text-science-600 hover:bg-science-50'
                            }`}
                            title={isActive ? "Arrêter" : "Lire cette page"}
                        >
                            {isActive ? (
                                readingState.isLoadingAudio ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Square size={18} fill="currentColor" />
                                )
                            ) : (
                                <Volume2 size={18} />
                            )}
                        </button>
                    </div>

                    <div className="flex justify-between items-start pr-10">
                        <h3 className={`text-lg font-bold mb-2 ${isActive ? 'text-science-700' : 'text-slate-800'}`}>
                            {page.title}
                        </h3>
                    </div>
                    
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        {page.summary}
                    </p>
                    
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Points Clés</h4>
                        <ul className="space-y-1">
                        {page.key_points.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-science-500 mt-1.5">•</span>
                            <span>{point}</span>
                            </li>
                        ))}
                        </ul>
                    </div>
                    </Card>
                </div>
            );
        })}
      </div>
    </div>
  );
};