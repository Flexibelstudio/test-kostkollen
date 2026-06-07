import React, { useState, useEffect } from "react";
import { auth } from "../firebase"; // Adjusted path
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from "@firebase/auth"; 
import { ensureUserProfileInFirestore } from "../services/firestoreService";

import { UserCircleIcon, LockClosedIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, KeyIcon, CheckCircleIcon, XMarkIcon } from './icons'; 

interface AuthFormProps {
  onAuthStateChange: (user: any | null) => void; 
}

const TermsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
      <div
        className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
      >
        <div
          className="bg-white p-6 sm:p-8 rounded-3xl shadow-soft-xl w-full max-w-2xl animate-scale-in max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 id="terms-modal-title" className="text-xl font-semibold text-neutral-dark">
              Villkor för Kostloggen
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral hover:text-red-500 rounded-full hover:bg-red-100"
              aria-label="Stäng villkor"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-4">
            <p className="text-base text-neutral-dark leading-relaxed">
              För att använda Kostloggen behöver du godkänna följande villkor. Tjänsten är framtagen för att hjälpa dig förstå dina matvanor, stötta din hälsoutveckling och skapa hållbara rutiner. Din integritet är viktig för oss och vi hanterar dina uppgifter med största omsorg.
            </p>
            <h4 className="font-bold text-neutral-dark pt-3 text-lg">1. Ditt ansvar</h4>
            <p className="text-sm text-neutral leading-relaxed">
              Du ansvarar för att uppgifterna du registrerar i Kostloggen är sanningsenliga och relevanta.
            </p>
            <p className="text-sm text-neutral leading-relaxed">
              Tjänsten är ett stödverktyg och ersätter inte medicinsk rådgivning. Vid sjukdom eller annan behandlingskrävande problematik bör du alltid rådfråga vårdpersonal innan du gör större förändringar i kost eller livsstil.
            </p>
            <h4 className="font-bold text-neutral-dark pt-3 text-lg">2. Hantering av personuppgifter och datalagring</h4>
            <p className="text-sm text-neutral leading-relaxed">
              Dina inmatade uppgifter sparas i molnet via Google Firebase. Endast behörig personal på Flexibel Hälsostudio har tillgång till uppgifterna och endast i syfte att stödja dig i ditt hälsoprogram.
            </p>
            <p className="text-sm text-neutral leading-relaxed">
              Vi följer gällande dataskyddsförordning (GDPR). Dina uppgifter behandlas konfidentiellt och delas aldrig med tredje part utan ditt uttryckliga samtycke.
            </p>
            <p className="text-sm text-neutral leading-relaxed">
              Du har rätt att när som helst begära ut, rätta eller radera dina uppgifter. Kontakta oss om du önskar detta.
            </p>
            <h4 className="font-bold text-neutral-dark pt-3 text-lg">3. Ansvarsbegränsning</h4>
            <p className="text-sm text-neutral leading-relaxed">
              Kostloggen är ett hjälpmedel för att öka medvetenhet kring kostvanor, men garanterar inte specifika resultat.
            </p>
            <p className="text-sm text-neutral leading-relaxed">
              Flexibel Hälsostudio ansvarar inte för eventuella negativa effekter om informationen används på ett sätt som inte överensstämmer med våra riktlinjer eller dina personliga behov.
            </p>
            <h4 className="font-bold text-neutral-dark pt-3 text-lg">4. Godkännande av villkor</h4>
            <p className="text-sm text-neutral leading-relaxed">
              Genom att börja använda Kostloggen bekräftar du att du har tagit del av och godkänner dessa villkor. Om du har frågor kring tjänsten, datalagring eller hur vi hanterar din information – kontakta din coach på Flexibel Hälsostudio.
            </p>
          </div>
          <div className="mt-4 flex-shrink-0 text-right pt-4 border-t border-neutral-light/70">
            <button
              onClick={onClose}
              className="px-6 py-3 text-base font-bold text-white bg-primary hover:bg-primary-darker rounded-xl shadow-md active:scale-95 interactive-transition"
            >
              Jag förstår
            </button>
          </div>
        </div>
      </div>
    );

