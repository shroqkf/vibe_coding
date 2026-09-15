# KIS 대시보드: Part.1 완성 + Part.2(종목 검색·실시간 시세) 설계

## 배경

이 저장소는 "주식매매봇 만들기" 실습(사내 위키 Part.1, Part.2)을 따라가는 Next.js 프로젝트다.
Part.1(접근토큰 발급 + 모니터링)은 이미 시작되어 있지만 위키가 요구하는 스펙과는 차이가 있고,
Part.2(종목 검색기 + 실시간 체결·호가)는 아직 없다. 이 문서는 두 파트를 완성하기 위한 설계다.

### 현재 상태

- `src/app/api/kis/token/route.ts`: KIS OAuth2 접근토큰 발급. 토큰은 **모듈 메모리**에만 캐싱되어
  Next.js dev 서버가 재시작(핫리로드 포함)되면 캐시가 날아간다.
- `src/app/token/page.tsx`: "발급받기" 버튼을 눌러야 토큰을 받는 수동 테스트 페이지. 상태 자동 표시,
  만료까지 남은 시간, DB 영속화가 없다.
- `.env`에 `KIS_APP_KEY` / `KIS_APP_SECRET` / `KIS_BASE_URL`(모의투자 도메인)이 설정되어 있다.
  `KIS_ACCOUNT`(계좌번호)는 없다 — 이번 설계에서도 필요 없다(잔고 조회를 하지 않기로 결정했기 때문).
- 종목 검색, 종목 상세조회, 실시간 시세 기능은 전혀 없다.
- 테스트 러너가 없다(`package.json`에 `test` 스크립트 없음).

### 목표

1. **Part.1 완성**: 토큰 상태를 SQLite에 영속화하고, 자동으로 상태(발급됨/없음, 만료 시각, 남은 시간)를
   보여주는 대시보드로 `/token` 페이지를 교체한다.
2. **Part.1의 "조회 API 1개 추가"**: 시세 조회 API를 구현한다(잔고 조회는 하지 않음 — 계좌번호 불필요).
3. **Part.2**: 종목 마스터 파일을 다운로드·파싱해 이름/코드로 검색하는 기능, 선택한 종목의 상세정보,
   그리고 실시간 체결가·10단계 호가를 보여주는 `/quote` 페이지를 만든다.

### 스코프 밖

- 주문(매수/매도/정정/취소) 관련 기능 일체. 이름에 order/주문/buy/sell이 들어가는 API는 호출하지 않는다.
- 잔고 조회, 보유 종목 관리.
- 다중 서버 인스턴스/수평 확장, 프로덕션 배포 하드닝. 이 프로젝트는 개인 실습용 대시보드다.
- 토큰 폐기(revoke) 기능 — 위키의 "심화 과제"이며 이번 스코프에는 포함하지 않는다.

---

## 컴포넌트 구성

```
src/
  lib/
    kis/
      env.ts              # KIS_APP_KEY/SECRET/BASE_URL 읽기 + 검증 (값 노출 없이 상태만 리턴)
      errors.ts           # KisApiError 및 원인별 분류 (자격증명없음/토큰만료/네트워크오류/종목없음/알수없음)
      tokenStore.ts        # SQLite 기반 접근토큰 캐시 (better-sqlite3)
      wsKeyStore.ts        # SQLite 기반 WebSocket 접속키 캐시
      quote.ts             # 종목 현재가 시세조회 REST 클라이언트
      masterFile.ts         # KOSPI/KOSDAQ 종목마스터 다운로드 + 파싱 (zlib+euc-kr, 신규 npm 의존성 없음)
      masterFile.test.ts    # 네트워크 없이 파서 유닛 테스트 (고정 샘플 라인 사용)
      search.ts             # 파싱된 종목 리스트에서 이름/코드 검색
      search.test.ts
      realtime/
        client.ts           # KIS 실시간 WS 싱글턴 클라이언트 (연결, 구독 관리, 재연결, 프레임 디코딩)
        decode.ts            # H0STCNT0/H0STASP0 파이프 구분 프레임 디코더
        decode.test.ts
        hub.ts               # 종목코드 -> SSE 구독자 목록 매핑, 브로드캐스트
  app/
    api/
      kis/
        token/route.ts       # 기존 파일 교체: SQLite 캐시 사용, GET(상태조회)/POST(발급·강제갱신) 분리
        ws-key/route.ts       # WebSocket 접속키 발급/조회 (realtime/client.ts가 내부적으로 사용)
        stocks/
          search/route.ts    # GET ?q= 종목 검색
          [code]/route.ts    # GET 종목 상세 + 현재가
        stream/route.ts      # GET SSE, ?code= 실시간 체결·호가 스트림
    token/page.tsx            # 교체: 토큰 상태 대시보드 (SQLite 기반, 자동 표시 + 새로고침)
    quote/page.tsx             # 신규: 종목 검색 + 상세 + 실시간 체결·호가
  components/
    Sidebar.tsx                # "종목 조회" 메뉴 추가
data/
  app.db                       # SQLite 파일 (.gitignore 추가)
```

