import React, { useState, useEffect } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { generateSpeech } from '../../services/gemini';
import { playAudioData } from '../../utils/audio';

interface TextToSpeechButtonProps {
  text: string;
  size?: number;
  className?: string;
  colorClass?: string;
}

export const TextToSpeechButton: React.FC<TextToSpeechButtonProps> = ({ 
  text, 
  size = 18, 
  className = '',
  colorClass = 'text-slate-400 hover:text-science-600'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // We rely on the playAudioData utility which creates its own context and handles cleanup on end.
  // However, for the button, we can't easily cancel the specific promise chain of playAudioData 
  // without a more complex audio manager. 
  // For this simple implementation, we will disable the button while playing.

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlaying || isLoading) return;

    setIsLoading(true);
    try {
      const base64Audio = await generateSpeech(text);
      setIsLoading(false);
      setIsPlaying(true);
      await playAudioData(base64Audio);
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  return (
    <button 
      onClick={handleSpeak}
      disabled={isLoading || isPlaying}
      className={`transition-colors p-1 rounded-full hover:bg-slate-100 ${colorClass} ${className} disabled:opacity-50`}
      title="Lire le texte avec voix naturelle"
    >
      {isLoading ? (
        <Loader2 size={size} className="animate-spin" />
      ) : isPlaying ? (
        <Volume2 size={size} className="animate-pulse text-science-500" />
      ) : (
        <Volume2 size={size} />
      )}
    </button>
  );
};