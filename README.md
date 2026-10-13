# KIS 모의투자 대시보드

한국투자증권(KIS) Open API 모의투자 서버와 연동한 모의 주식 거래 대시보드입니다.
네이버증권 홈 화면의 레이아웃(지수 티커, 랭킹, 뉴스)을 참고해 종목 검색, 실시간성 시세,
관심종목, 모의투자 계좌 운용(매수/매도/정정/취소)까지 제공합니다.

## 기술 스택

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Tailwind CSS 3
- Next.js Route Handler를 이용한 서버 사이드 API 프록시
- 종목 검색/뉴스는 [k-skill-proxy](https://k-skill-proxy.nomadamas.org) 공개 프록시 사용 (별도 API 키 불필요)

## ⚠️ 모의투자 전용

이 앱은 **모의투자 전용**입니다. `KIS_BASE_URL`이 모의투자 도메인
(`https://openapivts.koreainvestment.com:29443`)이 아니면 `src/lib/kis/guard.ts`가
매수/매도/정정/취소 API 호출을 코드 레벨에서 차단합니다. 실전투자 도메인으로 절대 바꾸지 마세요.

## 폴더 구조

```
src/
  app/
    api/kis/token/route.ts        # KIS OAuth2 접근토큰 발급 (서버 전용, 토큰 원문 노출 안 함)
    api/kis/indices/route.ts       # 코스피/코스닥 지수 현재가
    api/kis/stocks/search/route.ts # 종목 검색 (k-skill-proxy)
    api/kis/stocks/[code]/route.ts # 종목 현재가 상세
    api/kis/stocks/quotes/route.ts  # 여러 종목 현재가 일괄 조회 (홈 랭킹용)
    api/kis/account/route.ts        # 모의투자 잔고 + 보유종목
    api/kis/orders/route.ts          # 당일 주문내역 조회 / 신규 주문(매수·매도)
    api/kis/orders/[orderNo]/route.ts # 주문 정정(PATCH) / 취소(DELETE)
    api/kis/watchlist/route.ts        # 관심종목 조회/추가
    api/kis/watchlist/[code]/route.ts  # 관심종목 삭제
    api/news/route.ts                   # 시장 뉴스 검색 (k-skill-proxy)
    page.tsx                # 홈: 지수 티커 + 계좌 요약 + 인기/관심종목 + 뉴스
    quote/page.tsx            # 종목 검색 + 상세 시세 + 매수/매도
    account/page.tsx           # 보유종목 + 당일 주문내역 (정정/취소)
    token/page.tsx              # 토큰 발급 상태 확인 (직접 URL로만 접근)
  components/
    Sidebar.tsx, Header.tsx, OrderDialog.tsx, StockListCard.tsx
  lib/
    kis/  # env, errors, guard, token, http, quote, indices, account, order, popularStocks
    proxy/ # koreanStockSearch, naverNews (k-skill-proxy 클라이언트)
    watchlist.ts # 관심종목 JSON 파일 영속화 (data/watchlist.json, git 미포함)
```

## 동작 방식

- APP Key / Secret / 계좌번호는 `.env`에만 저장되며 서버에서만 사용됩니다. 토큰 값 자체는
  어떤 API 응답에도 포함되지 않습니다(상태만 반환).
- 시세/지수는 3~5초 간격 폴링으로 갱신됩니다(진짜 실시간 WebSocket 푸시는 아님).
- 종목 검색은 KIS가 아니라 k-skill-proxy의 KRX 공개 데이터를 사용합니다. 당일 기준일 데이터가
  아직 없으면 최근 영업일까지 자동으로 거슬러 올라갑니다.
- 주문 실행 전에는 항상 확인 다이얼로그를 거칩니다.
- 각 API의 KIS TR ID·필드명은 구현 시점 기준이며, KIS 공식 문서가 바뀌었을 수 있으니 실제
  호출 전 한 번씩 대조하는 것을 권장합니다.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 참고해 저장소 루트에 `.env` 파일을 만들고 값을 입력합니다.

```env
KIS_APP_KEY=발급받은_APP_KEY
KIS_APP_SECRET=발급받은_APP_SECRET

# 반드시 모의투자 도메인을 사용하세요.
KIS_BASE_URL=https://openapivts.koreainvestment.com:29443

# 모의투자 계좌번호. "계좌번호-상품코드" 형식 (예: 12345678-01)
KIS_ACCOUNT=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`에서 확인합니다. `KIS_ACCOUNT`를 설정하지 않으면 홈/계좌 화면에서
잔고·주문 관련 기능은 안내 메시지와 함께 비활성 상태로 표시되고, 지수/시세/검색/뉴스는
그대로 동작합니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm run start
```

## 현재 상태

- 홈(지수·계좌요약·인기/관심종목·뉴스), 종목 조회(검색·상세·매수/매도), 계좌(보유종목·주문내역·정정/취소)
  화면까지 구현되어 있고, `npm run build`와 `tsc --noEmit` 통과를 확인했습니다.
- 지수·인기종목·뉴스·종목검색은 실계정 없이 동작을 확인했습니다.
- 계좌/주문 관련 API는 `KIS_ACCOUNT`가 아직 설정되지 않아 실제 호출 검증을 하지 못했습니다.
  계좌번호를 채운 뒤 장중에 한 번 직접 확인해 주세요.
- `.env`는 git에 커밋되지 않으며, `.env.example`을 기준으로 각자 로컬에 값을 채워 사용합니다.
