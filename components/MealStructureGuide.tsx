import React from 'react';
import { Droplet } from 'lucide-react';
import { InformationCircleIcon } from './icons';

interface MealStructureGuideProps {
  calorieGoal: number;
}

const MealStructureGuide: React.FC<MealStructureGuideProps> = ({ calorieGoal }) => {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light mb-4">
      <div className="flex items-center gap-2 mb-4">
        <InformationCircleIcon className="w-6 h-6 text-primary" />
        <h3 className="text-lg font-bold text-neutral-dark uppercase tracking-wider">Tips för Kostloggen</h3>
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Droplet className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-neutral-dark mb-1">Se upp för flytande kalorier!</h4>
          <p className="text-xs text-neutral leading-relaxed">
            Drycker som juice, läsk, mjölk i kaffet och alkohol innehåller ofta mycket energi men mättar dåligt. 
            Ett glas juice (2 dl) kan ge över 90 kcal, och en stor latte kan ge över 150 kcal. 
            Välj vatten, kaffe eller te (utan socker/mjölk) som din primära dryck för att spara dina kalorier till mat som mättar.
          </p>
        </div>
      </div>

      <div className="bg-primary-50 p-4 rounded-2xl border border-primary-100 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-darker shrink-0">
          <InformationCircleIcon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-neutral-dark mb-1">Behöver du receptinspiration?</h4>
          <p className="text-xs text-neutral leading-relaxed">
            När du lägger till en måltid kan du använda vår AI-assistent för att få skräddarsydda receptförslag som passar just ditt kalorimål och dina preferenser. Klicka på "Receptförslag" i menyn!
          </p>
        </div>
      </div>
    </div>
  );
};

export default MealStructureGuide;
