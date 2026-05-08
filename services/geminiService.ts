
// services/geminiService.ts
import { GoogleGenAI, GenerateContentResponse, Content, Modality } from "@google/genai";
import { NutritionalInfo, SearchedFoodInfo, GoalSettings, UserProfileData, RecipeSuggestion, AIDataForFeedback, IngredientRecipeResponse, AIDataForJourneyAnalysis, WeightLogEntry, PastDaySummary, TimelineMilestone, AIDataForLessonIntro, AIDataForCoachSummary, AIStructuredFeedbackResponse, Level, MentalWellbeingLog, GoalType, ActivityLevel, CoachStyle } from '../types.ts';
import { GEMINI_MODEL_NAME_TEXT, LEVEL_DEFINITIONS, COACH_PERSONAS } from '../constants.ts';
import { auth, firebaseConfig } from '../firebase.ts';

// -- SECURE PROXY SETUP --
// We route all Gemini API calls through our Firebase Cloud Function Proxy.
// The raw GEMINI_API_KEY is safely stored ONLY on the backend.
class ProxyFetch {
    static async fetch(url: URL | RequestInfo, init?: RequestInit): Promise<Response> {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Du måste vara inloggad för att använda AI-funktioner.");
        }
        
        let token: string;
        try {
           token = await user.getIdToken();
        } catch(e) {
           throw new Error("Kunde inte verifiera inloggning för AI.");
        }

        // Skapa ett riktigt Headers-objekt från det existerande (viktigt!)
        const headers = new Headers(init?.headers || {});
        
        // Lägg till din inloggningstoken
        headers.set('Authorization', `Bearer ${token}`);
        
        // Se till att servern förstår att vi skickar JSON
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        // Logga i konsolen så du kan se att ID-kortet skickas (kan tas bort sen)
        console.log("SKICKAR ID-KORT (Token):", token.substring(0, 10) + "...");

        const newInit: RequestInit = { 
            ...init,
            headers: headers
        };

        return fetch(url, newInit);
    }
}

// Determine the Cloud Function URL based on the Firebase Project ID
const cloudRegion = 'us-central1';
const baseUrl = `https://${cloudRegion}-${firebaseConfig.projectId}.cloudfunctions.net/geminiApiProxy`;

export const ai = new GoogleGenAI({ 
  apiKey: "proxy-key", // The actual key is injected securely by the backend
  httpOptions: {
      baseUrl: baseUrl,
      fetch: ProxyFetch.fetch
  }
});

export interface AIDataForMorningBriefing {
  userProfile: UserProfileData;
  summary: PastDaySummary;
  currentStreak: number;
  yesterdayMeals?: any[];
  yesterdayBootcampReport?: any;
  activeBootcamp?: any;
  pastDaysSummary?: PastDaySummary[];
  weightLogs?: WeightLogEntry[];
}

export const generateGrowthEngineMessage = async (context: string, userNames: string[]): Promise<string> => {
  const prompt = `Du är en professionell och peppande hälsocoach. Din uppgift är att skriva ett utkast till ett direktmeddelande som ska skickas till en eller flera medlemmar i din app.

Kontext för meddelandet: "${context}"
Mottagare (namn): ${userNames.join(', ')}

Instruktioner:
1. Skriv ett kort, personligt och engagerande meddelande på SVENSKA.
2. Om det är flera mottagare, skriv det så att det passar att skickas till var och en individuellt (t.ex. "Hej [Namn]!"). Använd platshållaren [Namn] om det är flera, annars använd personens namn direkt om det bara är en.
3. Håll det kort (max 3-4 meningar).
4. Tonen ska vara uppmuntrande, stöttande och inte dömande.
5. Avsluta med en öppen fråga eller en enkel uppmaning (call to action).

Svara ENDAST med själva meddelandetexten, inga kommentarer eller extra text.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });
    
    const text = response.text;
    if (!text || text.trim().length === 0) {
        throw new Error("Empty response from AI");
    }
    return text.trim();
  } catch (error) {
    console.error("Error generating growth engine message:", error);
    return `Hej! Jag ville bara kika in och se hur det går för dig. Säg till om du behöver någon hjälp eller pepp!`;
  }
};

export const generateCommunityPost = async (context: string): Promise<string> => {
  const prompt = `Du är en professionell och peppande hälsocoach. Din uppgift är att skriva ett utkast till ett inlägg i appens community för att driva engagemang.

Kontext för inlägget: "${context}"

Instruktioner:
1. Skriv ett engagerande och peppande inlägg på SVENSKA.
2. Inlägget ska uppmuntra till diskussion och interaktion (t.ex. ställ en fråga, be om tips, skapa en omröstning i textform).
3. Håll det lagom långt (ca 3-5 meningar).
4. Tonen ska vara inbjudande och positiv.

Svara ENDAST med själva inläggstexten, inga kommentarer eller extra text.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });
    
    const text = response.text;
    if (!text || text.trim().length === 0) {
        throw new Error("Empty response from AI");
    }
    return text.trim();
  } catch (error) {
    console.error("Error generating community post:", error);
    return `Hej allihopa! Hur går det med era mål den här veckan? Dela gärna med er av era bästa tips för att hålla motivationen uppe! 👇`;
  }
};

