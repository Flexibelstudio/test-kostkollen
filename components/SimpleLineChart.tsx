import React, { useMemo } from 'react';
import { ChartData } from '../types';

interface SimpleLineChartProps {
    data: ChartData;
}

const colorMap: { [key: string]: string } = {
    'vikt': '#3bab5a',      // primary
    'muskler': '#ff9800', // orange
    'fett': '#ffd600',      // yellow
};
const defaultColors = ['#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']; // blue, red, purple, teal

const getColor = (label: string, index: number) => {
    const lowerLabel = label.toLowerCase();
    for (const key in colorMap) {
        if (lowerLabel.includes(key)) {
            return colorMap[key];
        }
    }
    return defaultColors[index % defaultColors.length];
};


const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data }) => {
    const svgWidth = 400;
    const svgHeight = 250;
    const margin = { top: 10, right: 10, bottom: 25, left: 30 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const { yTicks, xTicks, lineData } = useMemo(() => {
        if (!data || !data.datasets || data.datasets.length === 0 || data.labels.length < 1) {
            return { yTicks: [], xTicks: [], lineData: [] };
        }
        
        const allValues = data.datasets.flatMap(ds => ds.data.filter(d => d !== null) as number[]);
        if (allValues.length === 0) return { yTicks: [], xTicks: [], lineData: [] };

        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const yRange = maxVal - minVal;
        
        const yDomainMin = yRange === 0 ? Math.floor(minVal - 2) : Math.floor(minVal - yRange * 0.1);
        const yDomainMax = yRange === 0 ? Math.ceil(maxVal + 2) : Math.ceil(maxVal + yRange * 0.1);
        
        const xScale = (index: number) => (data.labels.length <= 1) ? width / 2 : (index / (data.labels.length - 1)) * width;
        const yScale = (value: number) => height - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * height;
        
        const createPath = (datasetData: (number | null)[]) => {
            let path = '';
            datasetData.forEach((d, i) => {
                if (d !== null) {
                    const x = xScale(i);
                    const y = yScale(d);
                    const isFirstPointOfSegment = path === '' || (i > 0 && datasetData[i - 1] === null);
                    path += `${isFirstPointOfSegment ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
                }
            });
            return path;
        };

        const yTickCount = 5;
        const yTickStep = (yDomainMax - yDomainMin) / (yTickCount - 1);
        const yTicks = Array.from({ length: yTickCount }, (_, i) => {
            const value = yDomainMin + i * yTickStep;
            return {
                value: Number.isInteger(value) ? value : value.toFixed(1),
                y: yScale(value)
            };
        });

        const xTickCount = Math.min(data.labels.length, 6);
        const xTickIndexes = data.labels.length <= 1 ? [0] : Array.from({ length: xTickCount }, (_, i) => Math.round(i * (data.labels.length - 1) / (xTickCount - 1)));
        const xTicks = [...new Set(xTickIndexes)].map(i => ({
            label: data.labels[i],
            x: xScale(i)
        }));

        const lineData = data.datasets.map((ds, i) => ({
            label: ds.label,
            path: createPath(ds.data),
            points: ds.data.map((d, j) => d === null ? null : ({ x: xScale(j), y: yScale(d) })).filter((p): p is { x: number; y: number } => p !== null),
            color: getColor(ds.label, i)
        }));

        return { yTicks, xTicks, lineData };
    }, [data, width, height]);

    if (!data || lineData.length === 0) {
        return <div className="text-sm text-neutral-dark p-4">För lite data för att visa en graf.</div>
    }

    return (
        <div className="w-full h-auto">
            <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 mb-2">
                {lineData.map(ds => (
                    <div key={ds.label} className="flex items-center text-xs text-neutral-dark">
                        <span className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: ds.color }}></span>
                        {ds.label}
                    </div>
                ))}
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={data.title} className="w-full h-auto">
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {/* Y-axis */}
                    {yTicks.map(tick => (
                        <g key={`ytick-${tick.value}`} className="text-xs text-neutral-dark fill-current">
                            <text x="-5" y={tick.y + 4} textAnchor="end">{tick.value}</text>
                            <line x1="0" x2={width} y1={tick.y} y2={tick.y} stroke="currentColor" strokeOpacity="0.1" />
                        </g>
                    ))}
                    
                    {/* X-axis */}
                    {xTicks.map(tick => (
                        <text key={`xtick-${tick.label}`} x={tick.x} y={height + 15} textAnchor="middle" className="text-xs text-neutral-dark fill-current">
                            {tick.label}
                        </text>
                    ))}
                    
                    {/* Lines */}
                    {lineData.map(line => (
                        <path key={`path-${line.label}`} d={line.path} fill="none" stroke={line.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    
                    {/* Points */}
                     {lineData.map(line => (
                        <g key={`points-${line.label}`}>
                           {line.points.map((p, i) => (
                             <circle key={i} cx={p.x} cy={p.y} r="3" fill={line.color} stroke="white" strokeWidth="1.5" />
                           ))}
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default SimpleLineChart;