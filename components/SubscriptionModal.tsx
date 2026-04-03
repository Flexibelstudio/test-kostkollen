
import React, { useState } from 'react';
import { XMarkIcon, CreditCardIcon, ExclamationTriangleIcon } from './icons';
import { cancelSubscription } from '../services/firestoreService';

interface SubscriptionModalProps {
  show: boolean;
  onClose: () => void;
  status: 'active' | 'trialing' | 'canceling' | 'canceled' | 'inactive' | undefined;
  currentPeriodEnd?: string;
  onCancelSuccess?: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ show, onClose, status, currentPeriodEnd, onCancelSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!show) return null;

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
                <div className="bg-green-100 text-green-700 p-4 rounded-xl">
                    <p className="font-medium">{message}</p>
                </div>
                <button onClick={onClose} className="px-6 py-2 bg-neutral-light hover:bg-gray-200 rounded-lg font-semibold">Stäng</button>
             </div>
        ) : (
            <div className="space-y-6">
                <div className="bg-neutral-light/30 p-4 rounded-xl border border-neutral-light">
                    <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1">Status</p>
                    <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${status === 'active' ? 'text-green-600' : 'text-orange-500'}`}>
                            {status === 'active' ? 'Aktiv' : status === 'canceling' ? 'Avslutas snart' : 'Avslutad'}
                        </span>
                        {status === 'active' && (
                            <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-md">Förnyas automatiskt</span>
                        )}
                    </div>
                    {(status === 'active' || status === 'canceling') && currentPeriodEnd && (
                        <p className="text-sm text-neutral-dark mt-2">
                            {status === 'active' ? 'Nästa dragning:' : 'Tillgång t.o.m:'} <strong>{formatDate(currentPeriodEnd)}</strong>
                        </p>
                    )}
                </div>

                {status === 'active' && !showConfirm && (
                    <button 
                        onClick={() => setShowConfirm(true)}
                        className="w-full py-3 text-red-600 font-semibold hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                    >
                        Avsluta prenumeration
                    </button>
                )}

                {showConfirm && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-fade-in">
                        <div className="flex items-start gap-3 mb-3">
                            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-700">Är du säker?</h4>
                                <p className="text-sm text-red-600 mt-1">
                                    Din prenumeration kommer inte att förnyas efter {formatDate(currentPeriodEnd)}. Du behåller din tillgång fram till dess.
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
                    <p className="text-sm text-center text-neutral">
                        Du har sagt upp din prenumeration. Hoppas vi ses igen!
                    </p>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionModal;