export const generateBorjePost = async (brief: string): Promise<string> => {
  const prompt = `Du är General Börje, en tuff men rättvis militär hälsocoach i appen Kostloggen.
Din persona: Du är rak på sak, använder militär jargong (truppen, givakt, framåt marsch, pannben), men bryr dig genuint om dina rekryter. Du daltar inte.

VIKTIGT: General Börjes Bootcamp har INGA lektioner. Prata ALDRIG om lektioner, moduler eller kursmaterial. Bootcampen bygger enbart på dagliga kvällsrapporter, invägningar, faser och disciplin.

Din uppgift är att skriva ett inlägg till truppen (communityt) baserat på följande instruktion/brief från en administratör:
"${brief}"

Instruktioner:
1. Skriv ett engagerande inlägg på SVENSKA som General Börje.
2. Inlägget ska låta som att det kommer direkt från General Börje.
3. Håll det lagom långt (ca 3-6 meningar).
4. Avsluta gärna med en uppmaning eller fråga till truppen.

Svara ENDAST med själva inläggstexten, inga kommentarer eller extra text. Börja INTE med /general.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });
    
    const text = response.text;
    if (!text || text.trim().length === 0) {
        throw new Error("Empty response from AI");
    }
    return text.trim();
  } catch (error) {
    console.error("Error generating Borje post:", error);
    throw new Error("Kunde inte generera inlägg just nu.");
  }
};

export const getMorningBriefingText = async (data: AIDataForMorningBriefing): Promise<string> => {
  const { userProfile, summary, currentStreak, yesterdayBootcampReport, activeBootcamp, pastDaysSummary, weightLogs } = data;
  const style = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[style] || COACH_PERSONAS['balanced'];
  const name = userProfile.name || 'du';

  let bootcampContext = '';
  let missingReportInstruction = '';

  if (activeBootcamp) {
    const currentBootcampStreak = activeBootcamp.currentStreak || 0;
    
    // Check if the bootcamp starts today or in the future
    const startDateStr = activeBootcamp.startDate || activeBootcamp.fas1StartDate;
    const isWaitroom = startDateStr && new Date(startDateStr).getTime() > Date.now();
    const isStartingToday = startDateStr && new Date(startDateStr).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

    if (isWaitroom) {
      bootcampContext = `
PÅGÅENDE BOOTCAMP:
- Användaren är anmäld till en Bootcamp, men den har INTE STARTAT ÄN (startar ${startDateStr}).
- Användaren befinner sig i "Väntrummet".
- VIKTIGT: Nämn INTE några bootcamp-krav, kvällsrapporter eller misslyckanden. Peppa bara inför starten!`;
      missingReportInstruction = '';
    } else if (isStartingToday) {
      bootcampContext = `
PÅGÅENDE BOOTCAMP:
- BOOTCAMPEN STARTAR IDAG! (${startDateStr}).
- VIKTIGT: Ignorera helt vad användaren gjorde igår (de var i väntrummet). Var extremt peppande och taggad på att Bootcampen drar igång IDAG!`;
      missingReportInstruction = '';
    } else {
      if (activeBootcamp.status === 'fas1') {
        bootcampContext = `
PÅGÅENDE BOOTCAMP (FAS 1):
- Användaren har klarat ${currentBootcampStreak} av 14 dagar i rad i Fas 1 av en intensiv Bootcamp.`;
      } else {
        const daysElapsed = Math.floor((Date.now() - new Date(activeBootcamp.originalStartDate || activeBootcamp.fas1StartDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        bootcampContext = `
PÅGÅENDE BOOTCAMP (FAS 2):
- Användaren är på dag ${daysElapsed} av 84 i en intensiv Bootcamp (Fas 2). Nuvarande streak är ${currentBootcampStreak} dagar i rad.`;
      }

      if (!yesterdayBootcampReport) {
        bootcampContext += `\n- STATUS IGÅR: KATASTROF! Användaren har INTE fyllt i sin obligatoriska kvällsrapport för bootcampen.`;
        missingReportInstruction = `\n7. BOOTCAMP-VARNING: Eftersom användaren missade kvällsrapporten igår är dagen just nu UNDERKÄND i bootcampen. Du MÅSTE påpeka detta tydligt (enligt din persona). Beröm INTE gårdagen som en bootcamp-succé. Påminn om att kvällsrapporten är obligatorisk, men nämn att det går att fylla i den i efterhand för att rädda dagen!`;
      } else {
        bootcampContext += `\n- Uppmärksamma detta och peppa dem att hålla i under denna tuffa period!`;
      }
    }
  }

  // Calculate 7-day summary
  let recentContext = '';
  if (pastDaysSummary && pastDaysSummary.length > 0) {
    const last7Days = pastDaysSummary.slice(-7);
    const totalConsumed = last7Days.reduce((sum, day) => sum + day.consumedCalories, 0);
    const totalGoal = last7Days.reduce((sum, day) => sum + day.calorieGoal, 0);
    const avgConsumed = totalConsumed / last7Days.length;
    const avgGoal = totalGoal / last7Days.length;
    
    // Check if user has been good (consumed <= goal + small buffer)
    const hasBeenGood = avgConsumed <= avgGoal + 50;

    // Check weight and fat changes
    let weightChangeStr = '';
    let weightChange = 0;
    let fatChangeStr = '';
    let fatChange = 0;
    let isFatChangePrioritized = false;

    if (weightLogs && weightLogs.length >= 2) {
      const sortedLogs = [...weightLogs].sort((a, b) => b.loggedAt - a.loggedAt);
      const latestLog = sortedLogs[0];
      const previousLog = sortedLogs[1];
      
      const now = Date.now();
      const hoursSinceMeasurement = (now - latestLog.loggedAt) / (1000 * 60 * 60);
      
      // Only include weight/measurement coaching if the measurement was made recently (e.g. yesterday or today)
      if (hoursSinceMeasurement <= 36) {
        weightChange = latestLog.weightKg - previousLog.weightKg;
        
        if (latestLog.bodyFatMassKg !== undefined && previousLog.bodyFatMassKg !== undefined) {
            fatChange = latestLog.bodyFatMassKg - previousLog.bodyFatMassKg;
            isFatChangePrioritized = true;

            if (fatChange < 0) {
                fatChangeStr = `tappat ${Math.abs(fatChange).toFixed(1)} kg fett sedan förra mätningen`;
            } else if (fatChange > 0) {
                fatChangeStr = `gått upp ${fatChange.toFixed(1)} kg fett sedan förra mätningen`;
            } else {
                fatChangeStr = `stått still i fettmassa sedan förra mätningen`;
            }
        }

        if (weightChange < 0) {
          weightChangeStr = `Gått ner ${Math.abs(weightChange).toFixed(1)} kg sedan förra mätningen.`;
        } else if (weightChange > 0) {
          weightChangeStr = `Gått upp ${weightChange.toFixed(1)} kg sedan förra mätningen.`;
        } else {
          weightChangeStr = `Stått still i vikt sedan förra mätningen.`;
        }
      }
    }

    recentContext = `
SENASTE 7 DAGARNA:
- Snittkalorier: ${avgConsumed.toFixed(0)} kcal (Mål: ${avgGoal.toFixed(0)} kcal)
- Har skött kosten: ${hasBeenGood ? 'JA' : 'NEJ'}
${weightChangeStr ? `- Viktutveckling: ${weightChangeStr}` : ''}
${fatChangeStr ? `- Fettmassa utveckling: ${fatChangeStr}` : ''}
`;

    const activeMetricSuccess = isFatChangePrioritized ? fatChange < 0 : weightChange < 0;
    const activeMetricLabel = isFatChangePrioritized ? "fettmassan" : "vågen";

    if (hasBeenGood && !activeMetricSuccess && weightChangeStr) {
      recentContext += `\nVIKTIG COACHING: Användaren har skött kosten perfekt de senaste 7 dagarna, men ${activeMetricLabel} står still eller går upp. Förklara att detta är normalt (vätska, stress, muskler) och peppa dem att inte ge upp.`;
    } else if (!hasBeenGood && !activeMetricSuccess && weightChangeStr) {
      recentContext += `\nVIKTIG COACHING: Användaren har INTE skött kosten de senaste 7 dagarna och ${activeMetricLabel} går upp/står still. Ge ärlig feedback. "Du får ut det du stoppar in."`;
    } else if (hasBeenGood && activeMetricSuccess && weightChangeStr) {
      recentContext += `\nVIKTIG COACHING: Användaren har skött kosten och minskat sin ${activeMetricLabel}! Ge massivt beröm och bekräfta att metoden fungerar.`;
    }

    if (isFatChangePrioritized && style === 'tough') {
        if (fatChange > 0) {
            recentContext += `\nVIKTIGT FÖR GENERALEN: Användaren har gått UPP i fett (+${fatChange.toFixed(1)} kg). Oavsett vad totalvikten visar, är detta underkänt! Ge svidande kritik på Generalens vis och kräv skärpning.`;
        } else if (fatChange < 0) {
            recentContext += `\nVIKTIGT FÖR GENERALEN: Användaren har gått NER i fett (-${Math.abs(fatChange).toFixed(1)} kg). Beröm detta kraftfullt! Även om totalvikten eventuellt har ökat (t.ex. muskler), så är fettförbränningen det som räknas.`;
        }
    }
  }

  const prompt = `Du är ${persona.label}, ${persona.roleTitle}.
Tonläge och instruktioner: ${persona.promptTone}

**NÄRINGS-LAGBOKEN (GÄLLER ALLA COACHER):**
Oavsett din persona, måste du ALLTID bedöma maten utifrån objektiv näringslära:
- Avokado, nötter, olivolja = Mycket bra (hälsosamma fetter).
- Ägg, kyckling, fisk, kvarg = Mycket bra (protein för mättnad och muskler).
- Grönsaker/Frukt = Mycket bra (vitaminer och fibrer).
- Pizza, godis, bakverk, snabbmat = Näringsfattigt/kaloririkt (okej ibland, men kalla det aldrig 'balanserat', 'optimalt' eller 'bra bränsle').

DEFINITIONER:
- Streak: Att logga mat. Hålls levande oavsett kalorimängd. Det är beviset på vanan att vara konsekvent.
- Mål: Att träffa rätt kalorimängd. Detta är dagens prestation.

Din uppgift är att ge en kort "morgonbriefing" baserat på gårdagens resultat.
Användaren heter ${name}.

SITUATION IGÅR:
- Mål uppfyllt: ${summary.goalMet ? 'JA' : 'NEJ'} (Intag: ${summary.consumedCalories.toFixed(0)} / Mål: ${summary.calorieGoal.toFixed(0)} kcal)
- Vattenmål uppfyllt: ${summary.waterGoalMet ? 'JA' : 'NEJ'}
- Streak-status: ${currentStreak > 0 ? `AKTIV (${currentStreak} dagar i rad). Användaren loggade igår!` : 'BRUTEN (0 dagar). Användaren loggade inte igår.'}
${yesterdayBootcampReport ? `
BOOTCAMP-RAPPORT IGÅR:
- Grön dag: ${yesterdayBootcampReport.isGreenDay ? 'JA' : 'NEJ'}
- Mående: ${yesterdayBootcampReport.mood}/10
- Tränat styrka: ${yesterdayBootcampReport.strengthTrained ? 'JA' : 'NEJ'}
- Steg: ${yesterdayBootcampReport.steps || 'Ej angivet'}
- Sömn: ${yesterdayBootcampReport.sleep ? yesterdayBootcampReport.sleep + ' timmar' : 'Ej angivet'}
- Kommentar till Generalen: "${yesterdayBootcampReport.comment || 'Ingen'}"
` : ''}
${bootcampContext}
${recentContext}

INSTRUKTIONER:
1. Ge en kort kommentar (max 2-3 meningar) om gårdagen.
2. VIKTIGT: Om 'Mål uppfyllt' är NEJ men 'Streak-status' är AKTIV: Beröm användaren tydligt för att hen ändå loggade och höll sin streak vid liv (det är det viktigaste beteendet!). Döm inte det missade målet, utan peppa mjukt att sikta på det idag istället.
3. Om både mål och streak är positiva, ge stort beröm enligt din persona.
4. Om streak är bruten, var uppmuntrande kring nystart idag.
5. Om användaren har skrivit en "Kommentar till Generalen", återkoppla på den!
6. Om det finns data för mående, steg och sömn från bootcamp-rapporten, ge kort, peppande eller stöttande feedback på dessa (t.ex. om sömnen var kort, peppa till vila. Om stegen var många, beröm!).
7. Avsluta med en kort uppmaning för idag.
8. Svara på SVENSKA.${missingReportInstruction}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });
    
    const text = response.text;
    if (!text || text.trim().length === 0) {
        throw new Error("Empty response from AI");
    }
    return text.trim();
  } catch (error) {
    console.error("Error generating morning briefing text:", error);
    return `God morgon ${name}! Hoppas du får en bra dag. Vi kör på!`;
  }
};

