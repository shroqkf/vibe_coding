import { promises as fs } from "fs";
import path from "path";

// 관심종목은 계좌/주문과 달리 KIS 서버에 저장되는 게 아니라 이 앱만의 로컬 상태이므로
// 간단히 JSON 파일로 영속화한다 (SQLite 등 새 의존성 불필요).
const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "watchlist.json");

export type WatchlistItem = { code: string; name: string };

async function readFile(): Promise<WatchlistItem[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw) as WatchlistItem[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeFile(items: WatchlistItem[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  return readFile();
}

export async function addToWatchlist(item: WatchlistItem): Promise<WatchlistItem[]> {
  const items = await readFile();
  if (items.some((i) => i.code === item.code)) return items;
  const next = [...items, item];
  await writeFile(next);
  return next;
}

export async function removeFromWatchlist(code: string): Promise<WatchlistItem[]> {
  const items = await readFile();
  const next = items.filter((i) => i.code !== code);
  await writeFile(next);
  return next;
}
