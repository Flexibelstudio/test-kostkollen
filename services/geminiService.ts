import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { NutritionalInfo, SearchedFoodInfo, GoalSettings, UserProfileData, RecipeSuggestion, AIDataForFeedback, IngredientRecipeResponse, AIDataForJourneyAnalysis, WeightLogEntry, PastDaySummary, TimelineMilestone, AIDataForLessonIntro, AIDataForCoachSummary, AIStructuredFeedbackResponse, Level, MentalWellbeingLog } from '../types.ts';
import { GEMINI_MODEL_NAME_TEXT, LEVEL_DEFINITIONS } from '../constants.ts';

// Ensure API_KEY is available.
if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "MISSING_API_KEY" });

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
Se till att alla makronutrienter (protein, kolhydrater, fett) beaktas. Om en makronutrient typiskt finns i den identifierade maten (t.ex. kolhydrater i bröd, fett i ost), bör den ha ett värde som inte är noll. Undvik att mata ut noll för en makronutrient om den tydligt finns.

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

    let jsonStr = response.text.trim();
    
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

    let jsonStr = response.text.trim();
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
    
  const wellbeingDataString = `
- Stressnivå: ${mentalWellbeing.stressLevel || 'Ej angivet'} (1=låg, 5=hög)
- Energinivå: ${mentalWellbeing.energyLevel || 'Ej angivet'} (1=låg, 5=hög)
- Sömnkvalitet: ${mentalWellbeing.sleepQuality || 'Ej angivet'} (1=dålig, 5=bra)
- Humör: ${mentalWellbeing.mood || 'Ej angivet'} (1=dåligt, 5=bra)`;

  const contextPrompt = isOnboarding 
    ? `**Din Uppgift (Onboarding):**
1.  Hälsa användaren välkommen med hens namn (använd fältet "Namn"). Använd en vänlig och peppande ton.
2.  Bekräfta deras startpunkt (vikt, längd, ålder) och säg att det är en utmärkt grund för att skräddarsy rekommendationer.
3.  Kommentera deras nuvarande välbefinnande på ett positivt och stöttande sätt, och relatera det till deras resa. Exempel: "Jag ser att du känner dig energifylld, vilket är en fantastisk startpunkt!" eller "Jag ser att du känner dig stressad. Det är starkt av dig att ta tag i detta nu; appen kommer hjälpa dig hitta en balans."
4.  Analysera deras mål. Titta på 'Önskad fettförändring' och 'Önskad muskelförändring' för att förstå deras primära mål (minska fett, bygga muskler, eller behålla).
5.  Kommentera målet och måldatumet. Om målet är fettminskning (negativ 'Önskad fettförändring') och ett måldatum är satt, beräkna den nödvändiga viktnedgången per vecka och bedöm om tidsplanen är realistisk. En säker och hållbar takt är ca 0.5-1% av kroppsvikten per vecka. Om tidsplanen är väldigt ambitiös, föreslå på ett positivt sätt att en något längre tidsplan kan vara mer hållbar, men att det är användaren som bestämmer. Om målet är realistiskt, beröm dem för en bra plan. Om målet är att bygga muskler eller behålla, ge en uppmuntrande kommentar om det.
6.  Inkludera en kommentar om proteinintaget och varför det är viktigt för deras mål. Använd det rekommenderade proteinintaget och relatera det till deras kroppsvikt (ca 1.5-2.0g per kg är vanligt).
7.  Avsluta med en uppmuntrande fras och en fråga om de är redo att logga sin första måltid.`
    : `**Din Uppgift (Mål uppdaterat):**
1.  Börja med en positiv bekräftelse på att målet är uppdaterat, använd användarens namn. Exempel: "Snyggt, ${userName}! Ditt mål är nu uppdaterat."
2.  Kommentera deras nuvarande välbefinnande i relation till det nya målet. Exempel: "Jag ser att du känner dig motiverad, det är perfekt timing för att sätta ett nytt mål!" eller "Jag ser att du rapporterar låg energi. Det nya målet kan bli en jättebra morot för att hitta ny kraft."
3.  Ge en kort, positiv kommentar om det nya målet. Fokusera på vad som är bra med det. Exempel: "Att fokusera på att bygga muskler kommer ge dig mer ork i vardagen." eller "Att justera målet för att bibehålla vikten är ett tecken på styrka och att du hittat en bra balans."
4.  Ge ett konkret, litet tips som är kopplat till det nya målet. Exempel (vid muskelökning): "Kom ihåg att protein är extra viktigt nu när du vill bygga muskler. Sikta på att få i dig lite protein vid varje måltid." Exempel (vid fettminskning): "Vatten och fibrer från grönsaker kommer bli dina bästa vänner för att hålla dig mätt och nöjd."
5.  Avsluta med en kort, peppande fras. Exempel: "Det här klarar du galant!" eller "Jag finns här och stöttar dig hela vägen."`;

  const fullPrompt = `Du är Flexibot, en hjälpsam och kunnig AI-coach från Kostloggen.se. Ditt tonläge är uppmuntrande, positivt och informativt. Du ger alltid förslag, aldrig order. Ge feedback på SVENSKA.

**Användarens Status:**
- Namn: ${userName || 'Användare'}
- Startvikt: ${userProfile.currentWeightKg} kg
- Längd: ${userProfile.heightCm} cm
- Ålder: ${userProfile.ageYears} år
- Önskad fettförändring: ${userProfile.desiredFatMassChangeKg || 0} kg
- Önskad muskelförändring: ${userProfile.desiredMuscleMassChangeKg || 0} kg
- Måldatum: ${userProfile.goalCompletionDate || 'Ej specificerat'}
- Rekommenderat dagligt kaloriintag: ${userGoals.calorieGoal.toFixed(0)} kcal
- Rekommenderat dagligt proteinintag: ${userGoals.proteinGoal.toFixed(0)} g
- Välbefinnande just nu: ${wellbeingDataString}

${contextPrompt}

**VIKTIGT:** Ditt svar ska vara en enda sammanhängande text, men uppdelad i flera korta stycken för att göra det luftigt och lättläst. Använd en dubbel nyrad (som \\n\\n) mellan varje stycke. Kombinera de olika delarna till ett flytande och naturligt meddelande. Undvik att lista punkterna, integrera dem i ett meddelande. Använd emojis för att förstärka den positiva och coachande känslan.`;
  
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

    return response.text.trim();

  } catch (error) {
    console.error("Error getting feedback from Coach from Gemini:", error);
    if (error instanceof Error) {
      if (error.message.includes('500') || error.message.toLowerCase().includes('internal')) {
        throw new Error("Coachen har stött på ett tekniskt problem och kan inte svara just nu. Vänligen försök igen om en liten stund.");
      }
      throw new Error(`Kunde inte hämta feedback från Coachen: ${error.message}`);
    }
    throw new Error("Kunde inte hämta feedback från Coachen på grund av ett okänt fel.");
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
Näringsinformationen är en UPPSKATTNING för HELA receptet. foodItem i totalNutritionalInfo ska vara samma som receptets titel.
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

    let jsonStr = response.text.trim();
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
8.  Se till att 'foodItem' i totalNutritionalInfo för varje recept alltid är receptets titel.

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

    let jsonStr = response.text.trim();
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
**Analyskontext:** Användaren, ${data.userName || 'användaren'}, ska precis börja lektionen "${data.lessonTitle}". Analysera deras matloggar för de senaste 7 dagarna för att hitta mönster i utmaningar.
**Senaste 7 dagarnas logg:**
${last7DaysSummaryText || "Inga loggar de senaste 7 dagarna."}

**Din uppgift:**
Skriv en kort (1-2 meningar), uppmuntrande och personlig inledning till lektionen. 
*   Om du ser ett mönster (t.ex. svårare på helger), nämn det på ett positivt och normaliserande sätt. Exempel: "Jag ser att helgerna kan vara lite extra utmanande, vilket är helt normalt. Den här lektionen kommer att ge dig verktyg för just sådana situationer."
*   Om inget tydligt mönster finns, ge en allmänt peppande inledning som är relevant för lektionens tema om att hantera utmaningar. Exempel: "Alla resor har sina utmaningar. Den här lektionen fokuserar på hur du kan hantera dem på bästa sätt."
*   Använd en vänlig och stöttande ton. Börja INTE med "Hej".`;
      break;

    case 'plateau':
      const last5WeightLogsText = (data.weightLogs || [])
        .slice(-5)
        .map(w => `- ${new Date(w.loggedAt).toLocaleDateString('sv-SE')}: ${w.weightKg.toFixed(1)} kg`)
        .join('\n');
        
      analysisPrompt = `
**Analyskontext:** Användaren, ${data.userName || 'användaren'}, ska precis börja lektionen "${data.lessonTitle}". Analysera hens senaste 5 viktloggar för att se om det finns en platå. En platå kan anses vara om de senaste 2-3 mätningarna har en väldigt liten förändring (mindre än 0.2 kg totalt).
**Senaste 5 viktloggarna:**
${last5WeightLogsText || "Inga viktloggar finns."}

**Din uppgift:**
Skriv en kort (1-2 meningar), uppmuntrande och personlig inledning till lektionen.
*   Om du ser tecken på en platå, bekräfta det på ett normaliserande sätt. Exempel: "Det ser ut som att din vikt har stabiliserat sig de senaste mätningarna, vilket är en helt naturlig del av resan. Denna lektion är designad för att ge dig ny fart!"
*   Om vikten fortfarande har en tydlig trend (upp eller ner), bekräfta de goda framstegen istället. Exempel: "Vilka fina framsteg du gör! Den här lektionen hjälper dig att fortsätta den positiva trenden och undvika framtida platåer."
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
    return response.text.trim();
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
    const { userProfile, allWeightLogs, last30DaysSummaries, mentalWellbeingLogs } = data;
    const isCourseActive = userProfile.isCourseActive || false;

    // --- NEW CALCULATIONS ---
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
            if (last > secondLast + 0.1) muskelTrend = 'ökande';
            else if (last < secondLast - 0.1) muskelTrend = 'minskande';
        }
    }

    const totalaDagar = last30DaysSummaries.length;
    const antalDagarKalorimål = last30DaysSummaries.filter(s => s.goalMet).length;
    const antalDagarProteinmål = last30DaysSummaries.filter(s => s.proteinGoalMet).length;
    const lågtProteinDagar = last30DaysSummaries.filter(s => !s.proteinGoalMet).map(s => new Date(s.date).toLocaleDateString('sv-SE', {day: 'numeric', month: 'short'})).slice(0, 3).join(', ');
    const högtFettDagar = last30DaysSummaries.filter(s => s.consumedFat > s.fatGoal).map(s => new Date(s.date).toLocaleDateString('sv-SE', {day: 'numeric', month: 'short'})).slice(0, 3).join(', ');
    
    const waterGoalMetCount = last30DaysSummaries.filter(s => s.waterGoalMet).length;
    const vattenuppfyllnadProcent = totalaDagar > 0 ? ((waterGoalMetCount / totalaDagar) * 100).toFixed(0) : '0';

    const latestSummary = last30DaysSummaries.length > 0 ? last30DaysSummaries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;
    const streak = latestSummary?.streakForThisDay ?? 0;
    
    const { currentLevel } = getUserLevelInfo(streak);
    const nivå = currentLevel.name;

    const aktivitetsnivå = userProfile.activityLevel;
    
    const senasteVälbefinnande = mentalWellbeingLogs && mentalWellbeingLogs.length > 0 
        ? mentalWellbeingLogs.sort((a,b) => b.loggedAt - a.loggedAt)[0] 
        : null;
    const mentalWellbeingDataString = senasteVälbefinnande
        ? `Stress: ${senasteVälbefinnande.stressLevel || 'N/A'}, Energi: ${senasteVälbefinnande.energyLevel || 'N/A'}, Sömn: ${senasteVälbefinnande.sleepQuality || 'N/A'}, Humör: ${senasteVälbefinnande.mood || 'N/A'}`
        : 'Ej loggat';

    const kursFeedbackPrompt = isCourseActive
      ? `Användaren HAR tillgång till kursen 'Praktisk Viktkontroll'. Koppla dina insikter till relevanta koncept från kursen. Om användaren t.ex. har en platå, kan du referera till Lektion 7 ('Bryt en platå'). Om de är inkonsekventa, nämn Lektion 4 ('Hantera utmaningar').`
      : `Användaren har INTE tillgång till kursen. Föreslå den som ett bra nästa steg om du identifierar ett tydligt problem (t.ex. en platå). Formulera det så här: 'För att få extra verktyg för att hantera [problemet], kan kursen 'Praktisk Viktkontroll' vara till stor hjälp.'`;

    const prompt = `
Du är den personliga coachen i Kostloggen – inte en extern coach. Skriv återkopplingen som att det är du som vägleder användaren. Undvik formuleringar som "prata med din coach", "ta upp det med någon" eller liknande – du ÄR den hjälpen.

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
      "content": "Beskriv viktutveckling och muskelmassa. Lyft att stabil muskelmassa vid fettminskning är ett styrketecken. Använd \\n för nya rader."
    },
    {
      "emoji": "🧠",
      "title": "Mentalt Välbefinnande",
      "content": "Användarens senaste logg för välbefinnande gjordes precis i samband med den senaste viktmätningen. Skriv en kort, insiktsfull kommentar som kopplar det mentala till det fysiska resultatet. Exempel: 'Jag ser att du rapporterat hög stress. Det är vanligt att det binder vätska och påverkar vikten.' eller 'Din höga energinivå är en superkraft för att nå dina mål!'. Om ingen data finns, skriv en allmän uppmuntran om att logga välbefinnande. Använd \\n för nya rader."
    },
    {
      "emoji": "🥦",
      "title": "Näringsvanor",
      "content": "Beröm regelbundet loggande och måluppfyllelse. Vid avvikelser: hjälp användaren förstå och justera. T.ex.: 'Titta gärna tillbaka på dagarna den ${lågtProteinDagar || 'som var'} och fundera på vad som gjorde det svårare att nå proteinmålet. Jag kan hjälpa dig att hitta enkla justeringar.' Använd \\n för nya rader."
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
      "content": "Sammanfatta 2–3 tydliga, enkla steg. Använd punktlistor i formatet '• Punkt 1\\n• Punkt 2'. Ex: '• Fortsätt hålla din streak levande. • Sikta på att nå proteinmålet varje dag.' Använd \\n för nya rader."
    }
  ]
}

Användarens data:
- Namn: ${namn}
- Antal viktmätningar: ${antalViktloggar}
- Antal kostinloggningar (senaste 30d): ${antalKostloggar}
- Startvikt: ${startvikt?.toFixed(1) || 'Ej satt'} kg
- Senaste vikt: ${senasteVikt?.toFixed(1) || 'Ej satt'} kg
- Muskelmassa (senaste): ${muskelmassa?.toFixed(1) || 'Ej mätt'} kg
- Muskeltrend: ${muskelTrend}
- Fettmassa (senaste): ${fettmassa?.toFixed(1) || 'Ej mätt'} kg
- Senaste välbefinnande: ${mentalWellbeingDataString}
- Kalorimål uppnått: ${antalDagarKalorimål} av ${totalaDagar} dagar
- Proteinmål uppnått: ${antalDagarProteinmål} av ${totalaDagar} dagar
- Dagar med lågt proteinintag (exempel): ${lågtProteinDagar || 'Inga'}
- Dagar med högt fettintag (exempel): ${högtFettDagar || 'Inga'}
- Vattenmål uppnått: ${vattenuppfyllnadProcent}% av dagarna
- Streak: ${streak} dagar
- Nivå: ${nivå}
- Kurs aktiv: ${isCourseActive ? 'ja' : 'nej'}
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

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr) as AIStructuredFeedbackResponse;
        
        if (!parsedData.greeting || !Array.isArray(parsedData.sections)) {
            throw new Error("Invalid JSON structure received from API for journey analysis.");
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
Du är en AI-assistent för en hälsocoach. Ge en kort, koncis och insiktsfull sammanfattning (max 120 ord) om medlemmen baserat på följande data. Formatera ditt svar med Markdown. Använd fetstil för rubriker och punktlistor under varje rubrik.

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
        return response.text.trim();
    } catch (error) {
        console.error("Error getting AI coach summary from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Kunde inte generera AI-sammanfattning: ${error.message}`);
        }
        throw new Error("Kunde inte generera AI-sammanfattning på grund av ett okänt fel.");
    }
};