export const getMorningBriefingAudio = async (text: string, style: CoachStyle): Promise<string | null> => {
  const persona = COACH_PERSONAS[style] || COACH_PERSONAS['balanced'];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: persona.voice },
            },
        },
      },
    });

    // The response contains base64 encoded audio in candidates[0].content.parts[0].inlineData.data
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return audioData || null;

  } catch (error) {
    console.error("Error generating morning briefing audio:", error);
    return null;
  }
};

export const analyzeFoodImage = async (base64ImageData: string): Promise<NutritionalInfo> => {
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg', 
      data: base64ImageData,
    },
  };

  const textPart = {
    text: `Analysera maten på denna bild. Ditt mål är att ge en RIMLIG och TYPISK uppskattning av dess näringsinnehåll.
Identifiera den primära maträtten/livsmedlet.
Uppskatta det totala antalet kalorier.
Uppskatta makronutrientfördelningen i gram för protein, kolhydrater och fett.
Se till att alla makronutrienter (protein, kolhydrater, fett) beaktas. Om en makronutrient typiskt finns i den identifierade maten (t.ex. kolhydrater i bröd, fett i ost), bör den ha och värde som inte är noll. Undvik att mata ut noll för en makronutrient om den tydligt finns.

Svara ENDAST med ett enda JSON-objekt med följande nycklar:
"foodItem" (string, på SVENSKA, t.ex., "Pepperonipizzabit", "Kycklingsallad"),
"calories" (number),
"protein" (number),
"carbohydrates" (number),
"fat" (number).

Se till att alla näringsvärden är numeriska och representerar en rimlig näringsprofil för den synliga maten.
Till exempel, för en ostpizzabit: {"foodItem": "Ostpizzabit", "calories": 280, "protein": 12, "carbohydrates": 35, "fat": 10}
För en kycklingsallad: {"foodItem": "Kycklingsallad", "calories": 350, "protein": 30, "carbohydrates": 10, "fat": 20}`
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, 
      },
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No text response");
    
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr) as NutritionalInfo;

    if (typeof parsedData.calories !== 'number' ||
        typeof parsedData.protein !== 'number' ||
        typeof parsedData.carbohydrates !== 'number' ||
        typeof parsedData.fat !== 'number') {
      throw new Error("Invalid JSON structure received from API for image analysis. Missing or incorrect numeric types for nutritional info.");
    }
    
    parsedData.calories = Math.max(0, parsedData.calories);
    parsedData.protein = Math.max(0, parsedData.protein);
    parsedData.carbohydrates = Math.max(0, parsedData.carbohydrates);
    parsedData.fat = Math.max(0, parsedData.fat);

    return parsedData;

  } catch (error) {
    console.error("Error analyzing food image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Kunde inte analysera bilden: ${error.message}`);
    }
    throw new Error("Kunde inte analysera bilden på grund av ett okänt fel.");
  }
};


