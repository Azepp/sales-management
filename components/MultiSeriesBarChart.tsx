export interface ChartPoint {
  label: string;
  title?: string;
  values: number[];
}

export interface ChartSeries {
  label: string;
  colorClassName: string;
}

interface MultiSeriesBarChartProps {
  data: ChartPoint[];
  series: ChartSeries[];
  ariaLabel: string;
  formatValue: (value: number) => string;
}

export function MultiSeriesBarChart({ data, series, ariaLabel, formatValue }: MultiSeriesBarChartProps) {
  const maximumValue = Math.max(1, ...data.flatMap((point) => point.values));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Legenda grafik">
        {series.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`size-2.5 rounded-sm ${item.colorClassName}`} aria-hidden="true" />
            {item.label}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div role="img" aria-label={ariaLabel} className="grid min-w-140 items-end gap-2 sm:min-w-0 sm:gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}>
          {data.map((point) => (
            <div key={point.label} className="min-w-0 text-center" title={point.title ?? point.label}>
              <div className="flex h-40 items-end justify-center gap-1 border-b border-border px-1">
                {series.map((item, index) => {
                  const value = Math.max(0, point.values[index] ?? 0);
                  const height = value === 0 ? 1 : Math.max(3, (value / maximumValue) * 100);
                  return <div key={item.label} className={`w-full max-w-5 rounded-t-sm ${item.colorClassName}`} style={{ height: `${height}%` }} title={`${item.label}: ${formatValue(value)}`} aria-hidden="true" />;
                })}
              </div>
              <p className="mt-2 truncate text-[11px] text-muted-foreground">{point.label}</p>
            </div>
          ))}
          {data.length === 0 && <p className="col-span-full py-12 text-center text-sm text-muted-foreground">Belum ada data untuk periode ini</p>}
        </div>
      </div>
    </div>
  );
}
