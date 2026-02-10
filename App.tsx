import React, { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { SummaryView } from './components/SummaryView';
import { ChatInterface } from './components/ChatInterface';
import { PageByPageView } from './components/PageByPageView';
import { ReaderView } from './components/ReaderView';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui/Button';
import { AppState, ScientificSummary, UploadedFile, HistoryItem, PageAnalysis, ChatMessage } from './types';
import { analyzePaper, analyzePageByPage } from './services/gemini';
import { saveToHistory, getHistory, deleteFromHistory, updateHistoryItem } from './services/storage';
import { Microscope, RotateCcw, MessageSquare, FileText, Layers, Menu, X, BookOpen, Clock } from 'lucide-react';

type Tab = 'summary' | 'pages' | 'chat' | 'reader';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Data State
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [summary, setSummary] = useState<ScientificSummary | null>(null);
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysis[] | undefined>(undefined);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>(undefined);
  const [currentChatHistory, setCurrentChatHistory] = useState<ChatMessage[] | undefined>(undefined);
  
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPageAnalysisLoading, setIsPageAnalysisLoading] = useState(false);

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleFileSelect = async (file: UploadedFile) => {
    setAppState(AppState.ANALYZING);
    setCurrentFile(file);
    setErrorMsg(null);
    setActiveTab('summary');
    setPageAnalysis(undefined);
    setCurrentChatHistory(undefined); // Reset chat for new file
    setCurrentHistoryId(undefined);

    try {
      const result = await analyzePaper(file);
      setSummary(result);
      
      // Save to history immediately
      const newItem = saveToHistory(file, result);
      setHistory(prev => [newItem, ...prev]);
      setCurrentHistoryId(newItem.id);
      
      setAppState(AppState.SUCCESS);
    } catch (error: any) {
      console.error(error);
      setAppState(AppState.ERROR);
      
      // Detailed error handling for Quotas/Limits
      const errorString = error?.toString() || "";
      const detailedError = error instanceof Error ? error.message : "Erreur inconnue";
      
      if (errorString.includes("429") || detailedError.includes("429") || errorString.includes("Quota") || detailedError.includes("Quota")) {
        setErrorMsg("Limite de requêtes atteinte (Quota API). Veuillez attendre environ 1 minute avant de réessayer.");
      } else if (errorString.includes("API_KEY") || detailedError.includes("API_KEY")) {
        setErrorMsg("Clé API manquante ou invalide. Veuillez vérifier la configuration de votre projet.");
      } else {
        setErrorMsg(`Une erreur est survenue lors de l'analyse : ${detailedError}. Vérifiez le format du fichier.`);
      }
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setAppState(AppState.SUCCESS);
    setSummary(item.summary);
    // If file content is missing (quota limit), we handle it in UI
    setCurrentFile(item.fileContent || null);
    setPageAnalysis(item.pageAnalysis);
    setCurrentChatHistory(item.chatHistory);
    setCurrentHistoryId(item.id);
    setActiveTab('summary');
    setIsSidebarOpen(false); // Close mobile sidebar
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteFromHistory(id);
    setHistory(updated);
    if (currentHistoryId === id) {
      handleReset();
    }
  };

  const handleGeneratePageAnalysis = async () => {
    if (!currentFile || !currentHistoryId) return;
    
    setIsPageAnalysisLoading(true);
    try {
      const pages = await analyzePageByPage(currentFile);
      setPageAnalysis(pages);
      
      // Update history with new page analysis
      updateHistoryItem(currentHistoryId, { pageAnalysis: pages });
      
      // Update local state history
      setHistory(prev => prev.map(item => 
        item.id === currentHistoryId ? { ...item, pageAnalysis: pages } : item
      ));

    } catch (error: any) {
      console.error(error);
      const errorString = error?.toString() || "";
      if (errorString.includes("429")) {
        alert("Limite de requêtes atteinte. Veuillez attendre un moment.");
      } else {
        alert("Impossible de générer l'analyse par page. Veuillez réessayer.");
      }
    } finally {
      setIsPageAnalysisLoading(false);
    }
  };

  const handleChatUpdate = (updatedChat: ChatMessage[]) => {
    if (!currentHistoryId) return;
    
    // Optimistic update for UI state
    setCurrentChatHistory(updatedChat);

    // Persist to storage
    updateHistoryItem(currentHistoryId, { chatHistory: updatedChat });
    
    // Update main history list state
    setHistory(prev => prev.map(item => 
      item.id === currentHistoryId ? { ...item, chatHistory: updatedChat } : item
    ));
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setSummary(null);
    setCurrentFile(null);
    setPageAnalysis(undefined);
    setCurrentChatHistory(undefined);
    setCurrentHistoryId(undefined);
    setActiveTab('summary');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-md md:hidden"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <div className="flex items-center gap-2 text-science-600 cursor-pointer" onClick={handleReset}>
              <Microscope className="w-7 h-7" />
              <span className="font-bold text-xl tracking-tight text-slate-800 hidden sm:block">SciScan</span>
            </div>
          </div>
          
          {appState === AppState.SUCCESS && (
            <Button variant="ghost" onClick={handleReset} icon={<RotateCcw size={16} />}>
              Nouvelle Analyse
            </Button>
          )}
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          history={history}
          onSelect={handleHistorySelect}
          onDelete={handleDeleteHistory}
          currentId={currentHistoryId}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        {/* Main Content with Margin for Sidebar */}
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-72'} p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto`}>
          
          {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in duration-700">
              <div className="text-center mb-10 max-w-2xl">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                  Comprenez la Science <span className="text-science-600">Instantanément</span>
                </h1>
                <p className="text-lg text-slate-500">
                  Déposez un article scientifique (PDF, Image, Texte). Notre IA génère un résumé structuré, une analyse par page et répond à vos questions.
                </p>
              </div>
              
              <FileUploader onFileSelect={handleFileSelect} />

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-center">
                {[
                  { title: "Vulgarisation", desc: "Explications ELI5 claires", icon: "🧠" },
                  { title: "Mode Lecture", desc: "Assistant vocal naturel", icon: "🎧" },
                  { title: "Chat Interactif", desc: "Posez vos questions", icon: "💬" }
                ].map((feature, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:border-science-200 transition-colors">
                    <div className="text-3xl mb-3">{feature.icon}</div>
                    <h3 className="font-semibold text-slate-800">{feature.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-science-500 rounded-full border-t-transparent animate-spin"></div>
                <Microscope className="absolute inset-0 m-auto text-science-600 w-10 h-10 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyse en cours...</h2>
              <p className="text-slate-500 max-w-md">
                Notre IA lit l'article, extrait les points clés et synthétise les résultats complexes.
              </p>
            </div>
          )}

          {appState === AppState.ERROR && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-in fade-in">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                {errorMsg && errorMsg.includes("429") ? <Clock className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {errorMsg && errorMsg.includes("429") ? "Quota Atteint" : "Oups !"}
              </h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">{errorMsg}</p>
              <Button onClick={handleReset}>Réessayer</Button>
            </div>
          )}

          {appState === AppState.SUCCESS && summary && (
            <div className="relative">
              {/* Tab Navigation */}
              <div className="flex justify-center mb-8 sticky top-20 z-30 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-slate-200 inline-flex pointer-events-auto gap-1">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'summary' ? 'bg-science-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={16} />
                    Résumé
                  </button>
                  <button
                    onClick={() => setActiveTab('pages')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'pages' ? 'bg-science-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Layers size={16} />
                    Page par Page
                  </button>
                  <button
                    onClick={() => setActiveTab('reader')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'reader' ? 'bg-science-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen size={16} />
                    Lecture
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'chat' ? 'bg-science-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare size={16} />
                    Discussion
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[500px]">
                {activeTab === 'summary' && <SummaryView summary={summary} />}
                
                {activeTab === 'pages' && (
                  <PageByPageView 
                    pages={pageAnalysis} 
                    isLoading={isPageAnalysisLoading}
                    onGenerate={handleGeneratePageAnalysis}
                  />
                )}

                {activeTab === 'reader' && (
                  currentFile ? (
                    <ReaderView file={currentFile} />
                  ) : (
                    <div className="text-center p-8 bg-amber-50 rounded-lg border border-amber-200">
                      Document non disponible.
                    </div>
                  )
                )}
                
                {activeTab === 'chat' && (
                  currentFile ? (
                    <ChatInterface 
                        file={currentFile} 
                        initialHistory={currentChatHistory}
                        onUpdateHistory={handleChatUpdate}
                    />
                  ) : (
                    <div className="text-center p-8 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="text-lg font-bold text-amber-800 mb-2">Fichier manquant</h3>
                      <p className="text-amber-700">
                        Le contenu du fichier n'a pas pu être restauré depuis l'historique (trop volumineux). 
                        Veuillez réimporter le fichier pour utiliser le chat.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;