export const getNutritionalInfoForTextSearch = async (foodQuery: string): Promise<SearchedFoodInfo> => {
  const prompt = `Analysera sökfrågan för livsmedel: '${foodQuery}'. 
Ge typisk näringsinformation (kalorier, protein, kolhydrater, fett i gram) för en standardportion av detta livsmedel.
Beskriv vad som utgör standardportionen du använder för näringsinformationen.
Svara ENDAST med ett enda JSON-objekt med följande nycklar:
"foodItem" (string, på SVENSKA, t.ex., "Äpple, färskt", "Kokt vitt ris"),
"servingDescription" (string, på SVENSKA, t.ex., "1 medelstort (ca 182g)", "1 kopp kokt (ca 158g)"),
"calories" (number, för den beskrivna portionen),
"protein" (number, i gram, för den beskrivna portionen),
"carbohydrates" (number, i gram, för den beskrivna portionen),
"fat" (number, i gram, för den beskrivna portionen).

Se till att alla näringsvärden är numeriska och representerar en rimlig näringsprofil för standardportionen av livsmedlet. Om sökfrågan är tvetydig (t.ex. "läsk"), försök att välja ett vanligt exempel (t.ex. "Coladryck") eller ange antagandet i foodItem.
Exempel för "ett ägg": {"foodItem": "Stort ägg, kokat", "servingDescription": "1 stort (ca 50g)", "calories": 78, "protein": 6, "carbohydrates": 0.6, "fat": 5}
Exempel för "ett glas mjölk": {"foodItem": "Mjölk, 2% fett", "servingDescription": "1 glas (ca 240ml)", "calories": 122, "protein": 8, "carbohydrates": 12, "fat": 5}
Exempel för "öl": {"foodItem": "Öl, vanlig", "servingDescription": "1 burk (355ml)", "calories": 153, "protein": 1.6, "carbohydrates": 13, "fat": 0}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3, 
      },
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No text response");

    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr) as SearchedFoodInfo;

    if (typeof parsedData.foodItem !== 'string' ||
        typeof parsedData.servingDescription !== 'string' ||
        typeof parsedData.calories !== 'number' ||
        typeof parsedData.protein !== 'number' ||
        typeof parsedData.carbohydrates !== 'number' ||
        typeof parsedData.fat !== 'number') {
      console.error("Invalid JSON structure from text search API:", parsedData);
      throw new Error("Ogiltig JSON-struktur mottagen från API för textsökning. Saknade eller felaktiga typer.");
    }

    // Ensure all values are non-negative
    parsedData.calories = Math.max(0, parsedData.calories);
    parsedData.protein = Math.max(0, parsedData.protein);
    parsedData.carbohydrates = Math.max(0, parsedData.carbohydrates);
    parsedData.fat = Math.max(0, parsedData.fat);
    
    return parsedData;

  } catch (error) {
    console.error("Error getting nutritional info from text search with Gemini:", error);
     if (error instanceof Error) {
        throw new Error(`Kunde inte hämta näringsinformation: ${error.message}`);
    }
    throw new Error("Kunde inte hämta näringsinformation på grund av ett okänt fel.");
  }
};

export const getAIFeedback = async (data: AIDataForFeedback): Promise<string> => {
  const { userProfile, userGoals, userName, mentalWellbeing, isOnboarding } = data;
  
  const style = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[style] || COACH_PERSONAS['balanced'];
    
  const wellbeingDataString = `
- Stressnivå: ${mentalWellbeing.stressLevel || 'Ej angivet'} (1=hög, 5=låg)
- Energinivå: ${mentalWellbeing.energyLevel || 'Ej angivet'} (1=låg, 5=hög)
- Sömnkvalitet: ${mentalWellbeing.sleepQuality || 'Ej angivet'} (1=dålig, 5=bra)
- Humör: ${mentalWellbeing.mood || 'Ej angivet'} (1=dåligt, 5=bra)`;

  const contextPrompt = isOnboarding 
    ? `**Din Uppgift (Onboarding - ALLRA FÖRSTA HÄLSNINGEN):**
1.  Hälsa användaren välkommen till deras allra första dag. Använd hens namn (fältet "Namn").
2.  Bekräfta deras startpunkt (vikt, längd, ålder) och säg att det är en utmärkt grund.
3.  **VIKTIGT OM KALORIER:** Om användaren har ett väldigt högt BMI (fetma), nämn ödmjukt att standardformler bara är gissningar och att man kan behöva justera manuellt.
4.  **VIKTIGT OM VÄLBEFINNANDE (STRESS/SÖMN/ENERGI):** Om välbefinnande står som "Ej angivet", KOMMENTERA INTE detta som ett misslyckande eller slarv. Användaren har precis skapat kontot och hunnit inte logga än. Istället, förklara sakligt att mätning av sömn och stress kommer bli ett av deras viktigaste verktyg framöver i ditt program. Om de faktiskt angett värden, kommentera dem positivt.
5.  Analysera deras mål. Om data för fett/muskler saknas, fokusera på 'Önskad viktförändring' och använd 'Måltyp' för att förstå intentionen (t.ex. viktnedgång). Bekräfta att målet är tydligt även vid "Vanlig våg".
6.  Bedöm tidsplanen. En hållbar takt för fettminskning är ca 0.5-1% av kroppsvikten per vecka.
7.  Inkludera en kommentar om proteinintaget (ca 1.5-2.0g per kg kroppsvikt).
8.  Avsluta med en fråga om de är redo att logga sin första måltid.`
    : `**Din Uppgift (Mål uppdaterat):**
1.  Börja med en positiv bekräftelse på att målet är uppdaterat.
2.  Kommentera deras nuvarande välbefinnande i relation till det nya målet.
3.  Ge en kort, positiv kommentar om det nya målet.
4.  Ge ett konkret, litet tips som är kopplat till det nya målet.
5.  Avsluta med en kort, peppande fras.`;

  const fullPrompt = `Du är ${persona.label}, ${persona.roleTitle} i appen Kostloggen.se.
Din persona: ${persona.promptTone}
Ge feedback på SVENSKA.

**NÄRINGS-LAGBOKEN (GÄLLER ALLA COACHER):**
Oavsett din persona, måste du ALLTID bedöma maten utifrån objektiv näringslära:
- Avokado, nötter, olivolja = Mycket bra (hälsosamma fetter).
- Ägg, kyckling, fisk, kvarg = Mycket bra (protein för mättnad och muskler).
- Grönsaker/Frukt = Mycket bra (vitaminer och fibrer).
- Pizza, godis, bakverk, snabbmat = Näringsfattigt/kaloririkt (okej ibland, men kalla det aldrig 'balanserat', 'optimalt' eller 'bra bränsle').

**Användarens Status:**
- Namn: ${userName || 'Användare'}
- Startvikt: ${userProfile.currentWeightKg} kg
- Längd: ${userProfile.heightCm} cm
- Ålder: ${userProfile.ageYears} år
- Måltyp: ${userProfile.goalType}
- Önskad viktförändring (total): ${userProfile.desiredWeightChangeKg || 0} kg
- Önskad fettförändring: ${userProfile.desiredFatMassChangeKg || 0} kg
- Önskad muskelförändring: ${userProfile.desiredMuscleMassChangeKg || 0} kg
- Måldatum: ${userProfile.goalCompletionDate || 'Ej specificerat'}
- Rekommenderat dagligt kaloriintag: ${userGoals.calorieGoal.toFixed(0)} kcal
- Rekommenderat dagligt proteinintag: ${userGoals.proteinGoal.toFixed(0)} g
- Välbefinnande just nu: ${wellbeingDataString}

${contextPrompt}

**VIKTIGA REGLER:**
1.  **Fatta dig extremt kortfattat.** Ge en snabb analys, en slutsats och ett konkret råd. Undvik långa utläggningar.
2.  Använd din specifika ton (${persona.label}). Använd Markdown för att formatera dina svar med fetstil (**text**) och punktlistor (* punkt).
3.  **INGET SKÄLL VID ONBOARDING:** Om detta är onboarding (dag 1), var aldrig dömande kring saknad historisk data (sömn/stress/energi).

**TILLGÄNGLIG DATA (ANVÄND ENLIGT REGLERNA OVAN):**
- **Profil & Mål:** ${JSON.stringify(userProfile)}
- **Streak:** ${data.currentStreak} dagar
`;
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: fullPrompt,
      config: {
        temperature: 0.7, 
        topP: 0.9,
        topK: 40,
      },
    });

    return response.text?.trim() || "Kunde inte generera svar.";

  } catch (error) {
    console.error("Error getting feedback from Coach from Gemini:", error);
    if (error instanceof Error) {
      if (error.message.includes('500') || error.message.toLowerCase().includes('internal')) {
        throw new Error(`${persona.label} har stött på ett tekniskt problem och kan inte svara just nu. Vänligen försök igen om en liten stund.`);
      }
      throw new Error(`Kunde inte hämta feedback från ${persona.label}: ${error.message}`);
    }
    throw new Error(`Kunde inte hämta feedback från ${persona.label} på grund av ett okänt fel.`);
  }
};


export const getRecipeSuggestion = async (recipeQuery: string): Promise<RecipeSuggestion> => {
  const prompt = `Du är en expert receptassistent. Användaren kommer att be om ett recept.
Ge ett recept baserat på deras fråga.
Ditt svar MÅSTE vara ett enda JSON-objekt med följande struktur:
{
  "title": "Recepttitel (sträng, SVENSKA)",
  "description": "Kort beskrivning av receptet (sträng, SVENSKA, 1-2 meningar)",
  "prepTime": "Uppskattad förberedelsetid (sträng, t.ex. '15 minuter', SVENSKA)",
  "cookTime": "Uppskattad tillagningstid (sträng, t.ex. '30 minuter', SVENSKA)",
  "servings": "Uppskattat antal portioner (sträng, t.ex. '4 portioner', SVENSKA)",
  "ingredients": [
    { "item": "Fullständig ingredienssträng inklusive mängd och enhet (t.ex. '2 st kycklingfiléer, ca 300g totalt', '1 msk olivolja')" }
  ],
  "instructions": [
    "Instruktion 1...",
    "Instruktion 2..."
  ],
  "totalNutritionalInfo": {
    "calories": number,
    "protein": number,
    "carbohydrates": number,
    "fat": number,
    "foodItem": "Samma som title (sträng)"
  },
  "chefTip": "Valfritt: Ett hjälpsamt tips eller variation (sträng, SVENSKA)"
}

Om användarens fråga är för vag eller inte receptliknande (t.ex. 'hej'), svara med en felstruktur:
{ "error": "Din fråga verkar inte vara en receptförfrågan. Försök igen med mer detaljer, t.ex. 'lätt kycklingpasta'." }

Prioritera vanliga, rimligt hälsosamma recept om inte användaren anger annat.
Se till att alla mängder och enheter i ingredienser är tydliga och på svenska där det är lämpligt.
Se till att instruktionerna är tydliga och lätta att följa.
Näringsinformationen är en UPPSKATTNING per PORTION. foodItem i totalNutritionalInfo ska vara samma som receptets titel.
Om någon del av näringsinformationen inte rimligen kan uppskattas, ange värdet 0 för den specifika näringsämnet, men försök uppskatta alla.
Användarens fråga: "${recipeQuery}"`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.5, 
      },
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No text response");

    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr) as RecipeSuggestion;

    if (parsedData.error) {
        return parsedData; // Return error structure as is
    }
    
    // Validate main recipe structure (basic check)
    if (typeof parsedData.title !== 'string' || 
        !Array.isArray(parsedData.ingredients) || 
        !Array.isArray(parsedData.instructions) ||
        typeof parsedData.totalNutritionalInfo !== 'object' ||
        parsedData.totalNutritionalInfo === null ||
        typeof parsedData.totalNutritionalInfo.calories !== 'number'
    ) {
      console.error("Invalid recipe JSON structure from API:", parsedData);
      throw new Error("Ogiltig JSON-struktur mottagen från API för receptsökning.");
    }
    
    // Ensure totalNutritionalInfo.foodItem is set
    if (!parsedData.totalNutritionalInfo.foodItem) {
        parsedData.totalNutritionalInfo.foodItem = parsedData.title;
    }


    return parsedData;

  } catch (error) {
    console.error("Error getting recipe suggestion from Gemini:", error);
     if (error instanceof Error) {
        throw new Error(`Kunde inte hämta receptförslag: ${error.message}`);
    }
    throw new Error("Kunde inte hämta receptförslag på grund av ett okänt fel.");
  }
};


export const getRecipesFromIngredientsImage = async (base64ImageDatas: string[]): Promise<IngredientRecipeResponse> => {
  if (base64ImageDatas.length === 0) {
    return { identifiedIngredients: [], recipeSuggestions: [] };
  }

  const imageParts = base64ImageDatas.map(data => ({
    inlineData: { mimeType: 'image/jpeg', data },
  }));

  const promptTextPart = {
    text: `Du är en hjälpsam matlagningsassistent. Användaren har tillhandahållit bilder på ingredienser de har.
1.  Identifiera först alla distinkta livsmedel från dessa bilder och lista dem.
2.  Baserat ENDAST på de identifierade ingredienserna (prioritera att använda så många som möjligt), föreslå 1-3 recept.
3.  För varje recept, tillhandahåll: titel, kort beskrivning, förberedelsetid, tillagningstid, antal portioner, ingredienslista (som bör vara en delmängd av eller nära relaterad till identifierade varor OCH vanliga skafferivaror som salt, peppar, olja om det behövs), instruktioner och uppskattad total näringsinformation (kalorier, protein, kolhydrater, fett) för varje recept.
4.  Om väldigt få eller okombinerbara ingredienser hittas, ange det och föreslå att man lägger till fler vanliga varor.
5.  Om inga ingredienser kan identifieras, returnera tomma arrayer.
6.  Svara i JSON-format. JSON-objektet på toppnivå ska ha två nycklar: 'identifiedIngredients' (en array av strängar) och 'recipeSuggestions' (en array av receptobjekt, var och en som matchar RecipeSuggestion-strukturen).
7.  För receptingredienser, lista endast varor som antingen är direkt identifierade eller mycket vanliga skafferivaror om det är absolut nödvändigt för receptet.
8.  Se till att 'foodItem' i totalNutritionalInfo for varje recept alltid är receptets titel. Näringsinformationen ska vara en UPPSKATTNING per PORTION.

JSON-struktur för varje recept i 'recipeSuggestions':
{
  "title": "Recepttitel (sträng, SVENSKA)",
  "description": "Kort beskrivning av receptet (sträng, SVENSKA, 1-2 meningar)",
  "prepTime": "Uppskattad förberedelsetid (sträng, t.ex. '15 minuter', SVENSKA)",
  "cookTime": "Uppskattad tillagningstid (sträng, t.ex. '30 minuter', SVENSKA)",
  "servings": "Uppskattat antal portioner (sträng, t.ex. '4 portioner', SVENSKA)",
  "ingredients": [ { "item": "Fullständig ingredienssträng..." } ],
  "instructions": [ "Instruktion 1...", "Instruktion 2..." ],
  "totalNutritionalInfo": { "calories": number, "protein": number, "carbohydrates": number, "fat": number, "foodItem": "Samma som title (sträng)" },
  "chefTip": "Valfritt: Ett hjälpsamt tips eller variation (sträng, SVENSKA)"
}
`
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: { parts: [...imageParts, promptTextPart] },
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No text response");

    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr) as IngredientRecipeResponse;

    if (!parsedData || !Array.isArray(parsedData.identifiedIngredients) || !Array.isArray(parsedData.recipeSuggestions)) {
        console.error("Invalid JSON structure from ingredient to recipe API:", parsedData);
        throw new Error("Ogiltig JSON-struktur mottagen från API för ingrediensanalys.");
    }
    
    // Validate nested RecipeSuggestion structure (basic check for critical fields)
    parsedData.recipeSuggestions.forEach(recipe => {
        if (typeof recipe.title !== 'string' || 
            !Array.isArray(recipe.ingredients) || 
            !Array.isArray(recipe.instructions) ||
            typeof recipe.totalNutritionalInfo !== 'object' ||
            recipe.totalNutritionalInfo === null ||
            typeof recipe.totalNutritionalInfo.calories !== 'number'
        ) {
            console.error("Invalid RecipeSuggestion structure within response:", recipe);
            throw new Error("Ogiltig receptstruktur inuti JSON-svar från ingrediensanalys.");
        }
        if (!recipe.totalNutritionalInfo.foodItem) {
            recipe.totalNutritionalInfo.foodItem = recipe.title;
        }
    });

    return parsedData;

  } catch (error) {
    console.error("Error getting recipes from ingredients image with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(`Kunde inte generera recept från bilder: ${error.message}`);
    }
    throw new Error("Kunde inte generera recept från bilder på grund av ett okänt fel.");
  }
};

export const getAICoachResponseStream = async (
  question: string,
  chatHistory: Content[],
  context: AIDataForJourneyAnalysis
) => {
  const { userProfile, goals, allWeightLogs, last30DaysSummaries, mentalWellbeingLogs, currentStreak, goalTimeline } = context;

  const formattedWeightLogsForAI = allWeightLogs.map(log => ({
    date: new Date(log.loggedAt).toISOString().split('T')[0],
    weightKg: log.weightKg,
    skeletalMuscleMassKg: log.skeletalMuscleMassKg ?? null,
    bodyFatMassKg: log.bodyFatMassKg ?? null,
  }));

  const formattedDailySummariesForAI = last30DaysSummaries.map(s => ({
    date: s.date,
    consumedCalories: s.consumedCalories,
    consumedProtein: s.consumedProtein,
    consumedCarbohydrates: s.consumedCarbohydrates,
    consumedFat: s.consumedFat,
    proteinGoalMet: s.proteinGoalMet,
  })).slice(0, 30);

  const style = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[style] || COACH_PERSONAS['balanced'];

  const systemInstruction = `Du är ${persona.label}, ${persona.roleTitle} i appen Kostloggen.
Din persona är: ${persona.promptTone}.

Användarens namn är ${userProfile.name || 'användaren'}. Din uppgift är att analysera användarens loggade data och svara tydligt och personligt enligt din persona. Svara alltid på SVENSKA.

**VIKTIGA REGLER FOR TEXT-SVAR:**
1.  **Fatta dig extremt kortfattat.** Ge en snabb analys, en slutsats och ett konkret råd. Undvik långa utläggningar.
2.  Anpassa din ton efter din persona (${persona.label}). Använd Markdown för att formatera dina svar med fetstil (**text**) och punktlistor (* punkt).
3.  **VIKTIGT OM KALORIER:** Standardformler för kaloribehov kan överskatta behovet kraftigt för personer med högt BMI/fetma. Om användaren har högt BMI, var ödmjuk inför att de beräknade målen kan vara för höga. Föreslå att de känner efter mättnad och justerar målen manuellt i profilen om vikten står stilla. Kroppen är alltid facit, formeln är bara en gissning.
4.  **NÄRINGS-LAGBOKEN (GÄLLER ALLA COACHER):** Oavsett din persona, måste du ALLTID bedöma maten utifrån objektiv näringslära:
    - Avokado, nötter, olivolja = Mycket bra (hälsosamma fetter).
    - Ägg, kyckling, fisk, kvarg = Mycket bra (protein för mättnad och muskler).
    - Grönsaker/Frukt = Mycket bra (vitaminer och fibrer).
    - Pizza, godis, bakverk, snabbmat = Näringsfattigt/kaloririkt (okej ibland, men kalla det aldrig 'balanserat', 'optimalt' eller 'bra bränsle').

**ANVÄNDARENS AKTUELLA KONTEXT:**
${context.activeBootcamp ? `- Användaren deltar just nu i General Börjes Bootcamp (Fas: ${context.activeBootcamp.status}, Streak: ${context.activeBootcamp.currentStreak} dagar). VIKTIGT: Bootcampen har INGA lektioner. Prata aldrig om lektioner i samband med bootcampen.` : ''}
${context.recentBootcampReports && context.recentBootcampReports.length > 0 ? `- Senaste kvällsrapport (Bootcamp): Mående ${context.recentBootcampReports[0].mood}/10, Styrketräning: ${context.recentBootcampReports[0].strengthTrained ? 'Ja' : 'Nej'}, Grön dag: ${context.recentBootcampReports[0].isGreenDay ? 'Ja' : 'Nej'}.` : ''}
${context.userCourseProgress ? `- Användaren har tillgång till kurser (separat från bootcampen). Uppmuntra dem att läsa lektioner i kurserna om de har frågor om kost eller träning.` : ''}

**REGLER FOR GRAF-SVAR:**
1.  **Identifiera Graf-förfrågan:** Om användaren frågar efter en graf, ett diagram eller en kurva (t.ex. "visa min viktkurva", "gör en graf över proteinintag"), MÅSTE du svara med ENDAST ett giltigt JSON-objekt. Inkludera ingen annan text, inga hälsningar eller markdown-kodstängsel.
2.  **VÄLJ RÄTT DATAKÄLLA (VIKTIGAST!):**
    *   Om frågan handlar om **vikt, muskler, fettmassa**, använd EXKLUSIVT data från **Viktloggar**.
    *   Om frågan handlar om **protein, kalorier, kolhydrater, fettintag**, använd EXKLUSIVT data från **Dagliga Summeringar**.
    *   Blanda ALDRIG dessa datakällor. Om du är osäker, välj den som bäst matchar nyckelorden i frågan.
3.  **JSON-Struktur:** Följ exakt denna struktur:
    {
      "chartType": "line",
      "title": "En beskrivande titel för grafen på svenska",
      "labels": ["en array av sträng-etiketter för x-axeln, t.ex. datum"],
      "datasets": [
        {
          "label": "Etikett för dataserien (t.ex. 'Vikt (kg)')",
          "data": [en array av siffror eller null, korresponderande mot etiketterna]
        }
      ]
    }
4.  **Visa All Data:** Inkludera ALLA tillgängliga datapunkter från den valda datakällan. Summera, aggregera eller förenkla INTE datan. Om ingen tidsram anges, använd all tillgänglig data.
5.  **Formatering:**
    *   Använd ALLTID \`datasets\`-arrayen, även om det bara är en dataserie.
    *   Använd \`null\` för saknade datapunkter.
    *   Formatera datum i \`labels\` som 'dd/mm'.

**Exempel 1 (Vikt):** Fråga: "visa min vikt" -> Använd **Viktloggar**.
**JSON-svar:**
{
  "chartType": "line",
  "title": "Viktutveckling",
  "labels": ["23/07", "30/07", "06/08"],
  "datasets": [ { "label": "Vikt (kg)", "data": [75.8, 75.2, 74.9] } ]
}

**Exempel 2 (Protein):** Fråga: "Hur ser mitt proteinintag ut?" -> Använd **Dagliga Summeringar**.
**JSON-svar:**
{
  "chartType": "line",
  "title": "Proteinintag",
  "labels": ["01/08", "02/08", "03/08", "04/08", "05/08"],
  "datasets": [ { "label": "Protein (g)", "data": [150, 145, 160, 130, 155] } ]
}

Om användaren ställer en allmän fråga, svara med text som vanligt enligt "VIKTIGA REGLER FOR TEXT-SVAR".

**TILLGÄNGLIG DATA (ANVÄND ENLIGT REGLERNA OVAN):**
- **Profil:** ${JSON.stringify(userProfile)}
- **Aktuella Mål (VIKTIGT: Använd dessa mål för kalorier och protein):** ${JSON.stringify(goals)}
- **Måltidslinje & Milstolpar:** ${JSON.stringify(goalTimeline)}
- **Streak:** ${currentStreak} dagar
- **Viktloggar (ENDAST för vikt, muskler, fett):** ${JSON.stringify(formattedWeightLogsForAI)}
- **Dagliga Summeringar (ENDAST för protein, kalorier, etc.):** ${JSON.stringify(formattedDailySummariesForAI)}
- **Välbefinnandeloggar:** ${JSON.stringify(mentalWellbeingLogs)}
`;

  const contents = [
    ...chatHistory,
    { role: 'user', parts: [{ text: question }] }
  ] as Content[];

  const responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODEL_NAME_TEXT,
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
      topK: 40,
      topP: 0.95
    }
  });

  return responseStream;
};


