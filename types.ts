export interface ScientificSummary {
  title: string;
  emoji: string;
  one_sentence_summary: string;
  simple_explanation: string;
  key_findings: string[];
  methodology: string;
  conclusion: string;
  implications: string;
}

export interface PageAnalysis {
  page_number: number;
  title: string;
  summary: string;
  key_points: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type FileType = 'text' | 'image' | 'pdf';

export interface UploadedFile {
  name: string;
  content: string; // Base64 for images/pdf, string for text
  type: FileType;
  mimeType?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  summary: ScientificSummary;
  fileContent?: UploadedFile; 
  pageAnalysis?: PageAnalysis[];
  chatHistory?: ChatMessage[];
}