// KIS Open API 환경변수 읽기 + 검증. 값 자체는 절대 반환하지 않고 상태만 노출한다.

export const KIS_PAPER_BASE_URL = "https://openapivts.koreainvestment.com:29443";
const KIS_REAL_BASE_URL = "https://openapi.koreainvestment.com:9443";

export type KisAccount = {
  cano: string; // 계좌번호 앞 8자리
  acntPrdtCd: string; // 계좌상품코드 뒤 2자리
};

export function getKisBaseUrl(): string {
  return process.env.KIS_BASE_URL ?? KIS_REAL_BASE_URL;
}

export function isPaperTrading(): boolean {
  return getKisBaseUrl().replace(/\/+$/, "") === KIS_PAPER_BASE_URL;
}

export function getKisCredentials(): { appKey: string; appSecret: string } | null {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
}

// KIS_ACCOUNT="12345678-01" 형식 (계좌번호-상품코드)
export function getKisAccount(): KisAccount | null {
  const raw = process.env.KIS_ACCOUNT;
  if (!raw) return null;
  const [cano, acntPrdtCd] = raw.split("-");
  if (!cano || !acntPrdtCd) return null;
  return { cano, acntPrdtCd };
}