export const AuthForm: React.FC<AuthFormProps> = ({ onAuthStateChange }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'login' || params.get('login') === 'true';
    }
    return false; // Default to signup (Starta konto)
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Passive agreement under the button, defaults to true
  const [showTermsModal, setShowTermsModal] = useState(false);


  // Clear error and reset feedback when switching modes or input changes
  useEffect(() => {
    setError(null);
    setResetFeedback(null);
  }, [isLogin, email, password]);

  const handlePasswordReset = async () => {
    if (!email) {
      setResetFeedback({ message: "Vänligen ange din e-postadress först.", type: 'error' });
      return;
    }
    setIsLoading(true);
    setResetFeedback(null);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email); 
      setResetFeedback({ message: "En länk för återställning av lösenord har skickats till din e-postadress om kontot finns.", type: 'success'});
    } catch (err: any) {
      if (err.code === 'auth/invalid-email') {
        setResetFeedback({ message: "Ogiltigt e-postformat.", type: 'error'});
      } else if (err.code === 'auth/user-not-found') {
        // Don't reveal if user exists for security, same message as success
        setResetFeedback({ message: "En länk för återställning av lösenord har skickats till din e-postadress om kontot finns.", type: 'success'});
      }
      else {
        setResetFeedback({ message: "Kunde inte skicka återställningslänk. Försök igen.", type: 'error'});
      }
      console.error("Password reset error:", err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetFeedback(null);

    setIsLoading(true);

    try {
      // Persistence is now set globally in firebase.ts

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password); 
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Explicitly ensure user profile exists in Firestore immediately
        await ensureUserProfileInFirestore(userCredential.user);
      }
      // onAuthStateChanged in App.tsx will handle the rest
    } catch (err: any) {
      if (err.code) {
        switch (err.code) {
          case 'auth/invalid-email':
            setError("Ogiltigt e-postformat.");
            break;
          case 'auth/user-disabled':
            setError("Detta konto har inaktiverats.");
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
          // To prevent account enumeration, use a generic message for login failures
            setError("Felaktig e-postadress eller lösenord.");
            break;
          case 'auth/email-already-in-use':
            setError("E-postadressen används redan. Prova att logga in.");
            break;
          case 'auth/weak-password':
            setError("Lösenordet är för svagt. Använd minst 6 tecken.");
            break;
          case 'auth/operation-not-allowed':
             setError("Inloggning med e-post och lösenord är inte aktiverat.");
             break;
          case 'auth/too-many-requests':
            setError("För många misslyckade inloggningsförsök. Återställ lösenord eller försök igen senare.");
            break;
          default:
            setError("Ett fel uppstod. Försök igen.");
        }
      } else {
        setError(err.message || "Ett okänt fel uppstod.");
      }
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass = "w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors";
  const passwordInputClass = "pr-12"; // Add padding for the icon
  const buttonBaseClass = "w-full py-3 px-6 rounded-lg font-semibold text-white text-lg shadow-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed interactive-transition active:scale-95"; // Added px-6, text-lg, shadow-md

  return (
    <>
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-neutral-light bg-dotted-pattern bg-dotted-size p-4 pt-12 sm:pt-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-soft-xl w-full max-w-md animate-scale-in border border-neutral-light/50">
          <div className="text-center mb-6">
            <img src="/favicon.png" alt="Kostloggen.se logo" className="h-20 w-20 mx-auto mb-3 drop-shadow-sm" />
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-dark">
              {isLogin ? "Logga in" : "Starta dina 7 gratisdagar"}
            </h2>
            <p className="text-neutral mt-2 text-sm font-medium leading-relaxed">
              {isLogin 
                ? "Välkommen tillbaka!" 
                : "Du betalar inget idag. 95 kr/mån efter provperioden – avsluta när du vill."}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">E-post</label>
              <input
                id="email"
                type="email"
                value={email}
                placeholder="E-postadress"
                onChange={e => setEmail(e.target.value)}
                className={inputBaseClass}
                required
                aria-describedby={error || resetFeedback ? "auth-feedback" : undefined}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Lösenord</label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="Lösenord"
                onChange={e => setPassword(e.target.value)}
                className={`${inputBaseClass} ${passwordInputClass} relative z-10`}
                required
                aria-describedby={error || resetFeedback ? "auth-feedback" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-primary focus:outline-none z-20"
                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={`${buttonBaseClass} bg-primary hover:bg-primary-darker`}
                >
                  {isLoading && !resetFeedback ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>
                  ) : (isLogin ? "Logga in" : "Starta 7 dagar gratis")}
                </button>
            </div>

            {!isLogin && (
              <p className="text-xs text-neutral text-center mt-3 leading-relaxed">
                Genom att skapa konto godkänner du{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="font-semibold text-primary hover:underline"
                >
                  villkoren
                </button>
                .
              </p>
            )}
          </form>

          {(error || resetFeedback) && (
            <div 
              id="auth-feedback" 
              role="alert" 
              className={`mt-4 p-3 border rounded-lg flex items-center text-sm animate-fade-in
                ${resetFeedback?.type === 'success' ? 'bg-green-50 border-green-300 text-green-700' : 
                  resetFeedback?.type === 'error' ? 'bg-red-50 border-red-300 text-red-700' : 
                  error ? 'bg-red-50 border-red-300 text-red-700' : ''
                }`}
            >
              {resetFeedback?.type === 'success' ? <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" /> : <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />}
              {resetFeedback?.message || error}
            </div>
          )}

          <div className="mt-6 text-sm text-center">
              {isLogin && (
                   <button 
                      onClick={handlePasswordReset}
                      disabled={isLoading}
                      className="text-primary hover:text-primary-darker hover:underline font-medium"
                  >
                      Glömt lösenord?
                  </button>
              )}
          </div>
          
          <div className="mt-6 text-center">
            <button 
              onClick={() => {setIsLogin(!isLogin); setError(null); setResetFeedback(null);}} 
              className="text-sm w-full text-primary hover:text-primary-darker font-medium"
            >
              {isLogin ? "Inget konto? Skapa ett här" : "Har du redan ett konto? Logga in"}
            </button>
          </div>
        </div>
      </div>
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
    </>
  );
};