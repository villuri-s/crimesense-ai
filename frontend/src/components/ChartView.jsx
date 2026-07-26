import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";
import EChartsReact from "echarts-for-react";
import * as echarts from "echarts";
import { BarChart3, Download, Share2, Sparkles } from "lucide-react";

// Fetch and register world map
const registerWorldMap = async () => {
  try {
    const response = await fetch(
      "https://cdn.jsdelivr.net/npm/echarts/map/json/world.json"
    );
    const worldMap = await response.json();
    echarts.registerMap("world", worldMap);
  } catch (error) {
    console.warn("Could not load world map from CDN, using fallback", error);
    // Fallback: register a minimal world map
    echarts.registerMap("world", {
      type: "FeatureCollection",
      features: []
    });
  }
};

registerWorldMap();

const COLORS = ["#2563eb", "#14b8a6", "#f97316", "#8b5cf6", "#22c55e"];

const chartLabels = {
  trend: "Line Chart",
  bar: "Bar Chart",
  pie: "Pie Chart",
  area: "Area Chart",
  scatter: "Scatter Chart",
  radar: "Radar Chart",
  geomap: "Geomap",
  table: "Table"
};

const chartAliases = {
  trend: "trend",
  "line chart": "trend",
  line: "trend",
  "linechart": "trend",
  linegraph: "trend",
  "line graph": "trend",
  bar: "bar",
  "bar chart": "bar",
  column: "bar",
  "column chart": "bar",
  histogram: "bar",
  pie: "pie",
  "pie chart": "pie",
  donut: "pie",
  doughnut: "pie",
  "area chart": "area",
  area: "area",
  "scatter chart": "scatter",
  scatter: "scatter",
  bubble: "scatter",
  "bubble chart": "scatter",
  "radar chart": "radar",
  radar: "radar",
  spider: "radar",
  "spider chart": "radar",
  customer: "pie",
  geo: "geomap",
  map: "geomap",
  geomap: "geomap",
  choropleth: "geomap",
  table: "table"
};

