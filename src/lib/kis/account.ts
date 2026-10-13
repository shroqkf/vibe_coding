import { kisFetch } from "./http";
import { getKisAccount } from "./env";
import { KisApiError } from "./errors";

export type Holding = {
  code: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  evalAmount: number;
  profitLoss: number;
  profitLossRate: number;
};

export type AccountSummary = {
  depositCash: number; // 예수금
  totalEvalAmount: number; // 총평가금액
  totalProfitLoss: number; // 평가손익
  totalProfitLossRate: number;
  holdings: Holding[];
};

type BalanceOutput1 = {
  pdno: string;
  prdt_name: string;
  hldg_qty: string;
  pchs_avg_pric: string;
  prpr: string;
  evlu_amt: string;
  evlu_pfls_amt: string;
  evlu_pfls_rt: string;
};

type BalanceOutput2 = {
  dnca_tot_amt: string; // 예수금 총액
  tot_evlu_amt: string; // 총평가금액
  evlu_pfls_smtl_amt: string; // 평가손익 합계
};

function requireAccount() {
  const account = getKisAccount();
  if (!account) {
    throw new KisApiError(
      "ACCOUNT_MISSING",
      "KIS_ACCOUNT 환경변수(계좌번호-상품코드, 예: 12345678-01)가 설정되어 있지 않습니다."
    );
  }
  return account;
}

// 주식잔고조회(모의투자). tr_id는 구현 시점에 공식 문서로 재대조 필요.
export async function getAccountSummary(): Promise<AccountSummary> {
  const account = requireAccount();

  const data = await kisFetch<{ output1: BalanceOutput1[]; output2: BalanceOutput2[] }>(
    "/uapi/domestic-stock/v1/trading/inquire-balance",
    {
      trId: "VTTC8434R",
      query: {
        CANO: account.cano,
        ACNT_PRDT_CD: account.acntPrdtCd,
        AFHR_FLPR_YN: "N",
        OFL_YN: "",
        INQR_DVSN: "02",
        UNPR_DVSN: "01",
        FUND_STTL_ICLD_YN: "N",
        FNCG_AMT_AUTO_RDPT_YN: "N",
        PRCS_DVSN: "01",
        CTX_AREA_FK100: "",
        CTX_AREA_NK100: "",
      },
    }
  );

  const holdings: Holding[] = (data.output1 ?? [])
    .filter((h) => Number(h.hldg_qty) > 0)
    .map((h) => ({
      code: h.pdno,
      name: h.prdt_name,
      quantity: Number(h.hldg_qty),
      avgPrice: Number(h.pchs_avg_pric),
      currentPrice: Number(h.prpr),
      evalAmount: Number(h.evlu_amt),
      profitLoss: Number(h.evlu_pfls_amt),
      profitLossRate: Number(h.evlu_pfls_rt),
    }));

  const summary = data.output2?.[0];
  const totalEvalAmount = Number(summary?.tot_evlu_amt ?? 0);
  const totalProfitLoss = Number(summary?.evlu_pfls_smtl_amt ?? 0);
  // tot_evlu_amt가 예수금까지 포함한 총평가금액이라면 아래 수익률 계산의 분모(매입원가 추정치)가
  // 부정확할 수 있다 — 실제 응답을 받으면 KIS가 별도 수익률 필드를 주는지 확인하고 있으면 그걸로 교체.
  const costBasis = totalEvalAmount - totalProfitLoss;

  return {
    depositCash: Number(summary?.dnca_tot_amt ?? 0),
    totalEvalAmount,
    totalProfitLoss,
    totalProfitLossRate: costBasis > 0 ? (totalProfitLoss / costBasis) * 100 : 0,
    holdings,
  };
}