---

## 데이터 모델 (SQLite)

`better-sqlite3`로 `data/app.db`를 연다. 싱글톤 로우 패턴(고정 `id=1`)을 쓴다 — 계정이 하나뿐이라
여러 행이 필요 없고, "현재 유효한 토큰 하나"라는 불변식을 스키마 레벨에서 강제한다.

```sql
CREATE TABLE IF NOT EXISTS kis_token (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL   -- epoch ms
);

CREATE TABLE IF NOT EXISTS kis_ws_key (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  approval_key TEXT NOT NULL,
  issued_at INTEGER NOT NULL    -- epoch ms
);
```

- `kis_token`은 기존 `/api/kis/token`의 만료-60초-전-재사용 로직을 그대로 SQLite 위에서 구현한다.
- `kis_ws_key`는 KIS의 `POST /oauth2/Approval`(WebSocket 접속키 발급, `secretkey` 방식)로 받은 키를
  캐싱한다. 접속키는 만료 개념이 실질적으로 없어(재발급 전까지 유효) 있으면 재사용, 없으면 발급한다.
- 두 테이블 모두 토큰 **값 자체**를 화면에 절대 내려주지 않는다(API 응답에도 포함 안 함) — 상태만 계산해서 반환.

---

## API 설계

### `GET /api/kis/token` — 상태 조회 (신규)
DB에 저장된 토큰의 상태만 반환. 토큰 문자열은 절대 포함하지 않는다.
```json
{ "status": "issued", "expiresAt": "2026-09-15T10:00:00.000Z", "remainingMs": 3520000 }
```
토큰이 없으면 `{ "status": "none" }`.

### `POST /api/kis/token` — 발급/강제 갱신 (기존 로직 유지, 저장소만 SQLite로 교체)
만료 60초 이상 남았으면 DB 캐시 재사용, 아니면 KIS에 재발급 요청 후 DB에 upsert.
응답은 `GET`과 동일한 상태 정보만 반환한다(`status`/`expiresAt`/`remainingMs`). **변경점**: 현재
구현은 `access_token` 원문을 응답 JSON에 그대로 담아 클라이언트로 보내고, `token/page.tsx`가 그걸
받아서 화면에서만 마스킹하고 있다. 이번 설계부터는 서버가 원문을 아예 응답에 넣지 않는다 — 마스킹은
"안 보이게 가리는 것"이 아니라 "애초에 안 주는 것"으로 강화한다.

### `POST /api/kis/ws-key` — WebSocket 접속키 발급/조회 (신규)
`POST https://{KIS_BASE_URL}/oauth2/Approval`에 `{ grant_type: "client_credentials", appkey, secretkey: appSecret }`
(필드명이 `appsecret`이 아니라 `secretkey`인 것이 REST 토큰 발급과의 차이 — 실제 KIS 문서 기준이며,
구현 시 최신 공식 문서로 한 번 더 대조한다)를 보내 `approval_key`를 받고 `kis_ws_key`에 캐싱한다.
`realtime/client.ts`가 WS 연결 시 내부적으로 호출하며, 별도 프론트엔드 UI는 없다.

