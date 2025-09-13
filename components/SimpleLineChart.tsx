import React, { useMemo } from 'react';
import { ChartData } from '../types';

interface SimpleLineChartProps {
    data: ChartData;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data }) => {
    const svgWidth = 300;
    const svgHeight = 180;
    const margin = { top: 10, right: 10, bottom: 25, left: 25 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const { points, yTicks, xTicks, path } = useMemo(() => {
        if (!data || data.data.length < 2) return { points: [], yTicks: [], xTicks: [], path: '' };

        const minVal = Math.min(...data.data);
        const maxVal = Math.max(...data.data);
        const yRange = maxVal - minVal;
        
        const yDomainMin = Math.floor(minVal - yRange * 0.1);
        const yDomainMax = Math.ceil(maxVal + yRange * 0.1);
        
        const xScale = (index: number) => (index / (data.data.length - 1)) * width;
        const yScale = (value: number) => height - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * height;
        
        const points = data.data.map((d, i) => ({ x: xScale(i), y: yScale(d), value: d }));
        
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
        
        const yTickCount = 4;
        const yTickStep = (yDomainMax - yDomainMin) / (yTickCount - 1);
        const yTicks = Array.from({ length: yTickCount }, (_, i) => ({
            value: (yDomainMin + i * yTickStep).toFixed(1),
            y: yScale(yDomainMin + i * yTickStep)
        }));

        const xTickCount = Math.min(data.labels.length, 5);
        const xTickIndexes = Array.from({ length: xTickCount }, (_, i) => Math.floor(i * (data.labels.length - 1) / (xTickCount - 1)));
        const xTicks = xTickIndexes.map(i => ({
            label: data.labels[i],
            x: xScale(i)
        }));

        return { points, yTicks, xTicks, path };
    }, [data, width, height]);

    if (!data || data.data.length < 2) {
        return <div className="text-sm text-neutral-dark p-4">För lite data för att visa en graf.</div>
    }

    return (
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={data.title}>
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
                
                {/* Line */}
                <path d={path} fill="none" stroke="#3bab5a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Points */}
                {points.map((p, i) => (
                    <circle key={`point-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#3bab5a" stroke="white" strokeWidth="1.5" />
                ))}
            </g>
        </svg>
    );
};

export default SimpleLineChart;
