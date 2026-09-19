/** 简易 ICS 解析（仅 VEVENT：DTSTART/DTEND/SUMMARY/DESCRIPTION） */
export function parseICS(text) {
  const events = [];
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0];
    const get = (key) => {
      const re = new RegExp(`^${key}[^:]*:(.+)$`, "im");
      const m = body.match(re);
      return m ? m[1].trim().replace(/\\n/g, "\n").replace(/\\,/g, ",") : "";
    };
    const startRaw = get("DTSTART");
    const endRaw = get("DTEND");
    events.push({
      uid: get("UID"),
      summary: get("SUMMARY"),
      description: get("DESCRIPTION"),
      start: icsDateToISO(startRaw),
      end: icsDateToISO(endRaw),
      date: icsDateToDay(startRaw),
      source: "apple",
    });
  }
  return events;
}

function icsDateToISO(raw) {
  if (!raw) return null;
  // 20260919T090000 or 20260919T090000Z or 20260919
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  if (raw.endsWith("Z")) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  }
  // treat as local wall time
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function icsDateToDay(raw) {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

export async function loadICS(pathOrUrl) {
  const res = await fetch(pathOrUrl);
  if (!res.ok) throw new Error(`Failed to load ICS ${pathOrUrl}`);
  return parseICS(await res.text());
}

/** 合并手动待办 + 课程/项目衍生 + Apple 日历事件，按日分组 */
export function groupByDay({ todos = [], appleEvents = [] }) {
  const map = new Map();
  const push = (day, item) => {
    if (!day) return;
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(item);
  };

  for (const t of todos) {
    push(t.date, {
      id: t.id,
      text: t.text,
      source: t.source || "manual",
      ref: t.ref || "",
      done: !!t.done,
      priority: t.priority ?? 9,
      time: t.time || null,
      end: t.end || null,
    });
  }

  for (const e of appleEvents) {
    push(e.date, {
      id: e.uid || `apple-${e.date}-${e.summary}`,
      text: e.summary || "(untitled)",
      source: "apple",
      ref: "",
      done: false,
      priority: 5,
      time: e.start,
      end: e.end,
      description: e.description,
    });
  }

  const days = [...map.keys()].sort();
  return days.map((date) => ({
    date,
    items: map.get(date).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return String(a.time || "").localeCompare(String(b.time || ""));
    }),
  }));
}

export function formatDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]}. ${d.getDate()}. ${d.getFullYear()} ｜ ${week}`;
}

/** 09:00 / 12:55 / 18:00 (24h) */
export function formatClock(isoOrLocal) {
  if (!isoOrLocal) return "";
  const m = String(isoOrLocal).match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

/** 12:55-15:40.  Title  /  Title (no time) */
export function formatItemLine(item) {
  const title = item.text || "(untitled)";
  const start = formatClock(item.time);
  const end = formatClock(item.end);
  if (start && end) return `${start}-${end}.  ${title}`;
  if (start) return `${start}.  ${title}`;
  return title;
}

export function sourceBadge(source) {
  const map = {
    project: ["project", "project"],
    lesson: ["lesson", "lesson"],
    apple: ["apple", "apple cal"],
    manual: ["manual", "todo"],
  };
  const [cls, label] = map[source] || ["manual", source];
  return `<span class="badge ${cls}">${label}</span>`;
}