### `GET /api/kis/stocks/search?q=` (신규)
서버 모듈 메모리에 캐싱된 마스터 리스트에서 이름/코드로 검색. 마스터 리스트가 없으면 그 요청에서
지연 로딩(다운로드+파싱)하고 이후 요청은 캐시 사용. 결과 예:
```json
{ "results": [{ "code": "005930", "name": "삼성전자", "market": "KOSPI" }, ...] }
```

### `GET /api/kis/stocks/:code` (신규)
`GET /uapi/domestic-stock/v1/quotations/inquire-price` (`tr_id: FHKST01010100`,
`FID_COND_MRKT_DIV_CODE=J`, `FID_INPUT_ISCD=종목코드`)를 호출해 상세정보(현재가, 등락률, 거래량 등)를
반환한다. 이 TR ID·경로는 구현 시점에 KIS 공식 문서로 한 번 더 대조한다(문서가 바뀌었을 수 있음).
필드 **이름**은 문서를 따르되, **값의 형식**(자리채움, 문자열/숫자 여부 등)은 실제 응답을 한 번
찍어보고 검증 로직을 작성한다(위키 교훈 1 — Part.2에서 `pdno`가 `00000A005930`처럼 자리채움되어
오는 걸 놓쳐 검증이 통째로 실패했던 사례).

### `GET /api/kis/stream?code=` (신규, SSE)
Node 런타임 Route Handler에서 `ReadableStream`으로 `text/event-stream` 응답을 낸다.
1. 요청이 들어오면 `realtime/client.ts`의 싱글턴 KIS WS 연결이 없으면 생성(WS 접속키는
   `wsKeyStore`에서 가져오거나 새로 발급).
2. 해당 `code`가 아직 구독 중이 아니면 KRX 전용 채널 `H0STASP0`(호가)와 `H0STCNT0`(체결)을 구독.
3. `hub.ts`에 이 SSE 커넥션을 `code` 구독자로 등록.
4. KIS 프레임이 오면 `decode.ts`로 디코딩 → 매칭되는 구독자들에게 `data: {...}\n\n`으로 전송.
5. 클라이언트 연결이 끊기면(`request.signal.abort`) 구독자 목록에서 제거하고, 그 종목의 마지막
   구독자였다면 KIS에 구독 해지 요청을 보낸다(TR 슬롯 절약).

---

## 에러 처리 (위키 교훈 1, 2 반영)

`lib/kis/errors.ts`에 원인별 에러 클래스/코드를 정의하고, 모든 API 라우트가 `catch`에서 이 코드로
매핑해 응답한다. **"알 수 없는 오류"는 진짜 분류 불가능한 경우에만 쓴다.**

| 코드 | 상황 | HTTP |
|---|---|---|
| `CREDENTIALS_MISSING` | `.env`에 APP_KEY/SECRET 없음 | 500 |
| `TOKEN_EXPIRED` | KIS가 토큰 만료/무효 응답 | 401 |
| `STOCK_NOT_FOUND` | 종목코드가 마스터 리스트/API 응답 모두에 없음 | 404 |
| `UPSTREAM_NETWORK_ERROR` | KIS 서버 연결 실패/타임아웃 | 502 |
| `UNKNOWN` | 위 어디에도 안 걸리는 진짜 미분류 오류 | 500 |

프론트엔드는 코드별로 다른 문구를 보여준다(예: "종목을 찾을 수 없습니다" vs "네트워크 오류입니다").
유닛 테스트로 "분류되지 않은 예외가 UNKNOWN 대신 다른 코드로 잘못 뭉개지지 않는지"를 확인한다.

---

## 실시간 데이터 무결성 (위키 교훈 3, 4, 5 반영)

- 화면 계약 검증에서 **수량이 0이어도 유효한 스냅샷으로 취급**한다(보유 종목이 아닌 관찰 종목은
  수량 0이 정상이므로, `quantity <= 0`을 무효 조건으로 쓰지 않는다 — Part.2가 겪은 버그를 원천 차단).
- 검증 실패 시 **조용히 버리지 않는다**: 실패 사유를 콘솔에 로그로 남기고, SSE로도
  `event: decode-error` 이벤트를 보내 화면이 "대기 중" 대신 원인을 알 수 있게 한다.
