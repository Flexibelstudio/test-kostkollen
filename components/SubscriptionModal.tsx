
import React, { useState } from 'react';
import { XMarkIcon, CreditCardIcon, ExclamationTriangleIcon } from './icons';
import { cancelSubscription, undoCancelSubscription, createStripePortalSession } from '../services/firestoreService';

interface SubscriptionModalProps {
  show: boolean;
  onClose: () => void;
  status: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | undefined;
  currentPeriodEnd?: string;
  onCancelSuccess?: () => void;
  onUndoCancelSuccess?: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ show, onClose, status, currentPeriodEnd, onCancelSuccess, onUndoCancelSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!show) return null;

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const url = await createStripePortalSession();
      if (url) {
        window.location.href = url;
      } else {
        alert("Kunde inte skapa portal-session hos Stripe.");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      alert(error.message || "Ett fel uppstod när betalningsportalen skulle öppnas.");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
        // We pass userId implicitly via auth context in backend
        await cancelSubscription('dummy'); // 'dummy' because auth context handles uid on backend
        setMessage("Din prenumeration har sagts upp. Du har tillgång perioden ut.");
        setShowConfirm(false);
        if (onCancelSuccess) {
            onCancelSuccess();
        }
    } catch (error: any) {
        setMessage(error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUndoCancel = async () => {
    setIsProcessing(true);
    try {
        await undoCancelSubscription('dummy');
        setMessage("Din prenumeration har återaktiverats och kommer att förnyas som vanligt.");
        if (onUndoCancelSuccess) {
            onUndoCancelSuccess();
        }
    } catch (error: any) {
        setMessage(error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
      if (!dateString) return "snart";
      return new Date(dateString).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-darker">
                    <CreditCardIcon className="w-6 h-6" />
                </div>
                <h2 id="sub-modal-title" className="text-2xl font-bold text-neutral-dark">
                    Prenumeration
                </h2>
            </div>
            <button
                onClick={onClose}
                className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
                aria-label="Stäng"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        {message ? (
             <div className="text-center py-6 space-y-4">
                <div className="bg-[#E8EFE9] text-[#2B3B2C] p-4 rounded-xl">
                    <p className="font-medium">{message}</p>
                </div>
                <button onClick={onClose} className="px-6 py-2 bg-[#F1EAE0] hover:bg-[#E5DCD0] rounded-lg font-semibold">Stäng</button>
             </div>
        ) : (
            <div className="space-y-6">
                <div className="bg-neutral-light/30 p-4 rounded-xl border border-neutral-light">
                    <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1">Status</p>
                    <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${(status === 'active' || status === 'trialing') ? 'text-[#2B3B2C]' : 'text-[#D96E4A]'}`}>
                            {status === 'active' ? 'Aktiv' : status === 'trialing' ? 'Gratisperiod' : status === 'canceling' ? 'Avslutas snart' : 'Avslutad'}
                        </span>
                        {status === 'active' && (
                            <span className="text-sm bg-[#E8EFE9] text-[#2B3B2C] px-2 py-1 rounded-md">Förnyas automatiskt</span>
                        )}
                        {status === 'trialing' && (
                            <span className="text-sm bg-[#E8EFE9] text-[#2B3B2C] px-2 py-1 rounded-md font-semibold">Provperiod</span>
                        )}
                    </div>
                    {(status === 'active' || status === 'trialing' || status === 'canceling') && currentPeriodEnd && (
                        <p className="text-sm text-neutral-dark mt-2">
                            {status === 'trialing' ? 'Första dragningen:' : status === 'active' ? 'Nästa dragning:' : 'Tillgång t.o.m:'} <strong>{formatDate(currentPeriodEnd)}</strong>
                        </p>
                    )}
                </div>

                {(status === 'active' || status === 'trialing' || status === 'canceling') && (
                    <button 
                        onClick={handleOpenPortal}
                        disabled={isOpeningPortal}
                        className="w-full py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        {isOpeningPortal ? (
                            <span>Laddar...</span>
                        ) : (
                            <>
                                <span>💳</span>
                                <span>Hantera betalmetod & kvitton (Stripe)</span>
                            </>
                        )}
                    </button>
                )}

                {(status === 'active' || status === 'trialing') && !showConfirm && (
                    <button 
                        onClick={() => setShowConfirm(true)}
                        className="w-full text-center py-2 text-neutral hover:text-red-600 rounded-lg text-xs transition-colors border border-transparent hover:bg-red-50"
                    >
                        Avsluta {status === 'trialing' ? 'gratisperioden' : 'prenumeration'}
                    </button>
                )}

                {showConfirm && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-fade-in">
                        <div className="flex items-start gap-3 mb-3">
                            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-700">Är du säker?</h4>
                                <p className="text-sm text-red-600 mt-1">
                                    {status === 'trialing' 
                                        ? `Ditt kort kommer inte att debiteras efter provperiodens slut den ${formatDate(currentPeriodEnd)}. Du behåller din tillgång under resterande provdagar.`
                                        : `Din prenumeration kommer inte att förnyas efter ${formatDate(currentPeriodEnd)}. Du behåller din tillgång fram till dess.`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2 bg-white text-neutral-dark font-medium rounded-lg shadow-sm border border-neutral-light hover:bg-gray-50"
                            >
                                Behåll
                            </button>
                            <button 
                                onClick={handleCancel}
                                disabled={isProcessing}
                                className="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Avslutar...' : 'Ja, avsluta'}
                            </button>
                        </div>
                    </div>
                )}
                
                {status === 'canceling' && (
                    <div className="space-y-4">
                        <p className="text-sm text-center text-neutral">
                            Du har sagt upp din prenumeration. Hoppas vi ses igen!
                        </p>
                        <button 
                            onClick={handleUndoCancel}
                            disabled={isProcessing}
                            className="w-full py-3 text-primary-darker font-semibold hover:bg-primary-50 rounded-lg border border-primary-200 transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? 'Återaktiverar...' : 'Ångra uppsägning'}
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionModal;
