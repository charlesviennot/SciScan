import { HistoryItem, UploadedFile, ScientificSummary, PageAnalysis } from "../types";

const STORAGE_KEY = 'sciscan_history_v1';

export const saveToHistory = (file: UploadedFile, summary: ScientificSummary, pageAnalysis?: PageAnalysis[]): HistoryItem => {
  const newItem: HistoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    fileName: file.name,
    summary,
    fileContent: file,
    pageAnalysis
  };

  try {
    const history = getHistory();
    // Add to beginning
    const updatedHistory = [newItem, ...history];
    
    // Attempt to save full content
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return newItem;
  } catch (e) {
    console.warn("Storage quota exceeded, trying to save without file content...");
    
    // Fallback: If quota exceeded (PDFs are heavy), save without the file content
    // The user keeps the summary but might need to re-upload for chat/deep analysis
    const itemWithoutContent = { ...newItem, fileContent: undefined };
    const history = getHistory();
    const updatedHistory = [itemWithoutContent, ...history];
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
      return itemWithoutContent;
    } catch (e2) {
      console.error("Could not save to history even without content", e2);
      return newItem;
    }
  }
};

export const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
  const history = getHistory();
  const index = history.findIndex(item => item.id === id);
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Failed to update history item", e);
    }
  }
};

export const getHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error reading history", e);
    return [];
  }
};

export const deleteFromHistory = (id: string): HistoryItem[] => {
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};