function TableChart({ data }) {
  const keys = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="table-chart">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {keys.map((key) => (
                <td key={`${rowIndex}-${key}`}>{String(row[key] ?? "-")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shouldPreferTable(data, chartType) {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  if (chartType === "table" || chartType === "pie" || chartType === "geomap") {
    return false;
  }

  const { nameKey } = getChartFieldKeys(data);
  const labels = data.map((item) => String(item?.[nameKey] ?? "").trim()).filter(Boolean);

  if (!labels.length) {
    return false;
  }

  const longestLabel = Math.max(...labels.map((label) => label.length));
  const totalLabelLength = labels.reduce((sum, label) => sum + label.length, 0);

  return (
    (labels.length >= 8 && longestLabel >= 14) ||
    (labels.length >= 6 && longestLabel >= 20) ||
    totalLabelLength >= 120
  );
}

function getChartFieldKeys(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return { nameKey: "name", valueKey: "value" };
  }

  const record = data.find((item) => item && typeof item === "object") ?? data[0];
  if (!record || typeof record !== "object") {
    return { nameKey: "name", valueKey: "value" };
  }

  const stringKeys = ["name", "label", "category", "date", "timestamp", "region", "country", "key", "x"];
  const numericKeys = ["value", "count", "amount", "metric", "score", "y", "total"];

  const nameKey = stringKeys.find((key) => record[key] != null);
  const valueKey = numericKeys.find((key) => Number.isFinite(record[key]));

  const fallbackNameKey = Object.keys(record).find((key) => typeof record[key] === "string") || "name";
  const fallbackValueKey = Object.keys(record).find((key) => Number.isFinite(record[key])) || "value";

  return {
    nameKey: nameKey || fallbackNameKey,
    valueKey: valueKey || fallbackValueKey
  };
}

function GeoMap({ data }) {
  // Country name mappings and GeoJSON coordinates
  const countryData = {
    "USA": { name: "United States of America", lat: 40, lon: -95 },
    "US": { name: "United States of America", lat: 40, lon: -95 },
    "China": { name: "China", lat: 35, lon: 105 },
    "India": { name: "India", lat: 20, lon: 77 },
    "Brazil": { name: "Brazil", lat: -10, lon: -55 },
    "Canada": { name: "Canada", lat: 60, lon: -95 },
    "UK": { name: "United Kingdom", lat: 54, lon: -2 },
    "United Kingdom": { name: "United Kingdom", lat: 54, lon: -2 },
    "Germany": { name: "Germany", lat: 51, lon: 10 },
    "France": { name: "France", lat: 47, lon: 2 },
    "Japan": { name: "Japan", lat: 36, lon: 138 },
    "Australia": { name: "Australia", lat: -25, lon: 135 }
  };

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let active = true;

    registerWorldMap()
      .catch(() => {})
      .finally(() => {
        if (active) {
          setMapReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Transform data for choropleth map
  const { nameKey, valueKey } = getChartFieldKeys(data);

  const mapData = data.map((item) => {
    const countryName = item[nameKey];
    const countryInfo = countryData[countryName];
    return {
      name: countryInfo?.name || countryName || String(item[nameKey] ?? ""),
      value: Number(item[valueKey] ?? 0),
      lat: countryInfo?.lat ?? 0,
      lon: countryInfo?.lon ?? 0,
    };
  });

  const minValue = Math.min(...mapData.map((d) => d.value));
  const maxValue = Math.max(...mapData.map((d) => d.value));

  // Create a simple map using world coordinates
  const option = {
    title: {
      text: "",
      left: "center"
    },
    tooltip: {
      trigger: "item",
      formatter: function(params) {
        if (params.componentSubType === "map") {
          return `${params.name}<br/>Value: ${params.value || 0}`;
        }
        return params.name;
      }
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      splitNumber: 5,
      inRange: {
        color: ["#3b82f6", "#60a5fa", "#fbbf24", "#f97316", "#dc2626"]
      },
      textStyle: {
        color: "#333"
      },
      left: "10%",
      bottom: "10%"
    },
    geo: {
      map: "world",
      roam: true,
      scaleLimit: {
        min: 0.5,
        max: 2
      },
      label: {
        emphasis: {
          show: true
        }
      },
      itemStyle: {
        normal: {
          areaColor: "#f5f5f5",
          borderColor: "#999"
        },
        emphasis: {
          areaColor: "#ffd700"
        }
      }
    },
    series: [
      {
        name: "Value",
        type: "map",
        geoIndex: 0,
        data: mapData,
        itemStyle: {
          areaColor: "#eaeaf2"
        },
        emphasis: {
          itemStyle: {
            areaColor: "#ffd700"
          }
        }
      },
      {
        name: "Value",
        type: "scatter",
        coordinateSystem: "geo",
        data: mapData.map(d => [d.lon, d.lat, d.value]),
        symbolSize: function(val) {
          const normalized = (val[2] - minValue) / (maxValue - minValue || 1);
          return Math.max(8, 25 * normalized);
        },
        itemStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
            { offset: 0, color: "#ffffff" },
            { offset: 1, color: "#ff7a45" }
          ])
        },
        emphasis: {
          scale: true
        },
        label: {
          show: false
        }
      }
    ]
  };

  if (!mapReady) {
    return (
      <div className="chart-visual" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>Loading map...</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <EChartsReact
        option={option}
        style={{ height: "100%" }}
        opts={{ renderer: "canvas", useDirtyRect: true }}
      />
    </div>
  );
}

export default function ChartView({
  data,
  type = "bar",
  insightType,
  title,
  onOpen,
  onExplain,
  onDrillDown,
  onExport,
  onShare,
  showExplain = true,
  showDrillDown = true,
  showExport = true,
  showShare = true,
}) {
  if (!data || data.length === 0) return <p>No data</p>;

  const normalizedType = (insightType || type)?.toString().trim().toLowerCase();
  const chartType = chartAliases[normalizedType] || "bar";
  const isDonut = normalizedType === "donut" || normalizedType === "doughnut";
  const { nameKey, valueKey } = getChartFieldKeys(data);
  const useTableFallback = shouldPreferTable(data, chartType);
  const pieTotal = Array.isArray(data)
    ? data.reduce((sum, item) => sum + (Number(item?.[valueKey]) || 0), 0)
    : 0;
  const tableData = useTableFallback
    ? data.map((item) => ({
        Category: String(item?.[nameKey] ?? "-"),
        Value: item?.[valueKey] ?? "-",
      }))
    : data;
  const chartTitle = useTableFallback
    ? `${title || chartLabels[chartType]} (Table View)`
    : title || chartLabels[chartType];
  const chartHeight = 420;

  return (
    <div className="chart-box">
      <div className="chart-toolbar">
        <div className="chart-title">{chartTitle}</div>
        {showExplain || showDrillDown || showExport || showShare ? (
          <div className="chart-toolbar-actions">
            {showExplain ? (
              <button
                type="button"
                className="chart-toolbar-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onExplain?.();
                }}
              >
                <Sparkles size={14} />
                Explain
              </button>
            ) : null}
            {showDrillDown ? (
              <button
                type="button"
                className="chart-toolbar-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDrillDown?.();
                }}
              >
                <BarChart3 size={14} />
                Drill Down
              </button>
            ) : null}
            {showExport ? (
              <button
                type="button"
                className="chart-toolbar-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onExport?.();
                }}
              >
                <Download size={14} />
                Export
              </button>
            ) : null}
            {showShare ? (
              <button
                type="button"
                className="chart-toolbar-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onShare?.();
                }}
              >
                <Share2 size={14} />
                Share
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        className={onOpen ? "chart-content chart-content-clickable" : "chart-content"}
        style={{ minHeight: 0 }}
        onClick={() => onOpen?.()}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onKeyDown={(event) => {
          if (!onOpen) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        {chartType === "table" || useTableFallback ? (
          <TableChart data={tableData} />
        ) : chartType === "geomap" ? (
          <div className="chart-visual" style={{ width: "100%", height: "100%" }}>
            <GeoMap data={data} />
          </div>
        ) : chartType === "pie" ? (
          <div className="chart-visual" style={{ width: "100%", height: "100%" }}>
            <div className="pie-chart-layout">
              <div className="pie-visual">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 16, right: 18, left: 18, bottom: 88 }}>
                    <Pie
                      data={data}
                      dataKey={valueKey}
                      nameKey={nameKey}
                      outerRadius="92%"
                      innerRadius={isDonut ? "52%" : 0}
                      stroke="none"
                      labelLine={false}
                      paddingAngle={2}
                    >
                      {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const numericValue = Number(value ?? 0);
                        const percentage = pieTotal
                          ? ((numericValue / pieTotal) * 100).toFixed(1)
                          : "0.0";

                        return [`${numericValue.toLocaleString()} (${percentage}%)`, name];
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ paddingTop: 4, paddingLeft: 8, paddingRight: 8, maxHeight: 72, overflowY: "auto" }}
                      formatter={(value, entry) => {
                        const numericValue = Number(entry?.payload?.[valueKey] ?? 0);
                        const percentage = pieTotal
                          ? ((numericValue / pieTotal) * 100).toFixed(0)
                          : "0";

                        return `${value} • ${numericValue.toLocaleString()} • ${percentage}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="chart-visual" style={{ width: "100%", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "trend" ? (
                (() => {
                  const avg = data.reduce((sum, d) => sum + (Number(d?.[valueKey]) || 0), 0) / data.length;
                  return (
                    <LineChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 88 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis
                        dataKey={nameKey}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tickMargin={20}
                        height={78}
                      />
                      <YAxis
                        tick={{ fill: "#475569", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey={valueKey}
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          const value = Number(payload?.[valueKey] ?? 0);
                          const color = value > avg ? "#22c55e" : "#ef4444";
                          return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />;
                        }}
                      />
                    </LineChart>
                  );
                })()
              ) : chartType === "area" ? (
                <AreaChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 88 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey={nameKey}
                    tick={{ fill: "#475569", fontSize: 12, angle: -18, textAnchor: "end" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickMargin={16}
                    height={56}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Area type="monotone" dataKey={valueKey} stroke="#4f46e5" fill="url(#areaGradient)" strokeWidth={2} />
                </AreaChart>
              ) : chartType === "scatter" ? (
                <ScatterChart margin={{ top: 16, right: 18, left: 0, bottom: 88 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="category"
                    dataKey={nameKey}
                    name="Category"
                    tick={{ fill: "#475569", fontSize: 12, angle: -18, textAnchor: "end" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickMargin={16}
                    height={56}
                  />
                  <YAxis
                    type="number"
                    dataKey={valueKey}
                    name="Value"
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={data} fill="#8b5cf6" />
                </ScatterChart>
              ) : chartType === "radar" ? (
                <RadarChart data={data} outerRadius="80%" margin={{ top: 4, right: 10, left: 0, bottom: 10 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey={nameKey} tick={{ fill: "#475569", fontSize: 12 }} />
                  <PolarRadiusAxis />
                  <Radar name="Score" dataKey={valueKey} stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              ) : (
                <BarChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 96 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey={nameKey}
                    tick={{ fill: "#475569", fontSize: 12, angle: -28, textAnchor: "end" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickMargin={28}
                    height={96}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey={valueKey} fill="#4f46e5" radius={[12, 12, 4, 4]} barSize={34} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
      )}
      </div>
    </div>
  );
}
