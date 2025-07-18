import React, { useState, useEffect } from "react";
import { auth } from "../firebase"; // Adjusted path
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence, 
  sendPasswordResetEmail 
} from "@firebase/auth"; 

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
          className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-2xl animate-scale-in max-h-[85vh] flex flex-col"
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
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto custom-scrollbar pr-2 space-y-2">
            <p>
              För att använda Kostloggen behöver du godkänna följande villkor. Tjänsten är framtagen för att hjälpa dig förstå dina matvanor, stötta din hälsoutveckling och skapa hållbara rutiner. Din integritet är viktig för oss och vi hanterar dina uppgifter med största omsorg.
            </p>
            <h4 className="font-semibold text-neutral-dark pt-3">1. Ditt ansvar</h4>
            <p className="text-sm text-neutral-dark">
              Du ansvarar för att uppgifterna du registrerar i Kostloggen är sanningsenliga och relevanta.
            </p>
            <p className="text-sm text-neutral-dark">
              Tjänsten är ett stödverktyg och ersätter inte medicinsk rådgivning. Vid sjukdom eller annan behandlingskrävande problematik bör du alltid rådfråga vårdpersonal innan du gör större förändringar i kost eller livsstil.
            </p>
            <h4 className="font-semibold text-neutral-dark pt-3">2. Hantering av personuppgifter och datalagring</h4>
            <p className="text-sm text-neutral-dark">
              Dina inmatade uppgifter sparas i molnet via Google Firebase. Endast behörig personal på Flexibel Hälsostudio har tillgång till uppgifterna och endast i syfte att stödja dig i ditt hälsoprogram.
            </p>
            <p className="text-sm text-neutral-dark">
              Vi följer gällande dataskyddsförordning (GDPR). Dina uppgifter behandlas konfidentiellt och delas aldrig med tredje part utan ditt uttryckliga samtycke.
            </p>
            <p className="text-sm text-neutral-dark">
              Du har rätt att när som helst begära ut, rätta eller radera dina uppgifter. Kontakta oss om du önskar detta.
            </p>
            <h4 className="font-semibold text-neutral-dark pt-3">3. Ansvarsbegränsning</h4>
            <p className="text-sm text-neutral-dark">
              Kostloggen är ett hjälpmedel för att öka medvetenhet kring kostvanor, men garanterar inte specifika resultat.
            </p>
            <p className="text-sm text-neutral-dark">
              Flexibel Hälsostudio ansvarar inte för eventuella negativa effekter om informationen används på ett sätt som inte överensstämmer med våra riktlinjer eller dina personliga behov.
            </p>
            <h4 className="font-semibold text-neutral-dark pt-3">4. Godkännande av villkor</h4>
            <p className="text-sm text-neutral-dark">
              Genom att börja använda Kostloggen bekräftar du att du har tagit del av och godkänner dessa villkor. Om du har frågor kring tjänsten, datalagring eller hur vi hanterar din information – kontakta din coach på Flexibel Hälsostudio.
            </p>
          </div>
          <div className="mt-6 flex-shrink-0 text-right">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm"
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
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);


  // Clear error and reset feedback when switching modes or input changes
  useEffect(() => {
    setError(null);
    setResetFeedback(null);
    if(isLogin) {
      setAgreedToTerms(false);
    }
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

    if (!isLogin && !agreedToTerms) {
        setError("Du måste godkänna villkoren för att skapa ett konto.");
        return;
    }

    setIsLoading(true);

    try {
      // Set persistence to local (remember user across sessions)
      await setPersistence(auth, browserLocalPersistence); 
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password); 
      } else {
        await createUserWithEmailAndPassword(auth, email, password); 
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
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-neutral-light p-4 pt-12 sm:pt-4">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-fade-in">
          <div className="text-center mb-6">
            <img src="/favicon.png" alt="Kostloggen.se logo" className="h-20 w-20 mx-auto mb-3" />
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-dark">{isLogin ? "Logga in" : "Skapa konto"}</h2>
            <p className="text-neutral mt-1">{isLogin ? "Välkommen tillbaka!" : "Fyll i dina uppgifter för att börja."}</p>
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

            {!isLogin && (
                <div className="flex items-start space-x-3 pt-2">
                    <input
                        id="terms"
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
                        aria-describedby="terms-label"
                    />
                    <label htmlFor="terms" id="terms-label" className="text-sm text-neutral">
                        Jag har läst och godkänner{' '}
                        <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="font-semibold text-primary hover:underline"
                        >
                            villkoren
                        </button>
                        {' '}för att använda Kostloggen.
                    </label>
                </div>
            )}

            <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading || (!isLogin && !agreedToTerms)}
                  className={`${buttonBaseClass} bg-primary hover:bg-primary-darker`}
                >
                  {isLoading && !resetFeedback ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>
                  ) : (isLogin ? "Logga in" : "Registrera konto")}
                </button>
            </div>
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
