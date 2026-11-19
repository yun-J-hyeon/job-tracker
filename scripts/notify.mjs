// GitHub Actions에서 실행: 오늘 기록이 없으면 웹 푸시를 보낸다.
import fs from "node:fs";
import webpush from "web-push";

const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const iso = d => d.toISOString().slice(0, 10);
const todayStr = iso(kst);
const rest = (data.settings && data.settings.restDays) || [];

if (rest.includes(kst.getUTCDay())) { console.log("쉬는 날, 알림 없음"); process.exit(0); }

const mins = {};
for (const l of data.logs) mins[l.date] = (mins[l.date] || 0) + (+l.minutes || 0);
if (mins[todayStr] > 0) { console.log("오늘 기록 있음, 알림 없음"); process.exit(0); }

// 어제까지의 연속 일수 (쉬는 날은 건너뜀)
let n = 0;
for (let d = new Date(kst.getTime() - 864e5); ; d = new Date(d.getTime() - 864e5)) {
  if (mins[iso(d)] > 0) n++;
  else if (!rest.includes(d.getUTCDay())) break;
  if (n > 1000) break;
}

const base = (data.settings.remind && data.settings.remind.text) || "오늘 기록 0분. 스트릭이 끊겨요!";
const body = n > 0 ? `${base} (현재 ${n}일 연속)` : base;

webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:example@example.com", process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
const sub = JSON.parse(process.env.PUSH_SUBSCRIPTION);
await webpush.sendNotification(sub, JSON.stringify({ title: "오늘 작업을 진행하세요!", body }));
console.log("알림 전송:", body);