export const getAIPersonalizedLessonIntro = async (
  hint: 'challenges' | 'plateau',
  data: AIDataForLessonIntro
): Promise<string> => {
  let analysisPrompt = '';

  switch (hint) {
    case 'challenges':
      const last7DaysSummaryText = (data.pastDaysSummary || [])
        .slice(0, 7)
        .map(s => `- ${s.date}: ${s.goalMet ? 'Mål uppnått' : 'Mål ej uppnått'} (Intag: ${s.consumedCalories.toFixed(0)} kcal)`)
        .join('\n');
        
      analysisPrompt = `
**Analyskontext:** Användaren, ${data.userName || 'användaren'}, ska precis börja lektionen "${data.lessonTitle}". Analysera deras matloggar for de senaste 7 dagarna for att hitta mönster i utmaningar.
**Senaste 7 dagarnas logg:**
${last7DaysSummaryText || "Inga loggar de senaste 7 dagarna."}

**Din uppgift:**
Skriv en kort (1-2 meningar), uppmuntrande och personlig inledning till lektionen. 
*   Om du ser ett mönster (t.ex. svårare på helger), nämn det på ett positivt och normaliserande sätt. Exempel: "Jag ser att helgerna kan vara lite extra utmanande, vilket är helt normalt. Den här lektionen kommer att ge dig verktyg for just sådana situationer."
*   Om inget tydligt mönster finns, ge en allmänt peppande inledning som är relevant for lektionens tema om att hantera utmaningar. Exempel: "Alla resor har sina utmaningar. Den här lektionen fokuserar på hur du kan hantera dem på bästa sätt."
*   Använd en vänlig och stöttande ton. Börja INTE med "Hej".`;
      break;

    case 'plateau':
      const last5WeightLogsText = (data.weightLogs || [])
        .slice(-5)
        .map(w => `- ${new Date(w.loggedAt).toLocaleDateString('sv-SE')}: ${w.weightKg.toFixed(1)} kg`)
        .join('\n');
        
      analysisPrompt = `
**Analyskontext:** Användaren, ${data.userName || 'användaren'}, ska precis börja lektionen "${data.lessonTitle}". Analysera hens senaste 5 viktloggar for att se om det finns en platå. En platå kan anses vara om de senaste 2-3 mätningarna har en väldigt liten förändring (mindre än 0.2 kg totalt).
**Senaste 5 viktloggarna:**
${last5WeightLogsText || "Inga viktloggar finns."}

**Din uppgift:**
Skriv en kort (1-2 meningar), uppmuntrande och personlig inledning till lektionen.
*   Om du ser tecken på en platå, bekräfta det på ett normaliserande sätt. Exempel: "Det ser ut som att din vikt har stabiliserat sig de senaste mätningarna, vilket är en helt naturlig del av resan. Denna lektion är designad for att ge dig ny fart!"
*   Om vikten fortfarande har en tydlig trend (upp eller ner), bekräfta de goda framstegen istället. Exempel: "Vilka fina framsteg du gör! Den här lektionen hjälper dig att fortsätta den positiva trenden och undvika platåer."
*   Använd en vänlig och stöttande ton. Börja INTE med "Hej".`;
      break;
    default:
      return Promise.resolve(""); // No hint, no intro
  }
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: analysisPrompt,
      config: {
        temperature: 0.6,
        topP: 0.95,
      },
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error(`Error getting AI personalized intro for hint '${hint}':`, error);
    // Return empty string on failure to allow fallback to static content
    return ""; 
  }
};

