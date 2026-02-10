import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScientificSummary, UploadedFile, ChatMessage, PageAnalysis } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const model = "gemini-3-pro-preview"; 
  
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
        {
          text: "Analyse ce document scientifique. Extrais les informations clés et génère un résumé structuré selon le schéma JSON demandé. Réponds TOUJOURS en Français."
        }
      ]
    };
  } else {
    contents = {
      parts: [{
        text: `Voici le contenu d'un article scientifique :\n\n${file.content}\n\nAnalyse ce texte et génère un résumé structuré selon le schéma JSON demandé. Sois précis, pédagogique et réponds TOUJOURS en Français.`
      }]
    };
  }

  try {
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
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const analyzePageByPage = async (file: UploadedFile): Promise<PageAnalysis[]> => {
  const model = "gemini-3-pro-preview";

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

  try {
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
  } catch (error) {
    console.error("Page by Page Analysis Error:", error);
    throw error;
  }
};

export const extractDocumentSegments = async (file: UploadedFile, language: 'fr' | 'original' = 'fr'): Promise<string[]> => {
  const model = "gemini-3-flash-preview"; 
  
  // Updated prompt for FULL TEXT extraction
  let prompt = "TRANSCRIPTION INTÉGRALE : Extrais TOUT le contenu textuel principal de ce document pour une lecture audio complète. Ne fais PAS de résumé. Conserve tous les détails, explications et nuances du texte original. Ignore seulement les références bibliographiques finales et les bas de page purement techniques. Divise le texte en paragraphes logiques.";
  
  if (language === 'fr') {
    prompt += " TRADUIS L'INTÉGRALITÉ DU TEXTE EN FRANÇAIS en gardant le sens exact et le flux de l'article original.";
  } else {
    prompt += " Conserve strictement la langue originale du document.";
  }
  
  prompt += " Retourne une liste JSON de chaînes de caractères (segments) où chaque segment est un paragraphe complet.";

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

  try {
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
  } catch (error) {
    console.error("Extraction error", error);
    return ["Impossible d'extraire le texte complet du document pour le moment."];
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  const model = "gemini-2.5-flash-preview-tts";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, natural voice
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No audio data generated");
    return audioData;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

export const chatWithPaper = async (history: ChatMessage[], newMessage: string, file: UploadedFile): Promise<string> => {
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
};