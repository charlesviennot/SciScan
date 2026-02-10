import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ScientificSummary } from '../types';
import { Card } from './ui/Card';
import { TextToSpeechButton } from './ui/TextToSpeechButton';
import { BookOpen, Lightbulb, Target, ArrowRight, BrainCircuit, GraduationCap } from 'lucide-react';

interface SummaryViewProps {
  summary: ScientificSummary;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary }) => {
  return (
    <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Summary */}
      <div className="bg-gradient-to-r from-science-900 to-science-600 rounded-xl p-8 text-white shadow-lg relative">
        <div className="absolute top-4 right-4">
            <TextToSpeechButton 
                text={`${summary.title}. ${summary.one_sentence_summary}`} 
                colorClass="text-science-200 hover:text-white" 
                size={24}
            />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-4xl mb-2">{summary.emoji}</div>
            <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{summary.title}</h1>
            <p className="text-science-100 text-lg italic border-l-4 border-science-400 pl-4">
              "{summary.one_sentence_summary}"
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ELI5 Section */}
        <Card 
            title="Explication Simple (ELI5)" 
            icon={<Lightbulb className="w-6 h-6" />} 
            className="bg-amber-50/50 border-amber-100"
            contentForAudio={summary.simple_explanation}
        >
          <div className="prose prose-sm prose-amber max-w-none">
            <ReactMarkdown>{summary.simple_explanation}</ReactMarkdown>
          </div>
        </Card>

        {/* Key Findings */}
        <Card 
            title="Points Clés" 
            icon={<Target className="w-6 h-6" />} 
            className="bg-emerald-50/50 border-emerald-100"
            contentForAudio={summary.key_findings.join('. ')}
        >
          <ul className="space-y-3">
            {summary.key_findings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="min-w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mt-0.5">
                  {idx + 1}
                </div>
                <span className="text-slate-700 text-sm leading-relaxed">{finding}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Methodology */}
      <Card 
        title="Méthodologie" 
        icon={<BrainCircuit className="w-6 h-6" />}
        contentForAudio={summary.methodology}
      >
        <div className="prose prose-sm prose-slate max-w-none text-slate-600">
          <ReactMarkdown>{summary.methodology}</ReactMarkdown>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Conclusion */}
        <Card 
            title="Conclusion" 
            icon={<GraduationCap className="w-6 h-6" />}
            contentForAudio={summary.conclusion}
        >
          <div className="prose prose-sm prose-slate max-w-none text-slate-600">
            <ReactMarkdown>{summary.conclusion}</ReactMarkdown>
          </div>
        </Card>

        {/* Implications */}
        <Card 
            title="Pourquoi c'est important ?" 
            icon={<ArrowRight className="w-6 h-6" />}
            contentForAudio={summary.implications}
        >
           <div className="prose prose-sm prose-slate max-w-none text-slate-600">
            <ReactMarkdown>{summary.implications}</ReactMarkdown>
          </div>
        </Card>
      </div>
    </div>
  );
};