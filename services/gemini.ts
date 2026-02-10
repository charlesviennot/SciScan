import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScientificSummary, UploadedFile, ChatMessage, PageAnalysis } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- RESILIENCE HELPER ---
// Automatically retries requests if a 429 (Quota) error occurs
const callGeminiWithRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  initialDelay = 5000 // Start with 5 seconds wait
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const errorStr = error?.toString() || "";
    const isQuotaError = 
      errorStr.includes("429") || 
      errorStr.includes("Quota") || 
      errorStr.includes("Resource has been exhausted") ||
      error?.status === 429;
    
    if (isQuotaError && retries > 0) {
      console.warn(`⚠️ Quota API atteint (429). Pause de ${initialDelay}ms avant réessai... (${retries} essais restants)`);
      // Wait
      await new Promise(resolve => setTimeout(resolve, initialDelay));
      // Retry with double the delay (Exponential Backoff)
      return callGeminiWithRetry(operation, retries - 1, initialDelay * 1.5);
    }
    throw error;
  }
};

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The extracted title of the paper" },
    emoji: { type: Type.STRING, description: "A relevant single emoji representing the topic" },
    one_sentence_summary: { type: Type.STRING, description: "A concise, one-sentence summary of the entire paper" },
    simple_explanation: { type: Type.STRING, description: "An ELI5 (Explain Like I'm 5) explanation of the core concept. Use Markdown." },
    key_findings: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of 3-5 key findings or results."
    },
    methodology: { type: Type.STRING, description: "Brief explanation of how the study was conducted. Use Markdown." },
    conclusion: { type: Type.STRING, description: "The main conclusion drawn by the authors. Use Markdown." },
    implications: { type: Type.STRING, description: "Why this matters in the real world. Use Markdown." }
  },
  required: ["title", "emoji", "one_sentence_summary", "simple_explanation", "key_findings", "methodology", "conclusion", "implications"]
};

const PAGES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page_number: { type: Type.INTEGER, description: "The sequential page number or section number" },
          title: { type: Type.STRING, description: "A short title for this page/section content" },
          summary: { type: Type.STRING, description: "Detailed summary of what is discussed on this specific page" },
          key_points: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 bullet points specific to this page" }
        },
        required: ["page_number", "title", "summary", "key_points"]
      }
    }
  },
  required: ["pages"]
};

const SEGMENTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of text paragraphs extracted from the document."
    }
  },
  required: ["segments"]
};

export const analyzePaper = async (file: UploadedFile): Promise<ScientificSummary> => {
  return callGeminiWithRetry(async () => {
    const model = "gemini-3-flash-preview"; 
    
    let contents;
    const promptText = "Analyse ce document scientifique. Extrais les informations clés et génère un résumé structuré selon le schéma JSON demandé. Réponds TOUJOURS en Français.";

    if (file.type === 'image' || file.type === 'pdf') {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: file.mimeType || (file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
              data: file.content
            }
          },
          { text: promptText }
        ]
      };
    } else {
      contents = {
        parts: [{
          text: `Voici le contenu d'un article scientifique :\n\n${file.content}\n\n${promptText}`
        }]
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: SUMMARY_SCHEMA,
        systemInstruction: "Tu es un expert scientifique renommé capable de vulgariser des concepts complexes. Ton but est d'aider un utilisateur à comprendre rapidement un article scientifique. Utilise un ton professionnel mais accessible."
      }
    });

    if (!response.text) {
      throw new Error("Pas de réponse de l'IA.");
    }

    return JSON.parse(response.text) as ScientificSummary;
  });
};

export const analyzePageByPage = async (file: UploadedFile): Promise<PageAnalysis[]> => {
  return callGeminiWithRetry(async () => {
    // We use flash here instead of Pro to save quota tokens and speed up retry loops
    const model = "gemini-3-flash-preview"; 

    let contents;
    const prompt = "Analyse ce document page par page (ou section par section si les pages ne sont pas claires). Pour chaque page, fournis un résumé détaillé et précis de ce qui s'y trouve. Sois exhaustif. Réponds en Français.";

    if (file.type === 'image' || file.type === 'pdf') {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: file.mimeType || (file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
              data: file.content
            }
          },
          { text: prompt }
        ]
      };
    } else {
      contents = {
        parts: [{
          text: `Voici le document :\n${file.content}\n\n${prompt}`
        }]
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: PAGES_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("No response text");
    }

    const json = JSON.parse(response.text);
    return json.pages as PageAnalysis[];
  });
};

