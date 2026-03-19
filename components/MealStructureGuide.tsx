import React, { useState } from 'react';
import { Coffee, Sandwich, CookingPot, Apple, Droplet, ChevronDown, ChevronUp } from 'lucide-react';
import { ShieldCheckIcon, InformationCircleIcon } from './icons';

interface MealStructureGuideProps {
  calorieGoal: number;
  proteinGoal: number;
}

const MealStructureGuide: React.FC<MealStructureGuideProps> = ({ calorieGoal, proteinGoal }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Simple breakdown: 25% Breakfast, 35% Lunch, 30% Dinner, 10% Snacks
  const breakfast = Math.round(calorieGoal * 0.25);
  const breakfastProtein = Math.round(proteinGoal * 0.25);
  
  const lunch = Math.round(calorieGoal * 0.35);
  const lunchProtein = Math.round(proteinGoal * 0.35);
  
  const dinner = Math.round(calorieGoal * 0.30);
  const dinnerProtein = Math.round(proteinGoal * 0.30);
  
  const snacks = Math.round(calorieGoal * 0.10);
  const snacksProtein = Math.round(proteinGoal * 0.10);

  return (
    <div className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light mb-6 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="w-7 h-7 text-primary" />
          <h2 className="text-xl font-black text-neutral-dark uppercase tracking-wider">
            Generalens Måltidsstruktur
          </h2>
        </div>
        {isOpen ? <ChevronUp className="w-6 h-6 text-neutral" /> : <ChevronDown className="w-6 h-6 text-neutral" />}
      </button>

      {isOpen && (
        <div className="p-6 border-t border-neutral-light animate-fade-in">
          <p className="text-sm text-neutral-dark font-medium mb-6 leading-relaxed">
            <strong>LYSTRING REKRYT!</strong> För att nå ditt mål på <strong>{calorieGoal} kcal</strong> och <strong>{proteinGoal}g protein</strong> krävs disciplin och planering. Här är din order för hur du fördelar intaget över dagen för maximal prestation. Inga undantag!
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-2">
                <Coffee className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-neutral-dark uppercase">Frukost</span>
              <span className="text-lg font-extrabold text-orange-600">~{breakfast} <span className="text-xs font-medium">kcal</span></span>
              <span className="text-xs font-bold text-neutral-500 mt-1">~{breakfastProtein}g protein</span>
            </div>
            
            <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                <Sandwich className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-neutral-dark uppercase">Lunch</span>
              <span className="text-lg font-extrabold text-green-600">~{lunch} <span className="text-xs font-medium">kcal</span></span>
              <span className="text-xs font-bold text-neutral-500 mt-1">~{lunchProtein}g protein</span>
            </div>

            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                <CookingPot className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-neutral-dark uppercase">Middag</span>
              <span className="text-lg font-extrabold text-indigo-600">~{dinner} <span className="text-xs font-medium">kcal</span></span>
              <span className="text-xs font-bold text-neutral-500 mt-1">~{dinnerProtein}g protein</span>
            </div>

            <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-2">
                <Apple className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-neutral-dark uppercase">Mellanmål</span>
              <span className="text-lg font-extrabold text-purple-600">~{snacks} <span className="text-xs font-medium">kcal</span></span>
              <span className="text-xs font-bold text-neutral-500 mt-1">~{snacksProtein}g protein</span>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-dark mb-1 uppercase tracking-wide">Flytande kalorier är fienden!</h4>
              <p className="text-xs text-neutral-dark leading-relaxed">
                Juice, läsk, mjölk i kaffet och alkohol är bakhåll som saboterar ditt uppdrag. De ger massor av energi men mättar noll. Ett glas juice kan ge över 90 kcal, och en stor latte över 150 kcal. <strong>Välj vatten eller svart kaffe!</strong> Spara kalorierna till mat som bygger din kropp.
              </p>
            </div>
          </div>

          <div className="bg-primary-50 p-4 rounded-2xl border border-primary-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-darker shrink-0">
              <InformationCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-dark mb-1 uppercase tracking-wide">Slut på fantasi i byssan?</h4>
              <p className="text-xs text-neutral-dark leading-relaxed">
                Använd AI-assistenten när du loggar mat för att få fram skräddarsydda recept som exakt matchar ditt kalorimål och dina preferenser. Klicka på "Receptförslag" i menyn. Inga ursäkter för dålig mat!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealStructureGuide;
