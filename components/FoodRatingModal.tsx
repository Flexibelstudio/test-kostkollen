import React, { useMemo, useState } from 'react';
import { NutritionalInfo, UserProfileData, MealType } from '../types';
import { COACH_PERSONAS } from '../constants';
import { CheckCircleIcon, XMarkIcon, SmileIcon, MehIcon, FrownIcon, InformationCircleIcon } from './icons';

interface FoodRatingModalProps {
  show: boolean;
  onClose: () => void;
  nutritionalInfo: NutritionalInfo;
  mealType: MealType;
  userProfile: UserProfileData;
}

const FoodRatingModal: React.FC<FoodRatingModalProps> = ({ show, onClose, nutritionalInfo, mealType, userProfile }) => {
  const [showInfo, setShowInfo] = useState(false);

  if (!show) return null;

  const coachStyle = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[coachStyle] || COACH_PERSONAS['balanced'];

  const { score, rating, pros, cons, comment } = useMemo(() => {
    let currentScore = 50;
    const prosList: string[] = [];
    const consList: string[] = [];

    const { calories, protein, carbohydrates, fat } = nutritionalInfo;
    
    // Avoid division by zero
    const totalKcal = calories > 0 ? calories : 1;
    
    const proteinKcal = protein * 4;
    const carbsKcal = carbohydrates * 4;
    const fatKcal = fat * 9;

    const proteinRatio = proteinKcal / totalKcal;
    const fatRatio = fatKcal / totalKcal;
    const carbsRatio = carbsKcal / totalKcal;

    // Protein Logic
    if (proteinRatio > 0.30) {
      currentScore += 30;
      prosList.push('Mycket proteinrikt');
    } else if (proteinRatio > 0.20) {
      currentScore += 15;
      prosList.push('Bra proteinkälla');
    } else if (proteinRatio < 0.10 && calories > 150) {
      // Only penalize low protein if it's not a very low calorie snack (like an apple)
      currentScore -= 15;
      consList.push('Lågt proteininnehåll');
    }

    // Fat Logic
    if (fatRatio > 0.60) {
      currentScore -= 15;
      consList.push('Mycket hög andel fett');
    } else if (fatRatio > 0.40) {
      currentScore -= 5;
    }

    // Carbs Logic
    if (carbsRatio > 0.70 && calories > 150) {
      // Don't penalize high carbs for low calorie items (fruits)
      currentScore -= 10;
      consList.push('Mycket hög andel kolhydrater');
    }

    // Calorie Logic based on meal type
    if (mealType === 'snack') {
      if (calories > 400) {
        currentScore -= 15;
        consList.push('Väldigt energirikt för ett mellanmål');
      } else if (calories < 150) {
        currentScore += 15;
        prosList.push('Kalorisnålt och lätt');
      }
    } else {
      if (calories > 1000) {
        currentScore -= 15;
        consList.push('Mycket stor måltid');
      } else if (calories < 200) {
        consList.push('Väldigt liten måltid');
      }
    }

    // Cap score between 0 and 100
    currentScore = Math.max(0, Math.min(100, currentScore));

    let currentRating: 'good' | 'neutral' | 'bad' = 'neutral';
    if (currentScore >= 70) currentRating = 'good';
    else if (currentScore < 40) currentRating = 'bad';

    // Generate Coach Comment
    let coachComment = '';
    if (coachStyle === 'soft') {
      if (currentRating === 'good') coachComment = 'Jättebra val! Det här ger kroppen fin energi. 💚';
      else if (currentRating === 'neutral') coachComment = 'Helt okej! Ett lätt och fräscht val. 🤗';
      else coachComment = 'Det är okej att unna sig ibland, men försök få in mer protein nästa gång! 🩹';
    } else if (coachStyle === 'hard') {
      if (currentRating === 'good') coachComment = 'Perfekt bränsle! Bra jobbat! 🔥';
      else if (currentRating === 'neutral') coachComment = 'Helt okej, duger som bukfylla. 😐';
      else coachComment = 'Vad är det här för skräp?! Skärpning! 🛑';
    } else {
      // Balanced
      if (currentRating === 'good') coachComment = 'Bra makros! Ett stabilt val. ✅';
      else if (currentRating === 'neutral') coachComment = 'Ett okej val, varken jättebra eller dåligt. ➖';
      else coachComment = 'Inte optimalt. Mycket energi, lite protein. ❌';
    }

    return { score: currentScore, rating: currentRating, pros: prosList, cons: consList, comment: coachComment };
  }, [nutritionalInfo, mealType, coachStyle]);

  const ratingColors = {
    good: 'bg-green-500 text-white',
    neutral: 'bg-yellow-500 text-white',
    bad: 'bg-red-500 text-white'
  };

  const ratingFace = {
    good: <SmileIcon className="w-10 h-10" />,
    neutral: <MehIcon className="w-10 h-10" />,
    bad: <FrownIcon className="w-10 h-10" />
  };

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 text-center border-b border-neutral-light relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-dark">
            <XMarkIcon className="w-6 h-6" />
          </button>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Matbetyg</h2>
            <button 
              onClick={() => setShowInfo(!showInfo)} 
              className="text-neutral-400 hover:text-primary transition-colors"
              title="Hur funkar betyget?"
            >
              <InformationCircleIcon className="w-5 h-5" />
            </button>
          </div>

          {showInfo && (
            <div className="mb-6 p-4 bg-primary-50 text-primary-darker text-sm text-left rounded-xl border border-primary-100 animate-fade-in">
              <p className="font-bold mb-1">Hur tänker AI-coachen?</p>
              <p className="leading-relaxed">
                Coachen bedömer dina måltider utifrån en hälsosam helhet. Den ger glada tillrop för måltider som mättar bra (högt protein) och håller sig inom rimliga kalorimängder. Den varnar om en måltid innehåller en väldigt hög andel fett eller kolhydrater i förhållande till proteinet, eller om portionen är ovanligt stor för att vara en huvudmåltid eller ett mellanmål.
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-4xl shadow-md ${ratingColors[rating]}`}>
              {ratingFace[rating]}
            </div>
            <div className="text-left">
              <div className="text-4xl font-black text-neutral-dark">{Math.round(nutritionalInfo.calories)} <span className="text-lg font-medium text-neutral-500">kcal</span></div>
            </div>
          </div>
          <p className="text-lg font-medium text-neutral-dark mt-2 truncate px-4">{nutritionalInfo.foodItem || 'Måltid'}</p>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-2 p-6 bg-neutral-50 border-b border-neutral-light">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-blue-400 flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-neutral-dark">{Math.round(nutritionalInfo.carbohydrates)}g</span>
            </div>
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Kolhydrater</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-400 flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-neutral-dark">{Math.round(nutritionalInfo.protein)}g</span>
            </div>
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Protein</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-yellow-400 flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-neutral-dark">{Math.round(nutritionalInfo.fat)}g</span>
            </div>
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Fett</span>
          </div>
        </div>

        {/* Pros and Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="p-6 border-b border-neutral-light">
            <div className="space-y-2">
              {pros.map((pro, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-neutral-dark">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{pro}</span>
                </div>
              ))}
              {cons.map((con, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-neutral-dark">
                  <XMarkIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span>{con}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coach Comment */}
        <div className="p-6 bg-primary-50 flex gap-4 items-start">
          <div className="w-12 h-12 rounded-full flex-shrink-0 shadow-sm bg-white overflow-hidden flex items-center justify-center">
            {persona.imageUrl ? (
              <img src={persona.imageUrl} alt={persona.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{persona.emoji}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-primary-darker mb-1">{persona.label}</p>
            <p className="text-sm text-neutral-dark leading-relaxed">{comment}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-darker transition-colors"
          >
            Okej
          </button>
        </div>

      </div>
    </div>
  );
};

export default FoodRatingModal;