export const extractDocumentSegments = async (file: UploadedFile, language: 'fr' | 'original' = 'fr'): Promise<string[]> => {
  return callGeminiWithRetry(async () => {
    const model = "gemini-3-flash-preview"; 
    
    let prompt = "TRANSCRIPTION INTÉGRALE ET NETTOYAGE : Extrais TOUT le contenu textuel principal de ce document pour une lecture audio. Conserve tous les détails. Divise le texte en paragraphes logiques.";
    prompt += " IMPORTANT : Assure-toi que le texte est PARFAITEMENT lisible. Corrige toutes les erreurs d'OCR (lettres manquantes, mots coupés, caractères bizarres). Ne laisse aucune phrase tronquée.";
    
    if (language === 'fr') {
      prompt += " TRADUIS L'INTÉGRALITÉ DU TEXTE EN FRANÇAIS FLUIDE ET PROFESSIONNEL. Si le texte source a des erreurs, corrige-les dans la traduction.";
    } else {
      prompt += " Conserve strictement la langue originale mais corrige les défauts visuels du PDF (ex: 're-sults' devient 'results').";
    }
    
    prompt += " Retourne une liste JSON de chaînes de caractères (segments) où chaque segment est un paragraphe complet et propre.";

    let contents;
    if (file.type === 'image' || file.type === 'pdf') {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: file.mimeType || (file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
              data: file.content
            }
          },
          { text: prompt }
        ]
      };
    } else {
      contents = {
        parts: [{
          text: `Voici le document :\n${file.content}\n\n${prompt}`
        }]
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: SEGMENTS_SCHEMA
      }
    });
    
    if (!response.text) throw new Error("No extraction result");
    const segments = JSON.parse(response.text).segments;
    return segments.length > 0 ? segments : ["Aucun texte extractible trouvé."];
  });
};

export const generateSpeech = async (text: string): Promise<string> => {
  return callGeminiWithRetry(async () => {
    const model = "gemini-2.5-flash-preview-tts";
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No audio data generated");
    return audioData;
  });
};

export const chatWithPaper = async (history: ChatMessage[], newMessage: string, file: UploadedFile): Promise<string> => {
  return callGeminiWithRetry(async () => {
    const model = "gemini-3-flash-preview"; 
    
    let systemInstruction = "Tu es un assistant de recherche utile. L'utilisateur pose des questions sur un article scientifique.";
    
    let historyForGemini: any[] = history
      .filter(h => h.role !== 'user' || h.text !== newMessage)
      .map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

    if (file.type === 'text') {
      systemInstruction += `\n\nVoici le contenu de l'article pour référence :\n---\n${file.content.substring(0, 30000)}...\n---\nRéponds en Français.`;
    } else {
      const filePart = {
        inlineData: {
          mimeType: file.mimeType || (file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
          data: file.content
        }
      };

      // To save tokens/quota in chat history, we only send the file if it's the very first interaction context
      // Or we assume the chat session handles context caching (implicitly).
      // Here we re-inject it at the start.
      historyForGemini = [
        {
          role: 'user',
          parts: [
            filePart,
            { text: "Voici le document de référence. Je vais te poser des questions dessus." }
          ]
        },
        {
          role: 'model',
          parts: [{ text: "Bien reçu. Je suis prêt à répondre à vos questions sur ce document." }]
        },
        ...historyForGemini
      ];
      
      systemInstruction += " Réponds aux questions en te basant sur le document fourni dans l'historique de conversation. Réponds en Français.";
    }

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: systemInstruction
      },
      history: historyForGemini
    });

    const result = await chat.sendMessage({
      message: newMessage
    });

    return result.text || "Désolé, je n'ai pas pu générer de réponse.";
  });
};