import { useEffect, useState } from 'react';

type BarChartProps = {
  data: { label: string; value: number; color: string }[];
  height?: number;
  emptyMessage?: string;
};

export default function BarChart({ data, height = 200, emptyMessage = 'لا توجد بيانات' }: BarChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-around gap-4 px-4" style={{ height }}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center w-full text-gray-400 text-sm">{emptyMessage}</div>
      ) : (
        data.map((d, i) => {
          const barHeight = animated ? (d.value / maxValue) * (height - 40) : 0;
          return (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 max-w-[80px]">
              <span className="text-sm font-bold text-gray-700">{d.value}</span>
              <div className="w-full flex items-end" style={{ height: height - 40 }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-700 ease-out ${d.color}`}
                  style={{ height: `${barHeight}px`, transitionDelay: `${i * 100}ms` }}
                />
              </div>
              <span className="text-xs text-gray-500 text-center truncate w-full">{d.label}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
