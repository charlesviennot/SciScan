import React from 'react';
import { TextToSpeechButton } from './TextToSpeechButton';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  contentForAudio?: string; // Text specifically for TTS
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon, contentForAudio }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-6 ${className}`}>
      {(title || icon) && (
        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
          <div className="flex items-center gap-3">
            {icon && <div className="text-science-600">{icon}</div>}
            {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
          </div>
          {contentForAudio && <TextToSpeechButton text={contentForAudio} />}
        </div>
      )}
      {children}
    </div>
  );
};