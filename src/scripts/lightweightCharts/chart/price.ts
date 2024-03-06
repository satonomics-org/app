import { PriceScaleMode } from "lightweight-charts";

import {
  chartState,
  colors,
  createCandlesticksSeries,
  createLineSeries,
  createPriceLine,
  createSeriesLegend,
  setMinMaxMarkers,
  setTimeScale,
  updateLiveCandlestick as updateChartUsingLiveCandle,
} from "/src/scripts";
import { createASS } from "/src/solid";

export const PRICE_SCALE_MOMENTUM_ID = "momentum";

export const applyPriceSeries = <T extends DatedSingleValueData[]>({
  chart,
  datasets,
  liveCandle,
  preset,
  dataset,
  options,
}: {
  chart: IChartApi;
  datasets: Datasets;
  preset: Preset;
  liveCandle?: Accessor<FullCandlestick | null>;
  dataset?: Dataset<T>;
  options?: PriceSeriesOptions;
}): SeriesLegend[] => {
  if (!chart) return [];

  const id = options?.id || "price";
  const title = options?.title || "Price";

  const seriesType =
    chartState.seriesType || checkIfUpClose(chart, chartState.range);

  chartState.seriesType = seriesType;

  const lowerOpacity = options?.lowerOpacity || options?.halved || false;

  if (options?.halved) {
    options.seriesOptions = {
      ...options.seriesOptions,
      priceScaleId: "left",
    };
  }

  const color = createASS<string | string[]>("");

  if (!dataset && seriesType === "Candlestick") {
    const [series, colors] = createCandlesticksSeries(chart, {
      ...options,
      // inverseColors: options?.inverseColors ?? priceMode === 'sats',
      lowerOpacity,
    });

    color.set(colors);

    chartState.priceSeries = series;

    createEffect(() => series.setData(datasets.candlesticks.values() || []));
  } else {
    color.set(lowerOpacity ? colors.darkWhite : colors.white);

    const series = createLineSeries(chart, {
      color: lowerOpacity ? colors.darkWhite : colors.white,
      ...options?.seriesOptions,
      lastValueVisible: false,
    });

    chartState.priceSeries = series;

    // TODO: fix types
    createEffect(() =>
      series.setData(
        dataset?.values() || datasets.closes.values() || ([] as any),
      ),
    );
  }

  if (!lowerOpacity) {
    chartState.priceLine = createPriceLine(chartState.priceSeries);

    createEffect(() => {
      if (!dataset && liveCandle) {
        {
          updateChartUsingLiveCandle({
            candle:
              liveCandle() || datasets.candlesticks.values()?.at(-1) || null,
            datasets,
          });
        }
      } else {
        chartState.priceLine?.applyOptions({
          color: colors.white,
          price: dataset?.values()?.at(-1)?.value,
        });
      }
    });
  }

  chartState.priceSeries.priceScale().applyOptions({
    ...(options?.halved
      ? {
          scaleMargins: {
            top: 0.05,
            bottom: 0.55,
          },
        }
      : {}),
    ...(options?.id || options?.title
      ? {}
      : {
          mode: PriceScaleMode.Logarithmic,
        }),
    ...options?.priceScaleOptions,
  });

  if (!dataset) {
    setMinMaxMarkers(
      datasets.candlesticks.values() || [],
      chartState.range,
      lowerOpacity,
    );
  }

  setTimeScale({
    switchBetweenCandlestickAndLine: !dataset,
    candlesticks: datasets.candlesticks.values() || [],
    lowerOpacity,
  });

  return [
    createSeriesLegend({
      id,
      presetId: preset.id,
      title,
      color,
      series: chartState.priceSeries,
    }),
  ];
};

function checkIfUpClose(chart: IChartApi, range?: LogicalRange | null) {
  const from = range?.from || 0;
  const to = range?.to || 0;
  const width = chart.timeScale().width();

  const difference = to - from;

  return width / difference >= 2 ? "Candlestick" : "Line";
}
