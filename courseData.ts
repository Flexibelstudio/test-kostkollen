import { CourseLesson } from './types';

export const courseLessons: CourseLesson[] = [
  {
    id: 'lektion1',
    title: 'Lektion 1 – Din resa börjar här',
    introduction: 'Välkommen till din första lektion i Praktisk Viktkontroll – och starten på något viktigt. Den här veckan handlar inte om perfektion, utan om att börja. Små steg i rätt riktning bygger stora förändringar.',
    detailedText: 'För att lyckas långsiktigt behöver du förstå varför du vill göra en förändring. Är det för att känna dig piggare? Bli starkare? Få på dig favoritjeansen igen? Eller något helt annat? Ditt personliga varför hjälper dig att hålla kursen – även när motivationen tryter. Skriv gärna ner det direkt i Kostloggen, antingen i loggen eller genom att skicka det till din coach i chatten. Det är ett första kraftfullt steg.\nSätt ett mål som känns realistiskt och viktigt för dig. Använd gärna SMART-modellen för att formulera det: Specifikt – Vad vill du uppnå? Mätbart – Hur vet du att du gör framsteg? Accepterat – Är det viktigt för dig personligen? Realistiskt – Är det genomförbart i din vardag? Tidsbundet – När vill du ha nått dit?\nExempel: “Jag vill minska 6 kg fett på 12 veckor genom att följa mitt kostprogram och träna tre gånger i veckan.” Du kan också skriva in ditt mål i appen – eller skicka det till coachen i chatten för pepp, återkoppling eller bara för att hålla dig själv ansvarig.\nBörja logga det du äter i Kostloggen varje dag. Du behöver inte ändra allt direkt – men att bli medveten om dina vanor är ett kraftfullt steg. Du kan när som helst skriva till coachen: “Hur ser min vecka ut?”, “Hur ser mitt proteinintag ut?” eller “Vad har jag gjort bra?” Det ger dig direkt feedback, statistik och motivation att fortsätta.',
    focusPoints: [
      { id: 'l1fp1', text: 'Skriv ner ditt "Varför".' },
      { id: 'l1fp2', text: 'Formulera ett SMART-mål.' },
      { id: 'l1fp3', text: 'Börja logga dina måltider varje dag.', cta: { label: 'Logga din första måltid', action: 'openSpeedDial' } }
    ],
    tips: [{ id: 'l1t1', text: 'Ta tre promenader på 30 minuter. Logga dina måltider varje dag.' }],
    reflection: { id: 'l1r1', question: 'Vilket hinder tror du kan bli ditt största? Vad kan du göra redan nu för att vara förberedd?' },
    specialAction: {
      type: 'writeWhy',
      prompt: 'Ditt Varför & SMART-mål',
      description: '1. Skriv ner ditt varför. 2. Formulera ett SMART-mål som du kan följa under kursen. 3. Dela det med coachen i chatten om du vill – det är ett första steg mot hållbar förändring.'
    }
  },
  {
    id: 'lektion2',
    title: 'Lektion 2 – Bygg din rutin',
    introduction: 'Starkt jobbat – du har hållit igång i en vecka och det märks. Nu är det dags att bygga vidare.',
    detailedText: 'Den här lektionen fokuserar på struktur och regelbundenhet, så att dina nya vanor blir en naturlig del av vardagen. När du äter ungefär samma tider varje dag får kroppen bättre rytm. Målet är att hitta en balans som funkar för dig – inte att följa ett perfekt schema. Sträva efter tre huvudmåltider och ett till två mellanmål varje dag. Logga dem i appen för att få koll och tydlighet. Du kan när som helst skriva till coachen i Kostloggen: “Hur har min vecka sett ut?” eller “Hur ser mitt intag ut fördelat över dagen?”\nDet är också dags för din första veckomätning. Genom att följa både vikt och kroppssammansättning ser du fler delar av din utveckling. För bästa jämförelse, väg dig vid samma tid varje vecka – helst på morgonen innan frukost. Din viktkurva uppdateras automatiskt i appen, och du kan be coachen visa dig förändringen.\nTitta tillbaka i din matlogg. Finns det något mönster du vill justera? Kanske småäter du på kvällen? Eller glömmer bort mellanmålet och blir för hungrig senare? Välj en vana att förbättra och fokusera på den under veckan.',
    focusPoints: [
      { id: 'l2fp1', text: 'Sikta på regelbundna måltider (3 huvudmål, 1–2 mellanmål).' },
      { id: 'l2fp2', text: 'Genomför din veckomätning.', cta: { label: 'Logga Mätning', action: 'openLogWeightModal' } },
      { id: 'l2fp3', text: 'Identifiera en vana att förbättra baserat på din matlogg.' }
    ],
    tips: [{ id: 'l2t1', text: 'Tallriksmodellen är ett bra verktyg när du vill äta balanserat: Hälften grönsaker, en fjärdedel protein, en fjärdedel kolhydrater. Drick gärna vatten till måltiden – och logga det också i appen.' }],
    reflection: { id: 'l2r1', question: 'Vad fungerade bra för dig under förra veckan? Vad vill du justera nu för att komma ännu ett steg närmare ditt mål? Du kan skriva dina tankar direkt till coachen i chatten – och få personlig återkoppling.' }
  },
  {
    id: 'lektion3',
    title: 'Lektion 3 – Lär känna din hunger',
    introduction: 'Du har fortsatt jobba mot dina mål – starkt gjort. Den här lektionen handlar om att lyssna mer på kroppen.',
    detailedText: 'Genom att bli uppmärksam på hunger och mättnad får du bättre kontroll och kan fatta medvetna beslut kring maten. Vi börjar med mindful eating – att äta långsamt och utan distraktioner. När du ger kroppen tid att reagera hinner du känna när du faktiskt är mätt. Lägg gärna ner besticken mellan tuggorna, och försök sitta ner och äta i lugn och ro.\nStanna upp före varje måltid. Hur hungrig är du – på en skala från 1 till 10? Och efteråt: Hur mätt är du nu? Du kan skriva ner dina upplevelser direkt i Kostloggen, antingen i matloggen eller som en reflektion. Titta tillbaka i din logg. Finns det situationer där du tenderar att äta mer än du egentligen behöver? Vad utlöste det – stress, känslor eller miljö? Att bli medveten om triggers gör det lättare att möta dem på ett nytt sätt.\nDen här veckan kan du också testa att lägga till lite rörelse som höjer pulsen, om det känns rätt för dig. Det viktiga är att du rör på dig på ett sätt som passar din nivå och vardag.',
    focusPoints: [
      { id: 'l3fp1', text: 'Öva "mindful eating": ät långsamt och utan distraktioner.' },
      { id: 'l3fp2', text: 'Reflektera över din hunger- och mättnadsskala (1-10).' },
      { id: 'l3fp3', text: 'Identifiera triggers som leder till överätande.' },
      { id: 'l3fp4', text: 'Testa att lägga till lite rörelse som höjer pulsen.' }
    ],
    tips: [{ id: 'l3t1', text: 'Om du är osäker kan du be coachen i appen att hjälpa dig tolka mönster i din logg. Vill du ha tips på pass eller rörelseformer kan du fråga coachen direkt i chatten.' }],
    reflection: { id: 'l3r1', question: 'Hur kändes det att äta långsamt? Märkte du tydligare när du blev mätt? Vad upptäckte du om dina matvanor under veckan?' }
  },
  {
    id: 'lektion4',
    title: 'Lektion 4 – Hantera utmaningar',
    introduction: 'Härligt att du är vidare till nästa steg i kursen. Den här lektionen fokuserar på något som alla stöter på förr eller senare: utmaningar.',
    detailedText: 'För att förstå vad som behöver justeras framåt, börja med att titta tillbaka i din matlogg. Finns det situationer där det varit svårare att följa planen? Det kan vara stress, trötthet, sociala tillfällen eller något helt annat. Att se mönstren hjälper dig att bygga nya strategier.\nEn bra metod är att tänka i förväg: “Om X händer, så gör jag Y.” Exempel: Om jag blir sötsugen efter middagen – då tar jag en kopp te och väntar en stund. Om jag vet att helgen blir intensiv – då ser jag till att ha några färdiga alternativ hemma.\nJust helger är ofta en utmaning. Försök planera redan nu – kan du ha nyttiga snacks redo? Fortsätt också med träningen. Försök få in både styrka och rörelse som ökar pulsen. Det behöver inte vara perfekt – men regelbunden rörelse hjälper dig hålla fokus.',
    aiPromptHint: 'challenges',
    focusPoints: [
      { id: 'l4fp1', text: 'Identifiera en utmanande situation i din matlogg.' },
      { id: 'l4fp2', text: 'Skapa en "Om X, så Y"-strategi för den situationen.' },
      { id: 'l4fp3', text: 'Planera inför helgen.' }
    ],
    tips: [{ id: 'l4t1', text: 'Du kan be coachen i Kostloggen om hjälp att tolka loggen och ge dig återkoppling. Be gärna coachen i appen om förslag på ”Plan B”-strategier som passar din vardag. Gå gärna in i appen och kolla dina sparade Vanliga val för att förenkla besluten.' }],
    reflection: { id: 'l4r1', question: 'Vilken utmaning har du stött på nyligen – och hur hanterade du den? Vad kan du ta med dig till nästa gång?' }
  },
  {
    id: 'lektion5',
    title: 'Lektion 5 – Stegra och fira',
    introduction: 'Du är nu inne i den andra halvan av kursen. I den här lektionen bygger vi vidare på det du redan gör bra, och lägger till en nivå till.',
    detailedText: 'Först: fira något du gjort hittills som du är stolt över. Erkänn din insats – det stärker motivationen.\nNu är det dags att lägga till en ny hälsovana. Det kan vara något enkelt men konkret: frukt till mellanmålet, ett glas vatten före varje måltid eller att stänga köket efter middagen. Välj något du själv känner kan göra skillnad.\nVill du också öka din träningsnivå lite? Lägg till ett extra pass eller förläng ett befintligt med några minuter. Du kan också höja tempot i vardagsrörelsen. Det viktiga är inte hur mycket, utan att du utmanar dig lite mer än innan.\nFortsätt ha fokus på protein och grönsaker i måltiderna. Titta i din matlogg – hur ser det ut? Finns det något du vill justera?',
    focusPoints: [
      { id: 'l5fp1', text: 'Fira något du är stolt över med din resa hittills.' },
      { id: 'l5fp2', text: 'Lägg till en ny, enkel hälsovana denna vecka.' },
      { id: 'l5fp3', text: 'Öka din träningsnivå eller vardagsrörelse en aning.', cta: { label: "Uppdatera mitt mål", action: "navigateToJourneyGoals" } }
    ],
    tips: [{ id: 'l5t1', text: 'Sätt ett nytt delmål fram till Lektion 8. Gör målet tydligt och konkret, gärna enligt SMART-modellen: Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet.' }],
    reflection: { id: 'l5r1', question: 'Vad har du gjort hittills som du är mest stolt över?' },
    specialAction: {
      type: 'smartGoal',
      prompt: 'Sätt ett nytt delmål',
      description: 'Formulera ett delmål fram till Lektion 8. Vad vill du klara? Skriv ner det – och gör det SMART.'
    }
  },
  {
    id: 'lektion6',
    title: 'Lektion 6 – Halvtidskollen',
    introduction: 'Du har nu kommit halvvägs genom kursen – starkt jobbat. Den här lektionen handlar om att stanna upp en stund, utvärdera din resa hittills och justera om det behövs.',
    detailedText: 'Börja med att gå tillbaka till dina anteckningar från Lektion 1. Läs igenom ditt “Varför” och det SMART-mål du satte upp. Hur ligger du till i förhållande till det? Känns målet fortfarande relevant? Fundera också på om du vill justera något – det är helt okej att omformulera målet utifrån vad du vet idag.\nTitta därefter på din kost och träning. Gå igenom din logg i appen – hur ser det ut med måltiderna? Har balansen mellan protein, grönsaker och kolhydrater hållits? Om du har stagnerat i vikt eller energi – fundera på vad du kan justera, snarare än att börja om.\nDet är också dags att hitta en ny motivationskälla. Det kan vara att kläder börjar sitta bättre, att du har mer ork i vardagen, att du nått en ny nivå i appen – eller bara att du känner dig stolt över att du håller i.',
    focusPoints: [
      { id: 'l6fp1', text: 'Gå tillbaka till ditt "Varför" och SMART-mål från lektion 1. Behöver något justeras?' },
      { id: 'l6fp2', text: 'Analysera din logg för att se vad som fungerar och vad som kan förbättras.' },
      { id: 'l6fp3', text: 'Identifiera en ny motivationskälla för att hålla energin uppe.' }
    ],
    tips: [{ id: 'l6t1', text: 'Skriv upp tre vanor du vill behålla även efter kursen. Målet är inte en tillfällig förändring – det du bygger nu ska fungera i din vardag, långsiktigt.' }],
    reflection: { id: 'l6r1', question: 'Vad har varit den största lärdomen för dig hittills?' }
  },
  {
    id: 'lektion7',
    title: 'Lektion 7 – Bryt en platå',
    introduction: 'Ibland går det långsammare – och det är helt normalt. Den här lektionen handlar om att ta ett steg tillbaka, se över helheten och prova något nytt om det behövs.',
    detailedText: 'Börja med att titta i din matlogg. Har portionsstorlekarna förändrats med tiden? Kanske har du börjat äta lite mer utan att tänka på det – det är vanligt. Ett enkelt sätt att få överblick är att väga maten under några dagar igen.\nFundera också på hur din vardagsrörelse ser ut. Det behöver inte vara träning – varje rörelse räknas. Att öka den totala aktiviteten kan göra stor skillnad. Ett bra riktmärke är 10 000 steg per dag.\nOm du redan tränar, kanske du kan lägga till något nytt eller byta ut en vana för att skapa variation.\nOch glöm inte det viktigaste: att prata snällt med dig själv. Gå gärna in i appens historik och titta på vad du redan har åstadkommit.',
    aiPromptHint: 'plateau',
    focusPoints: [
      { id: 'l7fp1', text: 'Se över dina portionsstorlekar – har de ändrats?' },
      { id: 'l7fp2', text: 'Öka din vardagsrörelse, sikta gärna på 10 000 steg.' },
      { id: 'l7fp3', text: 'Var snäll mot dig själv och uppmärksamma de framsteg du redan gjort.' }
    ],
    tips: [{ id: 'l7t1', text: 'Försök få in lite mer rörelse i vardagen den här veckan – kanske fler steg, en extra promenad eller mer aktivitet i hemmet. Små insatser gör skillnad.' }],
    reflection: { id: 'l7r1', question: 'Vad kan du göra annorlunda just den här veckan för att få ny energi?' }
  },
  {
    id: 'lektion8',
    title: 'Lektion 8 – Hitta glädjen',
    introduction: 'Du har tagit dig hela vägen hit – och det är verkligen något att vara stolt över. I den här lektionen handlar det om att hitta tillbaka till glädjen och motivationen.',
    detailedText: 'För att väcka ny energi – testa något nytt. Det kan vara ett nytt recept, en annan sorts rörelse eller att ändra något litet i din rutin.\nTa också en stund och titta på vad du redan åstadkommit. Se din streak, nivå och historik i appen. Små framsteg över tid blir till stora förändringar.\nFortsätt följa den plan du har satt upp. Gå tillbaka till dina mål i profilen och påminn dig om vart du är på väg. Det viktiga nu är inte att förändra mer – utan att fortsätta hålla i.',
    focusPoints: [
      { id: 'l8fp1', text: 'Testa ett nytt recept eller en ny form av rörelse.' },
      { id: 'l8fp2', text: 'Titta på din historik i appen och påminn dig om hur långt du kommit.' },
      { id: 'l8fp3', text: 'Håll fast vid din plan – kontinuitet är nyckeln.' }
    ],
    tips: [{ id: 'l8t1', text: 'Gör något kul av din hälsosatsning. Kanske bjuder du in någon till en promenad, testar en utmaning i appen eller hittar ett recept ni kan laga ihop. Glädje och gemenskap gör det lättare.' }],
    reflection: { id: 'l8r1', question: 'Vad får dig att le när du tänker på de framsteg du gjort?' }
  },
  {
    id: 'lektion9',
    title: 'Lektion 9 – Finjustera',
    introduction: 'Du har kommit långt – och nu handlar det om detaljerna. Den här lektionen fokuserar på att slipa på det du redan gör bra.',
    detailedText: 'Börja med att titta på portionsstorlekarna i din matlogg. Har mängderna förändrats med tiden? Om du vill dubbelkolla – använd en handbaserad metod, till exempel handflata för protein, knytnäve för grönsaker, eller mät upp med decilitermått.\nSe också till att varje måltid innehåller en bra proteinkälla. Protein hjälper dig att känna dig mätt, behålla muskelmassa och stödja fettförbränning.\nOm du är igång med fysisk aktivitet kan du prova att öka tempot lite, lägga till fler steg eller testa något nytt. Även utan formell träning går det att öka intensiteten.',
    focusPoints: [
      { id: 'l9fp1', text: 'Dubbelkolla dina portionsstorlekar.' },
      { id: 'l9fp2', text: 'Säkerställ att varje huvudmåltid innehåller en bra proteinkälla.' },
      { id: 'l9fp3', text: 'Öka intensiteten lite i din befintliga rörelse eller träning.' }
    ],
    tips: [{ id: 'l9t1', text: 'Fokusera gärna lite extra på sömnen den här veckan. Bra sömn hjälper kroppen att återhämta sig, reglera hunger och hantera stress.' }],
    reflection: { id: 'l9r1', question: 'Vilken liten förändring tror du kan ge dig störst effekt just nu?' }
  },
  {
    id: 'lektion10',
    title: 'Lektion 10 – Ge allt',
    introduction: 'Du har kommit långt – och nu är det dags för slutspurten. Den här lektionen handlar om att gå all in i dina vanor under en kort, tydlig period.',
    detailedText: 'Försök nu att följa din plan så nära det går. Logga varje måltid, varje dryck, varje vana i appen – inte för att kontrollera dig själv, utan för att ta full kontroll över dina val. Det är bara en vecka – och det är du som styr.\nOm rörelse eller träning är en del av din resa, gör den med glädje och syfte. Påminn dig om vad du faktiskt klarar idag.\nStanna också upp och titta på vad du har byggt upp: din streak, din nivå i appen, din historik. Allt det visar inte bara på disciplin – det visar på engagemang.',
    focusPoints: [
      { id: 'l10fp1', text: 'Följ din plan så nära det går denna vecka.' },
      { id: 'l10fp2', text: 'Utför din planerade rörelse med glädje och syfte.' },
      { id: 'l10fp3', text: 'Uppmärksamma din resa och dina framsteg i appen.' }
    ],
    tips: [{ id: 'l10t1', text: 'Skriv ett peppbrev till dig själv i appens reflektionsfält. Påminn dig om varför du började, vad du har lärt dig och varför det här betyder något för dig.' }],
    reflection: { id: 'l10r1', question: 'Vad skulle du säga till en vän som kämpat lika bra som du gjort?' }
  },
  {
    id: 'lektion11',
    title: 'Lektion 11 – Plan för framtiden',
    introduction: 'Du är nästan i mål – men det viktigaste börjar egentligen nu. Målet har inte bara varit att få resultat, utan att bygga en livsstil du kan leva med.',
    detailedText: 'Börja med att skriva ner tre vanor du vill behålla långsiktigt. Det kan vara enkla men viktiga saker, som att äta frukost varje dag, ta kvällspromenader eller planera maten inför veckan. Välj sådant du vet gör skillnad – och som du trivs med.\nTitta också på hur du vill följa upp dig själv efter kursen. Kanske vill du fortsätta logga vissa måltider i appen, sätta upp nya mål i profilen eller göra en veckosummering varje söndag.\nTa gärna en stund och gå tillbaka genom din resa i appen: matloggar, reflektioner, steg, nivåer. Vad har förändrats – i vanor, tankar och känsla?',
    focusPoints: [
      { id: 'l11fp1', text: 'Identifiera och skriv ner 3 vanor du vill behålla långsiktigt.' },
      { id: 'l11fp2', text: 'Gör en plan för hur du ska följa upp dig själv efter kursen.' },
      { id: 'l11fp3', text: 'Reflektera över hela din resa och vad som förändrats.' }
    ],
    tips: [{ id: 'l11t1', text: 'Skapa en kalenderplan för de kommande fyra veckorna. Fundera över: När handlar du mat? När lagar du matlådor? När får du in rörelse eller återhämtning?' }],
    reflection: { id: 'l11r1', question: 'Hur vill du må om tre månader – fysiskt, mentalt och i vardagen? Vad behöver du fortsätta göra för att ta dig dit?' }
  },
  {
    id: 'lektion12',
    title: 'Lektion 12 – Fira och fortsätt',
    introduction: 'Stort grattis – du har gjort det. Du har genomfört hela programmet, vecka för vecka, steg för steg.',
    detailedText: 'Du har inte bara tagit dig igenom en kurs – du har påbörjat en livsstilsförändring. Och nu är det dags att stanna upp, se vad du åstadkommit och bestämma hur du vill gå vidare.\nBörja med att göra din slutmätning i appen – oavsett om du använder vanlig våg eller InBody.\nTitta sedan tillbaka på hela din resa. Vad har du vunnit – fysiskt, mentalt, i vardagen? Använd appens historik, nivåer och reflektionsfält för att summera.\nNu är det dags att skapa ditt liv efter programmet. Vad behöver du för att hålla i det du har byggt?',
    focusPoints: [
      { id: 'l12fp1', text: 'Gör din slutmätning för att se ditt slutgiltiga resultat!', cta: { label: 'Logga Slutmätning', action: 'openLogWeightModal' } },
      { id: 'l12fp2', text: 'Summera dina största vinster – fysiskt och mentalt.' },
      { id: 'l12fp3', text: 'Skapa din plan för att fortsätta din hälsosamma livsstil.' }
    ],
    tips: [{ id: 'l12t1', text: 'Fira på ett sätt som stärker det du har uppnått. Det kan vara en lång promenad, ett nytt plagg som symboliserar förändringen, en stund för dig själv eller att skriva ner hur stolt du är.' }],
    reflection: { id: 'l12r1', question: 'Vilken är den viktigaste förändringen du har gjort? Och hur ska du behålla den – inte bara den här veckan, utan även framåt?' }
  }
];