- 구독 성공 응답(`rt_cd=0`)과 실제 데이터 수신은 다른 이벤트로 구분한다. 구독 후 일정 시간
  (예: 5초) 동안 프레임이 하나도 없으면 화면에 "이 종목은 KRX 전용 채널에서 데이터가 오지 않을 수
  있습니다(대체거래소 미상장 종목 등)"라는 안내를 띄운다 — 위키가 겪은 "성공 응답인데 침묵" 케이스.

---

## 프론트엔드

### `/token` (교체)
- 상태 배지(발급됨/없음), 만료 시각, 남은 시간(실시간 카운트다운), 새로고침 버튼.
- 토큰 값은 절대 표시하지 않는다(마스킹조차 하지 않음 — 애초에 서버가 안 내려줌).
- 시세 조회 데모는 이 페이지가 아니라 `/quote`에서만 노출한다(중복 방지).

### `/quote` (신규)
- 검색창(디바운스 300ms) → `/api/kis/stocks/search` 호출 → 드롭다운으로 후보 표시.
- 종목 선택 → 상세정보(현재가/등락률/거래량) 요청 + `EventSource`로 `/api/kis/stream?code=` 구독 시작.
- 체결가 스트림, 10단계 호가 테이블 렌더링.
- 페이지 이탈/종목 변경 시 이전 `EventSource`를 반드시 close (구독 누수 방지).

### `Sidebar.tsx`
- `{ href: "/quote", label: "종목 조회" }` 항목 추가.

---

## 테스트 전략

새 테스트 러너가 없으므로 devDependency로 **`tsx`** 하나만 추가해 Node 내장 `node:test` +
`node:assert`로 TypeScript 테스트를 바로 실행한다(`tsx --test`). Jest/Vitest 같은 무거운 설정은
이 프로젝트 규모에 비해 과하다.

- `masterFile.test.ts`: 실제 파일 대신 짧은 고정 텍스트 라인(KOSPI 228자 꼬리, KOSDAQ 222자 꼬리
  샘플)을 만들어 파서가 단축코드/표준코드/한글명을 올바르게 분리하는지, 6자리 숫자가 아닌 코드를
  제외하는지 확인. 네트워크 호출 없음.
- `search.ts`: 파싱된 고정 리스트에 대해 "삼성" → 삼성전자/삼성전자우가 나오는지, "005930" 코드
  검색이 되는지 확인.
- `decode.test.ts`: KIS 체결/호가 프레임 샘플 문자열(파이프 구분)을 디코딩한 결과가 기대 필드와
  일치하는지, 수량 0인 프레임이 무효 처리되지 않는지 확인.
- `errors.ts`: 각 원인이 올바른 코드로 매핑되는지, 미분류 예외만 `UNKNOWN`으로 떨어지는지 확인.
- `tokenStore.ts`: `:memory:` SQLite로 upsert/만료 재사용 로직 테스트.
- 시세조회·실시간 스트림은 실제 KIS 서버가 필요해 자동화하지 않고, 위키의 마무리 체크리스트 형태로
  장중(09:00–15:30) 수동 확인 항목으로 문서화한다.

`package.json`에 `"test": "tsx --test src/lib/**/*.test.ts"` 스크립트를 추가한다.

---

## 새 의존성

| 패키지 | 용도 | 비고 |
|---|---|---|
| `better-sqlite3` | 토큰/접속키 영속화 | 동기 API, Next.js Node 런타임에서만 사용 |
| `ws` | KIS 실시간 WS 업스트림 연결 | Node 20 환경이라 표준 WebSocket 클라이언트 필요 |
| `tsx` (dev) | TS 테스트 실행 | Jest/Vitest 대신 최소 구성 |

종목마스터 파싱(zip/cp949)에는 위키 지시대로 새 패키지를 추가하지 않는다(`node:zlib` +
`TextDecoder("euc-kr")`만 사용).

---

## 보안 체크리스트 (위키 "시작 전 보안 사항" 반영)

- [ ] 주문 관련 엔드포인트/코드 없음 확인
- [ ] 토큰 값이 API 응답·화면·로그 어디에도 원문으로 노출되지 않음
- [ ] `data/app.db`가 `.gitignore`에 포함됨 (토큰이 로컬 파일에 평문 저장되므로 `.env`와 동급으로 취급)
- [ ] `.env`는 여전히 git에 커밋되지 않음