const getUserLevelInfo = (streak: number): { currentLevel: Level } => {
  let currentLevel: Level = LEVEL_DEFINITIONS[0];

  for (let i = LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (streak >= LEVEL_DEFINITIONS[i].requiredStreak) {
      currentLevel = LEVEL_DEFINITIONS[i];
      break;
    }
  }
  return { currentLevel };
};

export const getDetailedJourneyAnalysis = async (data: AIDataForJourneyAnalysis): Promise<AIStructuredFeedbackResponse> => {
    const { userProfile, goals, allWeightLogs, last30DaysSummaries, mentalWellbeingLogs, currentStreak, goalTimeline } = data;

    // --- PLATEAU DETECTION ---
    let plateauPromptPart = "";
    if (allWeightLogs.length >= 2) {
        const lastLog = allWeightLogs[allWeightLogs.length - 1];
        const previousLog = allWeightLogs[allWeightLogs.length - 2];
        const timeDiff = lastLog.loggedAt - previousLog.loggedAt;
        const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;

        if (timeDiff >= sevenDaysInMillis) {
            const weightChange = lastLog.weightKg - previousLog.weightKg;
            let isPlateau = false;
            if (userProfile.goalType === 'lose_fat' && weightChange >= -0.1) {
                isPlateau = true;
            } else if (userProfile.goalType === 'gain_muscle' && weightChange <= 0.1) {
                isPlateau = true;
            }

            if (isPlateau) {
                const startDate = new Date(previousLog.loggedAt).toISOString().split('T')[0];
                const endDate = new Date(lastLog.loggedAt).toISOString().split('T')[0];
                const summariesInPeriod = last30DaysSummaries.filter(s => s.date >= startDate && s.date < endDate);
                const totalDaysInPeriod = summariesInPeriod.length;

                if (totalDaysInPeriod > 0) {
                    const successfulDays = summariesInPeriod.filter(s => s.goalMet || s.savedBy).length;
                    const adherence = successfulDays / totalDaysInPeriod;
                    
                    if (adherence >= 0.7) { // High adherence
                        plateauPromptPart = `
**VIKTIGT: Platå upptäckt!**
Användaren har varit duktig och följt sin plan (hög följsamhet och en streak på ${currentStreak} dagar) men vikten har stagnerat sedan förra mätningen.
I sektionen "Rekommendationer framåt", inkludera en empatisk och proaktiv coachning.
1. Börja med att berömma deras ansträngning och normalisera platån (t.ex. "Jag ser att vikten stått stilla trots ditt fantastiska engagemang. Det är helt normalt!").
2. Ställ forsiktigt två frågor for att uppmuntra till självreflektion:
   - Fråga om loggningens noggrannhet (t.ex. "Ibland är det lätt att glömma småsaker som olja eller såser. Känner du att loggen fångar upp precis allt?").
   - Fråga om aktivitetsnivån fortfarande stämmer (t.ex. "En annan vanlig anledning är att aktivitetsnivån ändrats. Känns din inställning '${userProfile.activityLevel}' fortfarande rätt? Du kan enkelt justera den under 'Min Resa' -> 'Mål'.").
   - **Tillägg for högt BMI:** Om användaren har högt BMI, foreslå att de manuellt sänker sitt kalorimål något om de står stilla trots att de foljer det beräknade målet. Standardformler kan overskatta behovet.
3. Avsluta med att uppmuntra dem att justera om det behovs och att du finns där for att hjälpa.
`;
                    }
                }
            }
        }
    }

    // --- ANALYSIS WINDOW LOGIC & NUTRITIONAL SUMMARY ---
    let analysisPeriodSummaries: PastDaySummary[] = [];
    let analysisPeriodDescription = "den senaste tiden";
    let previousLog: WeightLogEntry | null = null;
    let weightChangeSincePrevious = 0;

    if (allWeightLogs.length >= 2) {
        const lastLog = allWeightLogs[allWeightLogs.length - 1];
        previousLog = allWeightLogs[allWeightLogs.length - 2];
        const startDate = new Date(previousLog.loggedAt).toISOString().split('T')[0];
        const endDate = new Date(lastLog.loggedAt).toISOString().split('T')[0];
        analysisPeriodSummaries = last30DaysSummaries.filter(s => s.date >= startDate && s.date < endDate);
        analysisPeriodDescription = `perioden mellan dina två senaste mätningar (${new Date(startDate + 'T12:00:00Z').toLocaleDateString('sv-SE')} och ${new Date(endDate + 'T12:00:00Z').toLocaleDateString('sv-SE')})`;
        weightChangeSincePrevious = lastLog.weightKg - previousLog.weightKg;
    } else {
        // Fallback for first measurement or if only one exists
        analysisPeriodSummaries = last30DaysSummaries;
        analysisPeriodDescription = `perioden sedan din forsta mätning`;
        if (allWeightLogs.length === 1 && userProfile.goalStartWeight) {
            weightChangeSincePrevious = allWeightLogs[0].weightKg - userProfile.goalStartWeight;
        }
    }

    const totalDaysInPeriod = analysisPeriodSummaries.length;
    const successfulDays = analysisPeriodSummaries.filter(s => s.goalMet || s.savedBy).length;
    const adherencePercentage = totalDaysInPeriod > 0 ? (successfulDays / totalDaysInPeriod) * 100 : 0;
    const avgCalories = totalDaysInPeriod > 0 ? analysisPeriodSummaries.reduce((sum, s) => sum + s.consumedCalories, 0) / totalDaysInPeriod : 0;
    
    const nutritionalSummaryForPrompt = `
- Analysperiod: ${analysisPeriodDescription}
- Antal dagar loggade i perioden: ${totalDaysInPeriod}
- Andel dagar med kalorimål uppfyllt: ${adherencePercentage.toFixed(0)}%
- Genomsnittligt kaloriintag: ${avgCalories.toFixed(0)} kcal (Ditt mål: ${goals.calorieGoal.toFixed(0)} kcal)
- Viktförändring under perioden: ${weightChangeSincePrevious.toFixed(1)} kg
    `;

    // --- DYNAMIC DATA FOR PROMPT ---
    const namn = userProfile.name || 'Användare';
    const antalViktloggar = allWeightLogs.length;
    const antalKostloggar = last30DaysSummaries.length;
    const startvikt = userProfile.goalStartWeight ?? (allWeightLogs.length > 0 ? allWeightLogs[0].weightKg : userProfile.currentWeightKg);
    const senasteViktLog = allWeightLogs.length > 0 ? allWeightLogs[allWeightLogs.length - 1] : null;
    const senasteVikt = senasteViktLog?.weightKg;
    const muskelmassa = senasteViktLog?.skeletalMuscleMassKg;
    const fettmassa = senasteViktLog?.bodyFatMassKg;
    
    let muskelTrend = 'stabil';
    if (allWeightLogs.length >= 2) {
        const last = allWeightLogs[allWeightLogs.length - 1].skeletalMuscleMassKg;
        const secondLast = allWeightLogs[allWeightLogs.length - 2].skeletalMuscleMassKg;
        if (last != null && secondLast != null) {
            if (last > secondLast + 0.1) muskelTrend = 'okande';
            else if (last < secondLast - 0.1) muskelTrend = 'minskande';
        }
    }

    const totalaDagar = last30DaysSummaries.length;
    const waterGoalMetCount = last30DaysSummaries.filter(s => s.waterGoalMet).length;
    const vattenuppfyllnadProcent = totalaDagar > 0 ? ((waterGoalMetCount / totalaDagar) * 100).toFixed(0) : '0';
    
    const { currentLevel } = getUserLevelInfo(currentStreak);
    const nivå = currentLevel.name;

    const aktivitetsnivå = userProfile.activityLevel;
    
    const senasteVälbefinnande = mentalWellbeingLogs && mentalWellbeingLogs.length > 0 
        ? mentalWellbeingLogs.sort((a,b) => b.loggedAt - a.loggedAt)[0] 
        : null;
    const mentalWellbeingDataString = senasteVälbefinnande
        ? `Stress: ${senasteVälbefinnande.stressLevel || 'N/A'}, Energi: ${senasteVälbefinnande.energyLevel || 'N/A'}, Somn: ${senasteVälbefinnande.sleepQuality || 'N/A'}, Humor: ${senasteVälbefinnande.mood || 'N/A'}`
        : 'Ej loggat';

    // --- NEW: DYNAMIC PROMPT PARTS BASED ON GOAL ---
    const measurementMethod = userProfile.measurementMethod;
    const goalType = userProfile.goalType;
    let bodyCompositionContentPrompt: string;
    let bodyCompositionDataPrompt: string;

    if (measurementMethod === 'inbody') {
        bodyCompositionDataPrompt = `- Muskelmassa (senaste): ${muskelmassa?.toFixed(1) || 'Ej mätt'} kg\n- Muskeltrend: ${muskelTrend}\n- Fettmassa (senaste): ${fettmassa?.toFixed(1) || 'Ej mätt'} kg`;
        switch (goalType) {
            case 'gain_muscle':
                bodyCompositionContentPrompt = "Målet är muskelökning. Beskriv viktutvecklingen och muskelmassan positivt. En total viktuppgång är MÅLET. Koppla ihop total viktökning med en ökande/stabil muskeltrend som en framgång. Exempel: 'Starkt jobbat! Din vikt har ökat med X kg, och det är fantastiskt att din muskelmassa samtidigt visar en ökande trend. Det här är precis den utveckling vi vill se!'. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
            case 'lose_fat':
                bodyCompositionContentPrompt = "Målet är fettminskning. Beskriv viktutveckling och muskelmassa. Lyft att en stabil eller ökande muskelmassa under en viktnedgång är ett stort styrketecken. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
            default: // maintain
                bodyCompositionContentPrompt = "Målet är att bibehålla vikten. Beskriv viktutvecklingen med fokus på stabilitet. Normalisera små viktpendlingar och betona att den långsiktiga trenden är det viktiga. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
        }
    } else { // 'scale' or undefined
        bodyCompositionDataPrompt = "";
        switch (goalType) {
            case 'gain_muscle':
                bodyCompositionContentPrompt = "Målet är muskelökning. Beskriv viktutvecklingen positivt. En total viktuppgång är MÅLET. Framhäv detta som en framgång. Exempel: 'Bra jobbat! Din vikt har ökat med X kg, vilket är ett tecken på att du är på rätt väg mot ditt mål.'. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
            case 'lose_fat':
                bodyCompositionContentPrompt = "Målet är fettminskning. Beskriv viktutvecklingen. Kommentera trenden (ner, upp, stabil) och hur den relaterar till målet. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
            default: // maintain
                bodyCompositionContentPrompt = "Målet är att bibehålla vikten. Beskriv viktutvecklingen med fokus på stabilitet. Normalisera små viktpendlingar. Använd startvikten för det AKTUELLA målet (goalStartWeight) som referens. Använd \\n för nya rader.";
                break;
        }
    }

    // Updated Course Prompt Logic: Assume access to all courses.
    const kursFeedbackPrompt = `Användaren har tillgång till kurserna 'Praktisk Viktkontroll' och 'Maxa Klimakteriet'. Koppla dina insikter till relevanta koncept från 'Praktisk Viktkontroll'. Om användaren t.ex. har en platå, kan du referera till Lektion 7 ('Bryt en platå'). Om de är inkonsekventa, nämn Lektion 4 ('Hantera utmaningar').`;

    const style = userProfile.coachStyle || 'balanced';
    const persona = COACH_PERSONAS[style] || COACH_PERSONAS['balanced'];

    const prompt = `
Du är ${persona.label}, ${persona.roleTitle} i appen Kostloggen.
Ditt tonläge: ${persona.promptTone}

Du är en INTE en extern coach, du ÄR ${persona.label}. Skriv återkopplingen som att det är du som vägleder användaren. Undvik formuleringar som "prata med din coach" - du ÄR coachen.

**NÄRINGS-LAGBOKEN (GÄLLER ALLA COACHER):**
Oavsett din persona, måste du ALLTID bedöma maten utifrån objektiv näringslära:
- Avokado, nötter, olivolja = Mycket bra (hälsosamma fetter).
- Ägg, kyckling, fisk, kvarg = Mycket bra (protein för mättnad och muskler).
- Grönsaker/Frukt = Mycket bra (vitaminer och fibrer).
- Pizza, godis, bakverk, snabbmat = Näringsfattigt/kaloririkt (okej ibland, men kalla det aldrig 'balanserat', 'optimalt' eller 'bra bränsle').

${plateauPromptPart}
Analysera användarens data nedan och svara ENDAST med ett enda JSON-objekt med följande exakta struktur:
{
  "greeting": "En personlig och peppande hälsning till användaren. Använd namnet från datan.",
  "sections": [
    {
      "emoji": "💬",
      "title": "Helhetsbild & Uppmuntran",
      "content": "Skriv en uppmuntrande sammanfattning. Lyft engagemang, streaks, nivå, loggningar. Använd namn. Tala direkt till användaren. (Ex: “Kenta, du gör ett fantastiskt jobb!”). Använd \\n för nya rader."
    },
    {
      "emoji": "📉",
      "title": "Kroppssammansättning & trend",
      "content": "${bodyCompositionContentPrompt}"
    },
    {
      "emoji": "🧠",
      "title": "Mentalt Välbefinnande",
      "content": "Användarens senaste logg för välbefinnande gjordes precis i samband med den senaste viktmätningen. Skriv en kort, insiktsfull kommentar som kopplar det mentala till det fysiska resultatet. Exempel: 'Jag ser att du rapporterat hög stress. Det är vanligt att det binder vätska och påverkar vikten.' eller 'Din höga energinivå är en superkraft för att nå dina mål!'. Om ingen data finns, skriv en allmän uppmuntran om att logga välbefinnande. Använd \\n för nya rader."
    },
    {
      "emoji": "🥦",
      "title": "Näringsvanor",
      "content": "Analysera **ENDAST** datan från den specificerade analysperioden. Ge en ÖVERSIKTLIG summering av användarens följsamhet till kostplanen. Kommentera den generella trenden (t.ex. 'Du har följt din kaloriplan bra', 'Proteinintaget har varit stabilt'). Koppla ihop näringsintaget med resultatet på vågen (använd 'Viktförändring under perioden' från datan). UNDVIK att nämna enskilda dagar eller specifika datum. Håll det kortfattat och peppande. Använd \\n för nya rader."
    },
    {
      "emoji": "💧",
      "title": "Vattenintag",
      "content": "Bekräfta eller påminn om vattenintag. Ex: 'Bra jobbat med din vätska – du uppnår målet ${vattenuppfyllnadProcent}% av dagarna.' eller 'Kom ihåg att logga vatten dagligen – det påverkar både mättnad och ork.' Använd \\n för nya rader."
    },
    {
      "emoji": "🏃",
      "title": "Aktivitetsnivå",
      "content": "Bekräfta eller ge milda korrigeringar om aktivitetsnivån. Ex: 'Du har angett att du är ‘Medelaktiv’. Det passar bra om du tränar 3–5 pass i veckan eller rör dig en hel del i vardagen – vilket verkar stämma in på dig!' Använd \\n för nya rader."
    },
    {
      "emoji": "📚",
      "title": "Kursfeedback",
      "content": "${kursFeedbackPrompt} Använd \\n för nya rader."
    },
    {
      "emoji": "🚀",
      "title": "Rekommendationer framåt",
      "content": "Sammanfatta 2–3 tydliga, enkla steg. Använd punktlistor i formatet '• Punkt 1\\n• Punkt 2'. Om en platå upptäcktes (se platåinstruktioner ovan), se till att inkludera den speciella coachningen här. Annars, ge allmänna rekommendationer. Ex: '• Fortsätt hålla din streak levande. • Sikta på att nå proteinmålet varje dag.' Använd \\n för nya rader."
    }
  ]
}

Användarens data:
- Namn: ${namn}
- Måltyp: ${goalType}
- Antal viktmätningar: ${antalViktloggar}
- Antal kostinloggningar (senaste 30d): ${antalKostloggar}
- Startvikt för detta mål: ${startvikt?.toFixed(1) || 'Ej satt'} kg
- Senaste vikt: ${senasteVikt?.toFixed(1) || 'Ej satt'} kg
${bodyCompositionDataPrompt}
- Senaste välbefinnande: ${mentalWellbeingDataString}
- Summering av näring i analysperioden: ${nutritionalSummaryForPrompt}
- Måltidslinje & Milstolpar: ${JSON.stringify(goalTimeline)}
- Vattenmål uppnått: ${vattenuppfyllnadProcent}% av dagarna (senaste 30d)
- Streak: ${currentStreak} dagar
- Nivå: ${nivå}
- Aktivitetsnivå: ${aktivitetsnivå}
`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_NAME_TEXT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.6,
                topP: 0.95,
            },
        });

        let jsonStr = response.text?.trim();
        if (!jsonStr) throw new Error("No text response");

        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr) as AIStructuredFeedbackResponse;
        
        if (!parsedData.greeting || typeof parsedData.greeting !== 'string' || !Array.isArray(parsedData.sections)) {
            console.error("Invalid JSON structure from Gemini Journey Analysis:", parsedData);
            throw new Error("Ogiltig eller ofullständig JSON-struktur mottagen från AI-analys (saknar hälsning eller sektioner).");
        }

        for (const section of parsedData.sections) {
            if (
                !section ||
                typeof section.emoji !== 'string' ||
                typeof section.title !== 'string' ||
                typeof section.content !== 'string'
            ) {
                console.error("Invalid section found in Gemini Journey Analysis response:", section, "Full response:", parsedData);
                throw new Error(`AI:n gav ofullständig data för sektionen '${section?.title || 'Okänd'}'. Försök igen.`);
            }
        }

        return parsedData;

    } catch (error) {
        console.error("Error getting detailed journey analysis from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Kunde inte generera analys: ${error.message}`);
        }
        throw new Error("Kunde inte generera analys på grund av ett okänt fel.");
    }
};


