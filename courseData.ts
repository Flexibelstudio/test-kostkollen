import { CourseLesson } from './types';

export const courseLessons: CourseLesson[] = [
  {
    id: 'lektion1',
    title: 'Lektion 1 – Din resa börjar här',
    introduction: 'Denna lektion handlar om att komma igång – att förstå varför du vill göra denna resa och hur du kan börja med små steg som gör stor skillnad.',
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
    focusPoints: [
      { id: 'l3fp1', text: 'Öva "mindful eating": ät långsamt och utan distraktion' },
      { id: 'l3fp2', text: 'Identifiera triggers som leder till överätande (notera i samband med din matloggning)' },
      { id: 'l3fp3', text: 'Lägg till styrka och flås i träningen – kanske prova ett kort HIIT-pass?' },
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
    aiPromptHint: 'challenges',
    focusPoints: [
      { id: 'l4fp1', text: 'Identifiera en situation där du haft svårt att följa planen (t.ex. genom att titta i din matlogg i appen)' },
      { id: 'l4fp2', text: 'Skapa en strategi i förväg: "Om X händer, gör jag Y"' },
      { id: 'l4fp3', text: 'Fortsätt med styrketräning och öka pulsen i vardagen (och logga gärna din aktivitet)' },
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
    focusPoints: [
      { id: 'l5fp1', text: 'Lägg till en ny hälsovana (t.ex. frukt till mellanmål, logga detta i appen)' },
      { id: 'l5fp2', text: 'Öka intensiteten i din träning – kanske ett extra pass?' },
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
    aiPromptHint: 'plateau',
    focusPoints: [
      { id: 'l7fp1', text: 'Revidera portionsstorlek (kolla din logg, väg maten) eller öka vardagsrörelsen' },
      { id: 'l7fp2', text: 'Lägg till variation i träning eller testa en ny övning' },
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
    focusPoints: [
      { id: 'l8fp1', text: 'Testa ett nytt recept (logga det och spara som "Vanligt val" i appen om det är en hit!) eller träningsform' },
      { id: 'l8fp2', text: 'Påminn dig själv om hälsofördelarna du redan uppnått (se din streak, nivå och historik i appen)' },
      { id: 'l8fp3', text: 'Fortsätt följa din plan – du är snart i mål (se dina satta mål i profilen)' },
    ],
    tips: [
      { id: 'l8t1', text: 'Bjud in någon till din träning eller gör en rolig utmaning.' }
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
    focusPoints: [
      { id: 'l9fp1', text: 'Kontrollera portionsstorlekar noggrant (använd matvåg och jämför med din logg i appen)' },
      { id: 'l9fp2', text: 'Se till att varje måltid innehåller protein (kolla näringsvärdena i din logg)' },
      { id: 'l9fp3', text: 'Träna med lite högre intensitet – kroppen är redo' },
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
    focusPoints: [
      { id: 'l10fp1', text: 'Följ planen fullt ut – inga spontana avsteg (håll din logg perfekt i appen!)' },
      { id: 'l10fp2', text: 'Träna med glädje och syfte – tänk hur stark du blivit' },
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
