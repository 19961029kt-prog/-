import React from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  Map,
  TrendingUp,
  Users,
  Settings,
  Bell,
  Search,
  ChevronRight,
  TrainFront,
  Bike,
  Clock,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

const GOLD = "#D4A017";
const GOLD_LIGHT = "#E8C766";

const odData = [
  { name: "自宅エリア", value: 45 },
  { name: "商業エリア", value: 25 },
  { name: "工業団地", value: 20 },
  { name: "その他", value: 10 },
];

const odColors = ["#D4A017", "#9CA3AF", "#6B7280", "#D1D5DB"];

const dwellData = [
  { range: "0-5分", percent: 65 },
  { range: "5-15分", percent: 20 },
  { range: "15-30分", percent: 10 },
  { range: "30分以上", percent: 5 },
];

function Sidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: "ダッシュボード", active: true },
    { icon: Map, label: "エリア分析" },
    { icon: TrendingUp, label: "需要予測" },
    { icon: Users, label: "ペルソナ" },
    { icon: Settings, label: "設定" },
  ];

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">
          KYUSHU{" "}
          <span style={{ color: GOLD }} className="font-extrabold">
            Re-
          </span>
          START
        </h1>
        <p className="text-xs text-gray-400 mt-1 tracking-wide">PLATFORM</p>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-amber-50 text-gray-900"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}
            style={active ? { boxShadow: `inset 3px 0 0 ${GOLD}` } : {}}
          >
            <span className="flex items-center gap-3">
              <Icon
                size={18}
                style={{ color: active ? GOLD : undefined }}
                className={active ? "" : "text-gray-400"}
              />
              {label}
            </span>
            {active && <ChevronRight size={14} className="text-gray-300" />}
          </button>
        ))}
      </nav>

      <div className="px-4 py-5 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: GOLD }}
          >
            HK
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-gray-800">起業家ユーザー</p>
            <p className="text-xs text-gray-400">無料プラン</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrainFront size={16} />
          <span>分析対象エリア</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mt-0.5">佐世保駅 周辺エリア分析</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-64">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="駅名・エリアを検索"
            className="bg-transparent outline-none text-sm text-gray-600 w-full placeholder:text-gray-400"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-gray-50">
          <Bell size={20} className="text-gray-500" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: GOLD }}
          />
        </button>
      </div>
    </header>
  );
}

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#FDF6E3" }}
      >
        <Icon size={20} style={{ color: GOLD }} />
      </div>
    </div>
  );
}

function InsightBox({ icon: Icon, children, tone = "default" }) {
  const toneStyles =
    tone === "warning"
      ? "bg-amber-50 border-amber-200"
      : "bg-gray-50 border-gray-200";
  return (
    <div className={`rounded-lg border ${toneStyles} p-4 flex gap-3 mt-4`}>
      <Icon size={18} style={{ color: GOLD }} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
    </div>
  );
}

function ODCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs font-semibold tracking-wide" style={{ color: GOLD }}>
            O-D データ分析
          </p>
          <h3 className="text-base font-bold text-gray-900 mt-1">
            ラストワンマイルの移動ボトルネック
          </h3>
        </div>
        <Bike size={20} className="text-gray-300" />
      </div>
      <p className="text-xs text-gray-400 mb-4">
        駅から先の移動手段に関する潜在需要（目的地別ボリューム）
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={odData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {odData.map((entry, idx) => (
                <Cell key={entry.name} fill={odColors[idx % odColors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>

        <ul className="space-y-2">
          {odData.map((d, idx) => (
            <li key={d.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: odColors[idx % odColors.length] }}
                />
                {d.name}
              </span>
              <span className="font-semibold text-gray-900">{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>

      <InsightBox icon={Lightbulb}>
        駅から半径<span className="font-semibold text-gray-800">3km圏内</span>への移動が全体の
        <span className="font-bold" style={{ color: GOLD }}>
          {" "}
          70%
        </span>
        を占めるが、二次交通の接続が弱いエリアが存在します。
        <span className="font-semibold text-gray-800">
          シェアサイクルの最適ポート設置候補地
        </span>
        です。
      </InsightBox>
    </div>
  );
}

function DwellCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs font-semibold tracking-wide" style={{ color: GOLD }}>
            滞在時間分析（平日18時台 / 30代）
          </p>
          <h3 className="text-base font-bold text-gray-900 mt-1">
            駅周辺の隠れスキマ時間（滞留）
          </h3>
        </div>
        <Clock size={20} className="text-gray-300" />
      </div>
      <p className="text-xs text-gray-400 mb-4">
        下車客の滞在時間ごとの人数分布（ヒストグラム）
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dwellData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
          <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip formatter={(v) => `${v}%`} />
          <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
            {dwellData.map((entry, idx) => (
              <Cell key={entry.range} fill={idx === 0 ? GOLD : GOLD_LIGHT} fillOpacity={idx === 0 ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <InsightBox icon={AlertTriangle} tone="warning">
        下車客の
        <span className="font-bold" style={{ color: GOLD }}>
          {" "}
          65%
        </span>
        が5分以内に帰路についており、深刻な
        <span className="font-semibold text-gray-800">「滞留の空白地帯」</span>
        が発生しています。駅ナカの
        <span className="font-semibold text-gray-800">
          テイクアウト専門店やスマートロッカーサービス
        </span>
        の出店リスクが極めて低いエリアです。
      </InsightBox>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="二次交通カバー率"
              value="32%"
              sub="3km圏内エリア比"
              icon={Bike}
            />
            <StatCard
              label="平均滞在時間"
              value="4.2分"
              sub="平日18時台・30代"
              icon={Clock}
            />
            <StatCard
              label="ビジネス機会スコア"
              value="A+"
              sub="駅ナカ出店適性"
              icon={TrendingUp}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ODCard />
            <DwellCard />
          </div>
        </main>
      </div>
    </div>
  );
}
