
import React, { useMemo, useState } from 'react';
import { WeightLogEntry } from '../types';
import { User, Dumbbell, PieChart } from 'lucide-react';

interface WeightChartProps {
    data: WeightLogEntry[];
}

const LegendItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, colorClass, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isActive ? `${colorClass} text-white shadow` : 'bg-neutral-light text-neutral hover:bg-gray-300'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);


const WeightChart: React.FC<WeightChartProps> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: WeightLogEntry } | null>(null);
    const [seriesVisibility, setSeriesVisibility] = useState({
        weight: true,
        muscle: true,
        fat: true,
    });

    const svgWidth = 800;
    const svgHeight = 350;
    const margin = { top: 20, right: 20, bottom: 50, left: 40 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const { points, yScale, yTicks, xTicks, hasMuscleData, hasFatData } = useMemo(() => {
        if (data.length < 1) return { points: [], yScale: () => 0, yTicks: [], xTicks: [], hasMuscleData: false, hasFatData: false };

        const hasMuscleData = data.some(d => d.skeletalMuscleMassKg != null && d.skeletalMuscleMassKg > 0);
        const hasFatData = data.some(d => d.bodyFatMassKg != null && d.bodyFatMassKg > 0);

        const allValues = data.flatMap(d => {
            const values = [];
            if (seriesVisibility.weight) values.push(d.weightKg);
            if (hasMuscleData && seriesVisibility.muscle && d.skeletalMuscleMassKg != null) values.push(d.skeletalMuscleMassKg);
            if (hasFatData && seriesVisibility.fat && d.bodyFatMassKg != null) values.push(d.bodyFatMassKg);
            return values;
        }).filter(v => v != null);

        if (allValues.length === 0) return { points: [], yScale: () => 0, yTicks: [], xTicks: [], hasMuscleData, hasFatData };
        
        const minVal = Math.floor(Math.min(...allValues) - 2);
        const maxVal = Math.ceil(Math.max(...allValues) + 2);
        
        const xScale = (index: number) => (data.length <= 1) ? width / 2 : (index / (data.length - 1)) * width;
        const yScale = (value: number) => height - ((value - minVal) / (maxVal - minVal)) * height;
        
        const yTicks: number[] = [];
        const tickCount = 6;
        const range = maxVal - minVal;
        if (range > 0) {
            const step = Math.max(1, Math.ceil(range / tickCount / 2) * 2);
            for (let i = Math.floor(minVal / step) * step; i <= maxVal; i += step) {
                if (i >= minVal) yTicks.push(i);
            }
        } else {
             yTicks.push(minVal);
        }

        const points = data.map((d, i) => ({
            x: xScale(i),
            weightY: yScale(d.weightKg),
            muscleY: (hasMuscleData && d.skeletalMuscleMassKg != null) ? yScale(d.skeletalMuscleMassKg) : null,
            fatY: (hasFatData && d.bodyFatMassKg != null) ? yScale(d.bodyFatMassKg) : null,
            entry: d,
        }));
        
        const xTicks = points.map(p => ({ x: p.x, entry: p.entry }));

        return { points, yScale, yTicks, xTicks, hasMuscleData, hasFatData };
    }, [data, width, height, seriesVisibility]);

    const createPath = (yField: 'weightY' | 'muscleY' | 'fatY') => {
        let path = '';
        points.forEach((p) => {
            const yValue = p[yField];
            if (yValue !== null) {
                if (path === '') {
                    path += `M ${p.x.toFixed(2)},${yValue.toFixed(2)}`;
                } else {
                    path += ` L ${p.x.toFixed(2)},${yValue.toFixed(2)}`;
                }
            }
        });
        return path;
    };
    
    const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('sv-SE', { day: '2-digit', month: '2-digit' }).replace(/-/g, '.');
    const fullDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });

    const handleMouseEnter = (p: typeof points[0]) => {
        const y = p.weightY; // Use weight as primary anchor for tooltip position
        setTooltip({ x: p.x, y: y, entry: p.entry });
    };

    const handleLegendClick = (series: keyof typeof seriesVisibility) => {
        setSeriesVisibility(prev => ({
            ...prev,
            [series]: !prev[series]
        }));
    };
    
    return (
         <div className="bg-white p-4 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
            <h3 className="text-xl font-semibold text-neutral-dark mb-2">Kroppssammansättning</h3>
            <div className="flex justify-center flex-wrap gap-2 mb-4">
                <LegendItem 
                    label="Vikt" 
                    icon={<User className="w-4 h-4" />} 
                    colorClass="bg-primary"
                    isActive={seriesVisibility.weight} 
                    onClick={() => handleLegendClick('weight')} 
                />
                {hasMuscleData && (
                    <LegendItem 
                        label="Muskler" 
                        icon={<Dumbbell className="w-4 h-4" />} 
                        colorClass="bg-orange-400"
                        isActive={seriesVisibility.muscle} 
                        onClick={() => handleLegendClick('muscle')} 
                    />
                )}
                {hasFatData && (
                    <LegendItem 
                        label="Fett" 
                        icon={<PieChart className="w-4 h-4" />} 
                        colorClass="bg-yellow-400"
                        isActive={seriesVisibility.fat} 
                        onClick={() => handleLegendClick('fat')} 
                    />
                )}
            </div>
            {data.length < 2 ? (
                <p className="text-neutral text-center py-8">Logga minst två mätningar för att se din utveckling i ett diagram.</p>
            ) : (
                <>
                    <div className="relative w-full overflow-x-auto custom-scrollbar">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-labelledby="chartTitle">
                            <title id="chartTitle">Diagram som visar utveckling av vikt, muskelmassa och fettmassa.</title>
                            <g transform={`translate(${margin.left},${margin.top})`}>
                                {/* Grid Lines */}
                                {yTicks.map(tick => (
                                    <line key={`grid-${tick}`} x1="0" x2={width} y1={yScale(tick)} y2={yScale(tick)} stroke="#e5e7eb" strokeDasharray="3,3" />
                                ))}
                                
                                {/* Lines */}
                                {seriesVisibility.fat && hasFatData && <path d={createPath('fatY')} fill="none" stroke="#ffd600" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />}
                                {seriesVisibility.muscle && hasMuscleData && <path d={createPath('muscleY')} fill="none" stroke="#ff9800" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />}
                                {seriesVisibility.weight && <path d={createPath('weightY')} fill="none" stroke="#3bab5a" strokeWidth="3.5" strokeLinecap="round" />}
                                
                                {/* Data Points and Hover Areas */}
                                {points.map((p, i) => (
                                    <g key={`point-group-${i}`} onMouseEnter={() => handleMouseEnter(p)} onMouseLeave={() => setTooltip(null)} className="cursor-pointer">
                                        {/* Larger invisible hover area */}
                                        <circle cx={p.x} cy={p.weightY} r="12" fill="transparent" />
                                        
                                        {seriesVisibility.weight && <circle cx={p.x} cy={p.weightY} r="5" fill="#3bab5a" stroke="white" strokeWidth="2" />}
                                        {seriesVisibility.muscle && p.muscleY !== null && <circle cx={p.x} cy={p.muscleY} r="5" fill="#ff9800" stroke="white" strokeWidth="2" />}
                                        {seriesVisibility.fat && p.fatY !== null && <circle cx={p.x} cy={p.fatY} r="5" fill="#ffd600" stroke="white" strokeWidth="2" />}
                                    </g>
                                ))}
                                
                                {/* Axes */}
                                <line x1="0" y1={height} x2={width} y2={height} stroke="#d1d5db" strokeWidth="2" />
                                {yTicks.map(tick => (
                                    <text key={`ytick-${tick}`} x="-8" y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill="#6b7280">{tick}</text>
                                ))}
                                {xTicks.map((tick, i) => (
                                    <text key={`xtick-${i}`} x={tick.x} y={height + 25} textAnchor="middle" fontSize="12" fill="#6b7280">
                                        {formatDate(tick.entry.loggedAt)}
                                    </text>
                                ))}
                            </g>
                        </svg>
                        {tooltip && (
                            <div className="absolute p-3 text-sm bg-neutral-dark text-white rounded-md shadow-lg pointer-events-none transition-all" style={{ left: tooltip.x + margin.left, top: tooltip.y + margin.top, transform: 'translate(-50%, -115%)' }}>
                                <div className="font-bold mb-1 border-b border-gray-400 pb-1">{fullDate(tooltip.entry.loggedAt)}</div>
                                <div className="space-y-1 mt-1">
                                    <div className="flex items-center"><strong>Vikt:</strong> <span className="ml-2">{tooltip.entry.weightKg.toFixed(1)} kg</span></div>
                                    {tooltip.entry.skeletalMuscleMassKg != null && <div className="flex items-center"><strong>Muskler:</strong> <span className="ml-2">{tooltip.entry.skeletalMuscleMassKg.toFixed(1)} kg</span></div>}
                                    {tooltip.entry.bodyFatMassKg != null && <div className="flex items-center"><strong>Fett:</strong> <span className="ml-2">{tooltip.entry.bodyFatMassKg.toFixed(1)} kg</span></div>}
                                    {tooltip.entry.comment && <div className="text-xs italic mt-1 max-w-[200px] text-gray-300 border-t border-gray-500 pt-1">{tooltip.entry.comment}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default WeightChart;