export const getAICoachSummaryForMember = async (data: AIDataForCoachSummary): Promise<string> => {
    const { memberName, memberProfile, last7DaysSummaries, last5WeightLogs, currentStreak, lastLogDate, courseProgressSummary } = data;

    const summaryText = last7DaysSummaries.map(s => `- ${s.date}: ${s.goalMet ? 'Mål nått' : 'Mål ej nått'} (${s.consumedCalories.toFixed(0)}/${s.calorieGoal.toFixed(0)} kcal)`).join('\n');
    const weightLogText = last5WeightLogs.map(w => `- ${new Date(w.loggedAt).toLocaleDateString('sv-SE')}: ${w.weightKg.toFixed(1)} kg`).join('\n');

    const prompt = `
Du är en AI-assistent för en hälsocoach. Ge en kort, koncis och insiktsfull sammanfattning (max 120 ord) om medlemmens baserat på följande data. Formatera ditt svar med Markdown. Använd fetstil för rubriker och punktlistor under varje rubrik.

**Medlemsdata:**
- Namn: ${memberName}
- Mål: ${memberProfile.goalType === 'lose_fat' ? 'Fettminskning' : memberProfile.goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}
- Startvikt: ${memberProfile.currentWeightKg || 'Ej satt'} kg
- Nuvarande Streak: ${currentStreak} dagar
- Senaste logg: ${lastLogDate || 'Aldrig'}
- Kursframsteg: ${courseProgressSummary?.started ? `${courseProgressSummary.completedLessons}/${courseProgressSummary.totalLessons} lektioner` : 'Ej påbörjad'}
- Senaste viktloggar:
${weightLogText || "Inga viktloggar."}
- Senaste 7 dagarnas resultat:
${summaryText || "Inga dagliga resultat."}

**Din uppgift:**
Skapa en sammanfattning med följande tre rubriker:
**Engagemang:** Kommentera medlemmens aktivitet (streak, senaste logg).
**Framsteg:** Analysera viktutvecklingen i relation till målet.
**Action Points för Coach:** Ge 1-2 konkreta, positiva förslag på vad coachen kan göra (t.ex. "Ge beröm för...", "Följ upp kring...", "Påminn om...").
`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL_NAME_TEXT,
            contents: prompt,
            config: {
                temperature: 0.5,
            },
        });
        return response.text?.trim() || "";
    } catch (error) {
        console.error("Error getting AI coach summary from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Kunde inte generera AI-sammanfattning: ${error.message}`);
        }
        throw new Error("Kunde inte generera AI-sammanfattning på grund av ett okänt fel.");
    }
};

