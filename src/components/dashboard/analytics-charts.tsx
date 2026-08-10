"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  bookings: number;
  revenueCents: number;
};

function shortDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--ink)",
};

export function BookingsTrendChart({
  data,
  currency,
}: {
  data: Point[];
  currency: string;
}) {
  const chartData = data.map((p) => ({
    ...p,
    label: shortDay(p.date),
    revenue: p.revenueCents / 100,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bfBookingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fill: "var(--ink-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--ink-secondary)" }}
            formatter={(value, name) => {
              if (name === "revenue") {
                return [
                  new Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency,
                  }).format(Number(value ?? 0)),
                  "Est. revenue",
                ];
              }
              return [value ?? 0, "Bookings"];
            }}
          />
          <Area
            type="monotone"
            dataKey="bookings"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#bfBookingsFill)"
            name="bookings"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopServicesChart({
  data,
  currency,
}: {
  data: Array<{ name: string; count: number; revenueCents: number }>;
  currency: string;
}) {
  const chartData = data.map((d) => ({
    name: d.name.length > 16 ? `${d.name.slice(0, 14)}…` : d.name,
    fullName: d.name,
    count: d.count,
    revenue: d.revenueCents / 100,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "var(--ink-tertiary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fill: "var(--ink-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, item) => {
              const full =
                (item?.payload as { fullName?: string } | undefined)?.fullName;
              if (name === "revenue") {
                return [
                  new Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency,
                  }).format(Number(value ?? 0)),
                  full ? `${full} revenue` : "Revenue",
                ];
              }
              return [value ?? 0, full ? `${full} bookings` : "Bookings"];
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--accent)"
            radius={[0, 6, 6, 0]}
            name="count"
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
