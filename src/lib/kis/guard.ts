import { isPaperTrading } from "./env";
import { KisApiError } from "./errors";

// 계좌에 영향을 주는 호출(주문/정정/취소) 직전에 반드시 호출한다.
// KIS_BASE_URL이 모의투자 도메인이 아니면 즉시 막아서, 설정 실수로 실전 계좌에
// 주문이 나가는 사고를 코드 레벨에서 차단한다.
export function assertPaperTrading() {
  if (!isPaperTrading()) {
    throw new KisApiError(
      "NOT_PAPER_TRADING",
      "KIS_BASE_URL이 모의투자 도메인이 아닙니다. 이 앱은 모의투자 전용이며 실전투자 도메인에서는 주문 기능을 사용할 수 없습니다."
    );
  }
}
