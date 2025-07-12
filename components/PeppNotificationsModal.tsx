
import React from 'react';
import { PeppNotificationItem } from '../App';
import { HeartIcon, XMarkIcon } from './icons';

interface PeppNotificationsModalProps {
    show: boolean;
    onClose: () => void;
    feedItems: PeppNotificationItem[];
    isLoading: boolean;
}

const timeAgo = (timestamp: number): string => {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) return `${seconds}s sedan`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m sedan`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}t sedan`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d sedan`;
    
    return new Date(timestamp).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const PeppNotificationsModal: React.FC<PeppNotificationsModalProps> = ({ show, onClose, feedItems, isLoading }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pepp-notifications-title"
        >
            <div
                className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-md max-h-[70vh] flex flex-col animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-light/70 flex-shrink-0">
                    <h2 id="pepp-notifications-title" className="text-2xl font-semibold text-neutral-dark flex items-center">
                        <HeartIcon className="w-7 h-7 mr-2.5 text-red-500" />
                        Notiser
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90"
                        aria-label="Stäng notiser"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar -mr-3 pr-3">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : feedItems.length === 0 ? (
                        <p className="text-center text-neutral py-10">Inga nya notiser.</p>
                    ) : (
                        <div className="space-y-3">
                            {feedItems.map((item) => (
                                <div key={item.uniqueId} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-neutral-light/50 transition-colors">
                                    <div className="mt-1 flex-shrink-0">
                                        <span className="text-2xl" role="img">{item.event.icon}</span>
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-sm text-neutral-dark">
                                            <span className="font-bold">{item.peppData.name}</span>
                                            {` peppade din ${item.event.type === 'achievement' ? 'bragd' : 'mätning'}: `}
                                            <span className="font-semibold text-primary-darker">"{item.event.title}"</span>
                                        </p>
                                        <p className="text-xs text-neutral mt-0.5">
                                            {timeAgo(item.peppData.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PeppNotificationsModal;
