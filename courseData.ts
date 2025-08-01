import { CourseLesson } from './types';

export const courseLessons: CourseLesson[] = [
  {
    id: 'lektion1',
    title: 'Lektion 1 – Din resa börjar här',
    introduction: 'Denna lektion handlar om att komma igång – att förstå varför du vill göra denna resa och hur du kan börja med små steg som gör stor skillnad.',
    detailedText: 'Välkommen till din första lektion i Praktisk viktkontroll. Här börjar något viktigt – din egen hälsoresa. Du har redan tagit ett modigt steg genom att vara här, och nu är det dags att börja bygga goda vanor som håller över tid.\nFör att lyckas långsiktigt behöver du veta varför du vill göra en förändring. Är det för att känna dig piggare, starkare, lättare i kroppen – eller något helt annat? Ditt personliga varför är det som hjälper dig hålla kursen även när det känns tufft. Skriv gärna ner det direkt i appen.\nSätt också ett mål att jobba mot – ett som är tydligt och realistiskt. Använd SMART-modellen för att formulera det:\nSpecifikt – Vad vill du uppnå?\nMätbart – Hur ser du att du gör framsteg?\nAccepterat – Är det viktigt för dig personligen?\nRealistiskt – Är det genomförbart i din vardag?\nTidsbundet – När vill du ha nått dit?\nBörja också logga dina måltider i appen. Du behöver inte ändra allt direkt – men att bli medveten om vad du äter är ett kraftfullt första steg.',
    focusPoints: [
      { id: 'l1fp1', text: 'Sätt ett SMART mål (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet)' },
      { id: 'l1fp2', text: 'Skriv ned varför du vill gå ner i vikt – det är din inre drivkraft' },
      { 
        id: 'l1fp3', 
        text: 'Börja logga vad du äter i appen',
        cta: {
            label: "Logga din första måltid",
            action: "openSpeedDial"
        }
      },
    ],
    tips: [
      { id: 'l1t1', text: 'Ta en 30-minuters promenad 3 gånger denna lektion. Logga i appen vad du äter. Redan här börjar du ta kontroll!' }
    ],
    reflection: {
      id: 'l1r1',
      question: 'Vilket hinder tror du kan bli störst? Fundera på en lösning redan nu.'
    },
    specialAction: {
      type: 'writeWhy',
      prompt: 'Ditt "Varför" och SMART-mål',
      description: 'Fundera på VARFÖR du vill göra denna förändring och skriv ner det. Titta sedan på ditt övergripande mål som du angav i din profil (t.ex. om du vill minska fettmassa eller öka muskelmassa) och försök formulera ett mer detaljerat SMART mål här: Specifikt (Vad exakt vill du uppnå?), Mätbart (Hur vet du när du nått det?), Accepterat (Är det verkligen DITT mål?), Realistiskt (Är det möjligt att uppnå?), Tidsbundet (När ska det vara uppnått?).'
    }
  },
  {
    id: 'lektion2',
    title: 'Lektion 2 – Bygg din rutin',
    introduction: 'Heja dig – du är igång! Nu handlar det om att bygga struktur så att nya vanor blir vardag.',
    detailedText: 'Starkt jobbat – du har hållit igång i en vecka och det märks! Nu är det dags att bygga vidare. Den här lektionen fokuserar på struktur och regelbundenhet, så att dina nya vanor blir en naturlig del av vardagen.\nSträva efter tre huvudmåltider och ett till två mellanmål varje dag. Logga dem i appen för att få koll och tydlighet.\nDet är också dags för din första veckomätning. Genom att följa både vikt och kroppssammansättning ser du fler delar av din utveckling. För bästa jämförelse, väg dig vid samma tid varje vecka – helst på morgonen innan frukost.\nTitta tillbaka i din matlogg. Finns det något mönster du vill justera? Välj en vana att förbättra och fokusera på den under veckan.',
    focusPoints: [
      { id: 'l2fp1', text: 'Regelbundna måltider: 3 huvudmål, 1–2 mellanmål (logga dem i appen!)' },
      { 
        id: 'l2fp2', 
        text: 'Genomför din veckomätning för att följa din vikt och kroppssammansättning.',
        cta: {
            label: "Logga Mätning",
            action: "openLogWeightModal" 
        }
      },
      { id: 'l2fp4', text: 'Identifiera en vana att förbättra (t.ex. småätande, stressmat – se mönster i din matlogg)' },
    ],
    tips: [
      { id: 'l2t1', text: 'Använd tallriksmodellen – hälften grönsaker, en fjärdedel protein, en fjärdedel kolhydrater. Och: vatten till måltiden! Logga vattnet i appen.' },
      { id: 'l2t2', text: 'För bäst resultat, försök väga dig på samma dag och tid varje vecka, gärna på morgonen innan frukost.' }
    ],
    reflection: {
      id: 'l2r1',
      question: 'Vad fungerade bra förra lektionen? Vad vill du justera nu?'
    }
  },
  {
    id: 'lektion3',
    title: 'Lektion 3 – Lär känna din hunger',
    introduction: 'Du är på gång – toppen! Nu börjar vi lyssna mer på kroppen och äter medvetet.',
    detailedText: 'Den här lektionen handlar om att lyssna mer på kroppen. Genom att bli uppmärksam på hunger och mättnad får du bättre kontroll och kan fatta medvetna beslut kring maten.\nVi börjar med mindful eating – att äta långsamt och utan distraktioner. Lägg gärna ner besticken mellan tuggorna, och försök sitta ner och äta i lugn och ro.\nStanna upp före varje måltid: Hur hungrig är jag – på en skala från 1 till 10? Och efteråt: Hur mätt är jag nu? Skriv gärna ner det i loggen eller i din reflektion.\nTitta tillbaka i din logg – finns det situationer där du tenderar att äta mer än du behöver? Identifiera dina triggers.\nDen här veckan kan du också testa att lägga till lite rörelse som höjer pulsen, om det känns rätt för dig. Det viktiga är att rörelsen passar dig.',
    focusPoints: [
      { id: 'l3fp1', text: 'Öva "mindful eating": ät långsamt och utan distraktion' },
      { id: 'l3fp2', text: 'Identifiera triggers som leder till överätande (notera i samband med din matloggning)' },
    ],
    tips: [
      { id: 'l3t1', text: 'Lägg ner besticken mellan tuggorna. Känn efter hur hungrig du är innan och efter varje måltid – skriv gärna ned i din logg eller reflektion.' }
    ],
    reflection: {
      id: 'l3r1',
      question: 'Hur kändes det att äta långsamt? Märkte du när du blev mätt?'
    }
  },
  {
    id: 'lektion4',
    title: 'Lektion 4 – Hantera utmaningar',
    introduction: 'Nu har du en månad bakom dig – bra jobbat! Den här lektionen fokuserar vi på att lösa hinder som uppstår längs vägen.',
    detailedText: 'Utmaningar är en naturlig del av alla förändringar. Den här veckan handlar om att lära känna dina mönster – och förbereda dig på att hantera dem.\nTitta i din matlogg – var det någon situation där det blev svårare att följa planen? Kanske en stressig kväll, något socialt eller bara trötthet?\nTesta att tänka så här:\n“Om X händer, så gör jag Y.”\nExempel:\n– Om jag blir sötsugen → då dricker jag ett glas vatten och väntar.\n– Om jag vet att det blir en intensiv helg → då förbereder jag bra mellanmål i förväg.',
    aiPromptHint: 'challenges',
    focusPoints: [
      { id: 'l4fp1', text: 'Identifiera en situation där du haft svårt att följa planen (t.ex. genom att titta i din matlogg i appen)' },
      { id: 'l4fp2', text: 'Skapa en strategi i förväg: "Om X händer, gör jag Y"' },
    ],
    tips: [
      { id: 'l4t1', text: 'Planera för helgen redan nu! Det är ofta då vanor sätts på prov. Kan du ha färdiga nyttiga snacks redo? Kolla dina sparade "Vanliga val" i appen för inspiration.' }
    ],
    reflection: {
      id: 'l4r1',
      question: 'Vilken utmaning hanterade du bra denna lektion?'
    }
  },
  {
    id: 'lektion5',
    title: 'Lektion 5 – Stegra och fira',
    introduction: 'Du är halvvägs – dags att växla upp lite! Nu bygger vi vidare på det du lärt dig och förstärker dina nya vanor.',
    detailedText: 'Nu är du inne i andra halvan av kursen. Det är dags att växla upp lite – inte för att pressa dig, utan för att känna kraften i det du redan bygger.\nLägg till en ny hälsovana – något enkelt men konkret. Det kan vara frukt till mellanmålet, ett glas vatten före varje måltid eller något annat du själv väljer.\nTitta även i matloggen: syns det att du får i dig tillräckligt med protein och grönsaker?\nVill du öka aktiviteten lite, gör det på ett sätt som känns roligt och realistiskt. Det viktigaste är att det passar din vardag.',
    focusPoints: [
      { id: 'l5fp1', text: 'Lägg till en ny hälsovana (t.ex. frukt till mellanmål, logga detta i appen)' },
      { 
        id: 'l5fp3', 
        text: 'Håll fokus på protein och grönsaker i kosten (syns detta i din matlogg?)',
        cta: {
            label: "Uppdatera mitt mål",
            action: "navigateToJourneyGoals"
        }
      },
    ],
    tips: [
      { id: 'l5t1', text: 'Sätt ett nytt delmål fram till Lektion 8 – t.ex. en specifik vikt (kan uppdateras i din profil), orka springa 1 km, eller en ny nivå i appen.' }
    ],
    reflection: {
      id: 'l5r1',
      question: 'Vad har du gjort hittills som du är mest stolt över?'
    },
    specialAction: {
      type: 'smartGoal',
      prompt: 'Sätt ett nytt delmål',
      description: 'Baserat på tipset, vad är ditt nya delmål fram till Lektion 8? Försök göra det SMART (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet). Skriv ner det här.'
    }
  },
  {
    id: 'lektion6',
    title: 'Lektion 6 – Halvtidskollen',
    introduction: 'Halva resan klar – starkt jobbat! Denna lektion stannar vi upp, utvärderar och justerar vid behov.',
    detailedText: 'Halvvägs! Det är dags att stanna upp och utvärdera vad som fungerar – och vad som kan förbättras.\nGå tillbaka till ditt “Varför” och det mål du satte i Lektion 1. Hur ligger du till? Är målet fortfarande aktuellt, eller behöver det justeras?\nTitta på din kost och rörelse: har något förändrats? Loggen hjälper dig se mönster du annars missar.',
    focusPoints: [
      { id: 'l6fp1', text: 'Gå tillbaka till målen från Lektion 1 (ditt "Varför" och SMART-mål i appen): hur ligger du till?' },
      { id: 'l6fp2', text: 'Justera kost eller träning om du stagnerat (se över dina loggade måltider och aktiviteter i appen)' },
      { id: 'l6fp3', text: 'Hitta en ny motivationskälla – t.ex. kläder som sitter bättre, eller en ny nivå i appen' },
    ],
    tips: [
      { id: 'l6t1', text: 'Skriv upp tre vanor du vill behålla även efter programmet – detta är en livsstilsförändring.' }
    ],
    reflection: {
      id: 'l6r1',
      question: 'Vad har varit den största lärdomen hittills?'
    }
  },
  {
    id: 'lektion7',
    title: 'Lektion 7 – Bryt en platå',
    introduction: 'Ibland går det långsammare – det är helt okej. Kroppen vänjer sig – nu hjälper vi den vidare.',
    detailedText: 'Det är vanligt att förändring saktar in. Det betyder inte att du gör fel – det betyder att kroppen anpassar sig. Nu gör vi några små justeringar för att få fart igen.\nTitta på dina portionsstorlekar – har de förändrats? Du kan använda handmodellen eller mått för att få bättre koll.\nFå in mer rörelse i vardagen. Behöver inte vara träning – det kan vara fler steg, lite raskare tempo eller att ta trappor.',
    aiPromptHint: 'plateau',
    focusPoints: [
      { id: 'l7fp1', text: 'Revidera portionsstorlek (kolla din logg, väg maten) eller öka vardagsrörelsen' },
      { id: 'l7fp3', text: 'Prata snällt med dig själv – du gör ett fantastiskt jobb! Titta på dina framsteg i appens historik.' },
    ],
    tips: [
      { id: 'l7t1', text: 'Försök få in 10 000 steg per dag. Det gör mer skillnad än du tror. Många mobiler eller klockor loggar detta automatiskt.' }
    ],
    reflection: {
      id: 'l7r1',
      question: 'Vad kan du göra annorlunda denna lektion för att få ny energi?'
    }
  },
  {
    id: 'lektion8',
    title: 'Lektion 8 – Hitta glädjen',
    introduction: 'Nu är du van – gör det kul! Denna lektion handlar om att hitta motivationen igen.',
    detailedText: 'När det inte längre känns “nytt” – då behöver vi hitta glädjen i det du gör. Den här veckan handlar om att förnya motivationen.\nTesta något nytt: ett nytt recept, en annan måltidsrutin, eller en annan form av rörelse. Spara nya favoriter som “Vanliga val” i appen.\nTitta på dina nivåer och historik – påminn dig själv om hur långt du har kommit.',
    focusPoints: [
      { id: 'l8fp1', text: 'Testa ett nytt recept (logga det och spara som "Vanligt val" i appen om det är en hit!) eller träningsform' },
      { id: 'l8fp2', text: 'Påminn dig själv om hälsofördelarna du redan uppnått (se din streak, nivå och historik i appen)' },
      { id: 'l8fp3', text: 'Fortsätt följa din plan – du är snart i mål (se dina satta mål i profilen)' },
    ],
    tips: [
      { id: 'l8t1', text: 'Bjud in någon till en aktivitet eller gör något som du mår bra av – det förstärker känslan av att du gör något för dig själv.' }
    ],
    reflection: {
      id: 'l8r1',
      question: 'Vad får dig att le när du tänker på de framsteg du gjort?'
    }
  },
  {
    id: 'lektion9',
    title: 'Lektion 9 – Finjustera',
    introduction: 'Det är detaljerna som gör skillnad nu. Sista biten handlar om att slipa på småsaker.',
    detailedText: 'Du har kommit långt – nu handlar det om detaljerna. Den här veckan finjusterar vi för att du ska få ut ännu mer av dina nya vanor.\nTitta på portionsstorlekar – använder du handmodellen eller annan jämförelse? Se också till att varje måltid innehåller protein – det gör stor skillnad för mättnad och återhämtning.\nOm du redan är aktiv: höj tempot lite. Om inte – öka vardagsrörelsen i små steg.',
    focusPoints: [
      { id: 'l9fp1', text: 'Kontrollera portionsstorlekar noggrant (använd matvåg och jämför med din logg i appen)' },
      { id: 'l9fp2', text: 'Se till att varje måltid innehåller protein (kolla näringsvärdena i din logg)' },
    ],
    tips: [
      { id: 'l9t1', text: 'Lägg in extra fokus på sömn denna lektion – det hjälper kroppen att bränna fett och återhämta sig.' }
    ],
    reflection: {
      id: 'l9r1',
      question: 'Vilken liten justering kan ge dig störst effekt just nu?'
    }
  },
  {
    id: 'lektion10',
    title: 'Lektion 10 – Ge allt',
    introduction: 'Nu är det slutspurt! Denna lektion handlar om 100 % följsamhet – du är så nära!',
    detailedText: 'Sista kraftsamlingen! Den här veckan handlar om att visa dig själv vad du kan när du fokuserar helt och hållet.\nFölj planen fullt ut – logga allt, håll dina rutiner, och känn hur det känns att vara 100 % närvarande i processen.\nTitta på din streak, din historik – allt det är bevis på din insats.',
    focusPoints: [
      { id: 'l10fp1', text: 'Följ planen fullt ut – inga spontana avsteg (håll din logg perfekt i appen!)' },
      { id: 'l10fp3', text: 'Stärk din tro på dig själv – du är en vinnare (kolla din streak och nivå i appen!)' },
    ],
    tips: [
      { id: 'l10t1', text: 'Skriv ett peppbrev till dig själv – varför detta är så viktigt för dig. Du kan använda reflektionsfältet i appen för detta.' }
    ],
    reflection: {
      id: 'l10r1',
      question: 'Vad skulle du säga till en vän som kämpat lika bra som du gjort?'
    }
  },
  {
    id: 'lektion11',
    title: 'Lektion 11 – Plan för framtiden',
    introduction: 'Du är nästan klar – dags att tänka långsiktigt. Nu förbereder vi övergången till en hållbar vardag.',
    detailedText: 'Du är nästan i mål – nu förbereder du livet efter kursen. Det här handlar om att göra dina nya vanor hållbara.\nSkriv ner tre vanor du vill behålla. Fundera på hur du vill följa upp dig själv: loggning, nya mål, veckovis reflektion?\nGå tillbaka i appen och se din resa – vad har fungerat? Vad vill du ta med dig?',
    focusPoints: [
      { id: 'l11fp1', text: 'Skriv ner 3 vanor du vill behålla långsiktigt' },
      { id: 'l11fp2', text: 'Gör en plan för hur du ska följa upp dig själv efter kursen (t.ex. fortsätta logga i appen, sätta nya mål i profilen)' },
      { id: 'l11fp3', text: 'Reflektera över hela din resa (du kan använda appens historik och dina tidigare reflektioner)' },
    ],
    tips: [
      { id: 'l11t1', text: 'Skapa en kalenderplan för de kommande 4 veckorna efter programmet – när tränar du? Hur handlar du mat?' }
    ],
    reflection: {
      id: 'l11r1',
      question: 'Hur vill du må om 3 månader? Vad behöver du fortsätta göra?'
    }
  },
  {
    id: 'lektion12',
    title: 'Lektion 12 – Fira och fortsätt',
    introduction: 'Stort grattis – du har gjort det! Denna lektion firar vi, summerar och blickar framåt.',
    detailedText: 'Du klarade det! Du har gått hela vägen genom kursen. Nu är det dags att fira – och planera hur du vill fortsätta.\nGör din slutmätning i appen – oavsett om du använder vanlig våg eller InBody. Det ger dig en tydlig bild av din förändring.\nTitta tillbaka i din historik, dina reflektioner, nivåer. Du har åstadkommit något stort.\nNu bygger du vidare – med tydliga val, egna rutiner och appen som ett fortsatt stöd.',
    focusPoints: [
      { 
        id: 'l12fp1', 
        text: 'Gör din slutmätning (vikt/InBody) för att se ditt slutgiltiga resultat!',
        cta: {
            label: "Logga Slutmätning",
            action: "openLogWeightModal"
        }
      },
      { id: 'l12fp2', text: 'Summera dina största vinster – fysiskt och mentalt (titta på din resa i appen via historik och nivåer)' },
      { id: 'l12fp3', text: 'Skapa ditt liv efter programmet: en stark, balanserad vardag (använd appen som stöd!)' },
    ],
    tips: [
      { id: 'l12t1', text: 'Fira på ett sätt som stärker din nya livsstil – kanske en lång vandring, massage eller köpa något som symboliserar förändringen.' }
    ],
    reflection: {
      id: 'l12r1',
      question: 'Vilken är den viktigaste förändringen du gjort – och hur ska du behålla den?'
    }
  }
];