export const analyzeNutritionLabelImage = async (base64ImageData: string): Promise<NutritionalInfo> => {
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64ImageData,
    },
  };

  const textPart = {
    text: `Analysera näringsdeklarationen på denna bild. Ditt mål är att extrahera näringsvärdena per 100g eller 100ml.
Leta efter nyckelord som "Näringsvärde", "per 100g", "per 100 ml", "Energi", "Fett", "Kolhydrater", "Protein".
Identifiera också produktens namn om det är synligt på bilden.

Svara ENDAST med ett enda JSON-objekt med följande exakta nycklar:
"foodItem" (string, produktens namn på SVENSKA, t.ex., "Kalles Kaviar", "Ekologisk Mellanmjölk"),
"calories" (number, i kcal, per 100g/ml),
"protein" (number, i gram, per 100g/ml),
"carbohydrates" (number, i gram, per 100g/ml),
"fat" (number, i gram, per 100g/ml).

Se till att alla näringsvärden är numeriska och representerar värdena per 100g eller 100ml. Om ett värde inte kan hittas, returnera 0 för det fältet. Om du hittar "kJ" för energi, omvandla det till kcal (dividera med 4.184). Extrahera endast siffror.
Exempel: {"foodItem": "Ekologisk Mellanmjölk", "calories": 45, "protein": 3.5, "carbohydrates": 4.9, "fat": 1.5}`
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, 
      },
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No text response");
    
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr) as NutritionalInfo;

    if (typeof parsedData.calories !== 'number' ||
        typeof parsedData.protein !== 'number' ||
        typeof parsedData.carbohydrates !== 'number' ||
        typeof parsedData.fat !== 'number') {
      throw new Error("Invalid JSON structure from nutrition label analysis. Missing or incorrect numeric types.");
    }
    
    // Ensure non-negative
    parsedData.calories = Math.max(0, parsedData.calories);
    parsedData.protein = Math.max(0, parsedData.protein);
    parsedData.carbohydrates = Math.max(0, parsedData.carbohydrates);
    parsedData.fat = Math.max(0, parsedData.fat);

    return parsedData;

  } catch (error) {
    console.error("Error analyzing nutrition label with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Kunde inte läsa näringsdeklarationen: ${error.message}`);
    }
    throw new Error("Kunde inte läsa näringsdeklarationen på grund av ett okänt fel.");
  }
};

export const extractBarcodeFromImage = async (base64ImageData: string): Promise<string | null> => {
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64ImageData,
    },
  };

  const textPart = {
    text: `Identify the EAN-13 or UPC barcode number in this image. Return ONLY the digits. If no barcode is visible or readable, return 'null'.`
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME_TEXT,
      contents: { parts: [imagePart, textPart] },
      config: {
        temperature: 0.1,
      },
    });

    let text = response.text?.trim();
    if (!text || text.toLowerCase() === 'null') {
      return null;
    }
    
    // Clean up any non-digit characters just in case
    const digits = text.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;

  } catch (error) {
    console.error("Error extracting barcode with Gemini:", error);
    return null;
  }
};
