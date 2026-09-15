# KIS 대시보드 Part.1 완성 + Part.2 구현 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토큰 상태를 SQLite로 영속화하는 Part.1 대시보드를 완성하고, 종목 마스터 파일 파싱·검색·상세조회·실시간(SSE) 체결·호가 스트리밍으로 구성된 Part.2를 구현한다.

**Architecture:** Next.js 15 App Router 위에 `src/lib/kis/*` 서버 전용 모듈(에러 분류, SQLite 저장소, KIS REST/WS 클라이언트, 종목마스터 파서)을 두고, Route Handler가 이 모듈들을 조합해 REST API + SSE 스트림을 제공한다. 프런트엔드는 `/token`(상태 대시보드), `/quote`(검색+실시간) 두 페이지.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, better-sqlite3(토큰·WS접속키 영속화), ws(KIS 실시간 WebSocket 업스트림), node:zlib+TextDecoder(종목마스터 zip/cp949 파싱, 신규 의존성 없음), node:test+tsx(테스트 러너).

**Spec:** `docs/superpowers/specs/2026-09-15-kis-dashboard-part2-design.md`

## Global Constraints

- 주문(order) 관련 엔드포인트/코드는 절대 추가하지 않는다. 이름에 order/주문/buy/sell이 들어간 어떤 API도 호출하지 않는다.
- 토큰 값(`access_token`)과 WebSocket 접속키는 API 응답 JSON, 화면, 콘솔 로그 어디에도 원문으로 노출하지 않는다.
- 종목마스터 파일(zip/cp949) 파싱에는 `node:zlib`(`inflateRawSync`)과 `TextDecoder("euc-kr")`만 쓴다. 새 npm 패키지를 추가하지 않는다.
- 새로 추가하는 의존성은 `better-sqlite3`, `ws`(runtime)와 `tsx`, `@types/better-sqlite3`, `@types/ws`(dev)로 제한한다. `better-sqlite3`는 반드시 `^11.10.0`을 쓴다 — 최신 13.x는 Node 22 전용 빌드라 이 환경(Node v20.12.2)에서 세그폴트로 죽는 것을 실측 확인했다.
- SQLite 파일은 `data/app.db`에 두고 `.gitignore`에 `/data/`를 추가한다(토큰 평문이 저장되므로 `.env`와 동급으로 취급).
- `.env`는 계속 git에 커밋하지 않는다.
- Next.js 15 Route Handler의 동적 세그먼트 `params`는 `Promise`다 (`{ params }: { params: Promise<{ code: string }> }` 형태로 받고 `await`한다).
- "알 수 없는 오류"류의 뭉뚱그린 에러 문구를 새로 만들지 않는다 — 모든 실패는 `src/lib/kis/errors.ts`의 원인별 코드로 분류한다.
- 실시간 데이터 검증에서 수량(`quantity`)이 0인 것을 무효 조건으로 쓰지 않는다(보유하지 않은 관찰 종목은 수량 0이 정상).

---

### Task 1: 의존성 추가 및 프로젝트 설정

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `.env` (로컬 전용, git 추적 안 됨)

**Interfaces:**
- Produces: `npm test` 스크립트, `better-sqlite3`/`ws` 런타임 의존성, `tsx`/`@types/better-sqlite3`/`@types/ws` 개발 의존성. 이후 모든 태스크가 이 의존성들을 그대로 사용한다.

- [ ] **Step 1: 런타임 의존성 설치**

Run:
```bash
npm install better-sqlite3@^11.10.0 ws@^8.21.3
```
Expected: `package.json`의 `dependencies`에 두 패키지가 추가됨.

- [ ] **Step 2: 개발 의존성 설치**

Run:
```bash
npm install -D tsx@^4.23.13 @types/better-sqlite3@^9.6.0 @types/ws@^8.18.1
```
Expected: `package.json`의 `devDependencies`에 세 패키지가 추가됨.

- [ ] **Step 3: `test` 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"test": "tsx --test src/lib/kis/*.test.ts src/lib/kis/realtime/*.test.ts"
```
(디렉터리별로 명시적 glob을 나열한다 — `**` 재귀 글롭은 `sh -c`로 실행되는 npm 스크립트 환경에서 셸에 따라 한 단계만 확장되거나 아예 확장되지 않을 수 있어 신뢰할 수 없다.)

- [ ] **Step 4: `.gitignore`에 SQLite 데이터 디렉터리 추가**

`.gitignore` 끝에 추가:
```
/data/
```

- [ ] **Step 5: `.env.example`에 WebSocket 접속 주소 추가**

`.env.example` 끝에 추가:
```env

# (선택) 실시간 시세 WebSocket 접속 주소. 지정하지 않으면 실전투자 주소가 기본값으로 사용됩니다.
# 실전투자: ws://ops.koreainvestment.com:21000
# 모의투자 데이터가 오지 않으면 아래로 바꿔서 시도하세요: ws://ops.koreainvestment.com:31000
KIS_WS_URL=
```

- [ ] **Step 6: 로컬 `.env`에도 동일 항목 추가 (빈 값)**

`.env` 파일 끝에 `KIS_WS_URL=` 한 줄을 빈 값으로 추가한다(git에 커밋되지 않는 로컬 파일).

- [ ] **Step 7: 설치 확인**

Run:
```bash
npm run build
```
Expected: 기존 코드 변경이 없으므로 지금까지와 동일하게 빌드 성공.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add better-sqlite3/ws/tsx deps and test script for KIS dashboard Part.2"
```

---

### Task 2: 에러 분류 (`src/lib/kis/errors.ts`)

**Files:**
- Create: `src/lib/kis/errors.ts`
- Test: `src/lib/kis/errors.test.ts`

**Interfaces:**
- Produces: `KisErrorCode` 타입, `KisApiError` 클래스(`code`, `status`, `message` 필드), `kisError(code, message): KisApiError`, `toKisApiError(err: unknown): KisApiError`, `kisErrorResponseBody(err: KisApiError): { error: string; code: string }`. 이후 모든 API 라우트와 `lib/kis/*` 모듈이 이 함수들로 에러를 던지고 매핑한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/errors.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { KisApiError, kisError, toKisApiError, kisErrorResponseBody } from "./errors";

test("kisError attaches the right HTTP status per code", () => {
  assert.equal(kisError("STOCK_NOT_FOUND", "x").status, 404);
  assert.equal(kisError("TOKEN_EXPIRED", "x").status, 401);
  assert.equal(kisError("UPSTREAM_NETWORK_ERROR", "x").status, 502);
  assert.equal(kisError("CREDENTIALS_MISSING", "x").status, 500);
  assert.equal(kisError("UNKNOWN", "x").status, 500);
});

test("toKisApiError passes an existing KisApiError through unchanged", () => {
  const original = kisError("STOCK_NOT_FOUND", "없음");
  assert.equal(toKisApiError(original), original);
});

test("toKisApiError maps a fetch TypeError to UPSTREAM_NETWORK_ERROR", () => {
  const err = new TypeError("fetch failed");
  assert.equal(toKisApiError(err).code, "UPSTREAM_NETWORK_ERROR");
});

test("toKisApiError falls back to UNKNOWN only for a truly unclassified Error", () => {
  assert.equal(toKisApiError(new Error("something weird")).code, "UNKNOWN");
});

test("toKisApiError handles a non-Error throwable", () => {
  assert.equal(toKisApiError("plain string throw").code, "UNKNOWN");
});

test("kisErrorResponseBody exposes only error message and code, nothing else", () => {
  const body = kisErrorResponseBody(kisError("STOCK_NOT_FOUND", "종목 없음"));
  assert.deepEqual(body, { error: "종목 없음", code: "STOCK_NOT_FOUND" });
});

test("KisApiError is an instance of Error", () => {
  const err = kisError("UNKNOWN", "x");
  assert.ok(err instanceof Error);
  assert.equal(err.name, "KisApiError");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/errors.test.ts`
Expected: FAIL — `./errors` 모듈을 찾을 수 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/errors.ts`:
```ts
export type KisErrorCode =
  | "CREDENTIALS_MISSING"
  | "TOKEN_EXPIRED"
  | "STOCK_NOT_FOUND"
  | "UPSTREAM_NETWORK_ERROR"
  | "UNKNOWN";

const STATUS_BY_CODE: Record<KisErrorCode, number> = {
  CREDENTIALS_MISSING: 500,
  TOKEN_EXPIRED: 401,
  STOCK_NOT_FOUND: 404,
  UPSTREAM_NETWORK_ERROR: 502,
  UNKNOWN: 500,
};

export class KisApiError extends Error {
  readonly code: KisErrorCode;
  readonly status: number;

  constructor(code: KisErrorCode, message: string, status: number) {
    super(message);
    this.name = "KisApiError";
    this.code = code;
    this.status = status;
  }
}

export function kisError(code: KisErrorCode, message: string): KisApiError {
  return new KisApiError(code, message, STATUS_BY_CODE[code]);
}

export function toKisApiError(err: unknown): KisApiError {
  if (err instanceof KisApiError) return err;
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return kisError("UPSTREAM_NETWORK_ERROR", "KIS 서버에 연결할 수 없습니다.");
  }
  if (err instanceof Error) {
    return kisError("UNKNOWN", err.message);
  }
  return kisError("UNKNOWN", "알 수 없는 오류가 발생했습니다.");
}

export function kisErrorResponseBody(err: KisApiError): { error: string; code: KisErrorCode } {
  return { error: err.message, code: err.code };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/errors.test.ts`
Expected: 7개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/errors.ts src/lib/kis/errors.test.ts
git commit -m "feat: add KIS error classification (errors.ts)"
```

---

### Task 3: 환경변수 로더 (`src/lib/kis/env.ts`)

**Files:**
- Create: `src/lib/kis/env.ts`
- Test: `src/lib/kis/env.test.ts`

**Interfaces:**
- Consumes: `kisError` from `./errors` (Task 2).
- Produces: `type KisEnv = { appKey: string; appSecret: string; baseUrl: string }`, `getKisEnv(): KisEnv` (throws `KisApiError` with code `CREDENTIALS_MISSING`). Task 5(auth), Task 11(quote), Task 18(realtime client)가 이 함수를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/env.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getKisEnv } from "./env";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("getKisEnv reads app key/secret/base url from process.env", () => {
  withEnv(
    { KIS_APP_KEY: "key", KIS_APP_SECRET: "secret", KIS_BASE_URL: "https://example.test" },
    () => {
      const env = getKisEnv();
      assert.deepEqual(env, {
        appKey: "key",
        appSecret: "secret",
        baseUrl: "https://example.test",
      });
    }
  );
});

test("getKisEnv defaults baseUrl to the real-trading domain when unset", () => {
  withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: "secret", KIS_BASE_URL: undefined }, () => {
    assert.equal(getKisEnv().baseUrl, "https://openapi.koreainvestment.com:9443");
  });
});

test("getKisEnv defaults baseUrl even when KIS_BASE_URL is an empty string", () => {
  withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: "secret", KIS_BASE_URL: "" }, () => {
    assert.equal(getKisEnv().baseUrl, "https://openapi.koreainvestment.com:9443");
  });
});

test("getKisEnv throws CREDENTIALS_MISSING when the app key is absent", () => {
  withEnv({ KIS_APP_KEY: undefined, KIS_APP_SECRET: "secret" }, () => {
    assert.throws(() => getKisEnv(), (err: any) => err.code === "CREDENTIALS_MISSING");
  });
});

test("getKisEnv throws CREDENTIALS_MISSING when the app secret is absent", () => {
  withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: undefined }, () => {
    assert.throws(() => getKisEnv(), (err: any) => err.code === "CREDENTIALS_MISSING");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/env.test.ts`
Expected: FAIL — `./env` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/env.ts`:
```ts
import { kisError } from "./errors";

export type KisEnv = {
  appKey: string;
  appSecret: string;
  baseUrl: string;
};

const DEFAULT_BASE_URL = "https://openapi.koreainvestment.com:9443";

export function getKisEnv(): KisEnv {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    throw kisError(
      "CREDENTIALS_MISSING",
      "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되어 있지 않습니다. 저장소 루트의 .env 파일을 확인하세요."
    );
  }

  return {
    appKey,
    appSecret,
    baseUrl: process.env.KIS_BASE_URL || DEFAULT_BASE_URL,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/env.test.ts`
Expected: 5개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/env.ts src/lib/kis/env.test.ts
git commit -m "feat: add KIS env loader with CREDENTIALS_MISSING error"
```

---

### Task 4: SQLite 연결 + 토큰 저장소 (`db.ts`, `tokenStore.ts`)

**Files:**
- Create: `src/lib/kis/db.ts`
- Create: `src/lib/kis/tokenStore.ts`
- Test: `src/lib/kis/tokenStore.test.ts`

**Interfaces:**
- Produces: `getDb(dbPath?: string): Database.Database` (기본값은 `data/app.db`, `":memory:"`를 넘기면 매번 새 인메모리 DB). `type TokenRecord = { accessToken: string; tokenType: string; expiresAt: number }`, `readToken(db?): TokenRecord | null`, `writeToken(token: TokenRecord, db?): void`, `isTokenUsable(token: TokenRecord | null, now?: number): token is TokenRecord`. Task 5(auth), Task 6(wsKeyStore가 `getDb` 재사용), Task 7(token route)이 이 함수들을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/tokenStore.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "./db";
import { readToken, writeToken, isTokenUsable } from "./tokenStore";

test("readToken returns null when nothing has been written", () => {
  const db = getDb(":memory:");
  assert.equal(readToken(db), null);
});

test("writeToken then readToken round-trips the same values", () => {
  const db = getDb(":memory:");
  writeToken({ accessToken: "abc", tokenType: "Bearer", expiresAt: 123456 }, db);
  assert.deepEqual(readToken(db), { accessToken: "abc", tokenType: "Bearer", expiresAt: 123456 });
});

test("writeToken twice overwrites the single row instead of inserting a second one", () => {
  const db = getDb(":memory:");
  writeToken({ accessToken: "first", tokenType: "Bearer", expiresAt: 1 }, db);
  writeToken({ accessToken: "second", tokenType: "Bearer", expiresAt: 2 }, db);
  const count = db.prepare("SELECT COUNT(*) as c FROM kis_token").get() as { c: number };
  assert.equal(count.c, 1);
  assert.equal(readToken(db)?.accessToken, "second");
});

test("isTokenUsable is true when more than 60s remain", () => {
  const now = Date.now();
  const token = { accessToken: "x", tokenType: "Bearer", expiresAt: now + 120_000 };
  assert.equal(isTokenUsable(token, now), true);
});

test("isTokenUsable is false when 60s or less remain", () => {
  const now = Date.now();
  const token = { accessToken: "x", tokenType: "Bearer", expiresAt: now + 30_000 };
  assert.equal(isTokenUsable(token, now), false);
});

test("isTokenUsable is false for null", () => {
  assert.equal(isTokenUsable(null), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/tokenStore.test.ts`
Expected: FAIL — `./db`, `./tokenStore` 모듈 없음.

- [ ] **Step 3: `db.ts` 구현**

`src/lib/kis/db.ts`:
```ts
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

let singleton: Database.Database | null = null;

export function getDb(dbPath: string = defaultDbPath()): Database.Database {
  if (dbPath === ":memory:") {
    return createDb(dbPath);
  }
  if (!singleton) {
    singleton = createDb(dbPath);
  }
  return singleton;
}

function defaultDbPath(): string {
  return path.join(process.cwd(), "data", "app.db");
}

function createDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);

  if (dbPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS kis_token (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      token_type TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kis_ws_key (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      approval_key TEXT NOT NULL,
      issued_at INTEGER NOT NULL
    );
  `);

  return db;
}
```

- [ ] **Step 4: `tokenStore.ts` 구현**

`src/lib/kis/tokenStore.ts`:
```ts
import type Database from "better-sqlite3";
import { getDb } from "./db";

export type TokenRecord = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

type TokenRow = {
  access_token: string;
  token_type: string;
  expires_at: number;
};

export function readToken(db: Database.Database = getDb()): TokenRecord | null {
  const row = db
    .prepare("SELECT access_token, token_type, expires_at FROM kis_token WHERE id = 1")
    .get() as TokenRow | undefined;

  if (!row) return null;

  return {
    accessToken: row.access_token,
    tokenType: row.token_type,
    expiresAt: row.expires_at,
  };
}

export function writeToken(token: TokenRecord, db: Database.Database = getDb()): void {
  db.prepare(
    `INSERT INTO kis_token (id, access_token, token_type, expires_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       token_type = excluded.token_type,
       expires_at = excluded.expires_at`
  ).run(token.accessToken, token.tokenType, token.expiresAt);
}

export function isTokenUsable(
  token: TokenRecord | null,
  now: number = Date.now()
): token is TokenRecord {
  return token !== null && token.expiresAt - now > 60_000;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/tokenStore.test.ts`
Expected: 6개 테스트 모두 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/kis/db.ts src/lib/kis/tokenStore.ts src/lib/kis/tokenStore.test.ts
git commit -m "feat: add SQLite connection and token store"
```

---

### Task 5: WebSocket 접속키 저장소 (`wsKeyStore.ts`)

**Files:**
- Create: `src/lib/kis/wsKeyStore.ts`
- Test: `src/lib/kis/wsKeyStore.test.ts`

**Interfaces:**
- Consumes: `getDb` from `./db` (Task 4).
- Produces: `type WsKeyRecord = { approvalKey: string; issuedAt: number }`, `readWsKey(db?): WsKeyRecord | null`, `writeWsKey(key: WsKeyRecord, db?): void`. Task 6(auth), Task 18(realtime client)이 이 함수들을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/wsKeyStore.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "./db";
import { readWsKey, writeWsKey } from "./wsKeyStore";

test("readWsKey returns null when nothing has been written", () => {
  const db = getDb(":memory:");
  assert.equal(readWsKey(db), null);
});

test("writeWsKey then readWsKey round-trips the same values", () => {
  const db = getDb(":memory:");
  writeWsKey({ approvalKey: "abc", issuedAt: 111 }, db);
  assert.deepEqual(readWsKey(db), { approvalKey: "abc", issuedAt: 111 });
});

test("writeWsKey twice overwrites the single row", () => {
  const db = getDb(":memory:");
  writeWsKey({ approvalKey: "first", issuedAt: 1 }, db);
  writeWsKey({ approvalKey: "second", issuedAt: 2 }, db);
  const count = db.prepare("SELECT COUNT(*) as c FROM kis_ws_key").get() as { c: number };
  assert.equal(count.c, 1);
  assert.equal(readWsKey(db)?.approvalKey, "second");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/wsKeyStore.test.ts`
Expected: FAIL — `./wsKeyStore` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/wsKeyStore.ts`:
```ts
import type Database from "better-sqlite3";
import { getDb } from "./db";

export type WsKeyRecord = {
  approvalKey: string;
  issuedAt: number;
};

type WsKeyRow = {
  approval_key: string;
  issued_at: number;
};

export function readWsKey(db: Database.Database = getDb()): WsKeyRecord | null {
  const row = db
    .prepare("SELECT approval_key, issued_at FROM kis_ws_key WHERE id = 1")
    .get() as WsKeyRow | undefined;

  if (!row) return null;

  return { approvalKey: row.approval_key, issuedAt: row.issued_at };
}

export function writeWsKey(key: WsKeyRecord, db: Database.Database = getDb()): void {
  db.prepare(
    `INSERT INTO kis_ws_key (id, approval_key, issued_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       approval_key = excluded.approval_key,
       issued_at = excluded.issued_at`
  ).run(key.approvalKey, key.issuedAt);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/wsKeyStore.test.ts`
Expected: 3개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/wsKeyStore.ts src/lib/kis/wsKeyStore.test.ts
git commit -m "feat: add WebSocket approval key store"
```

---

### Task 6: 인증 오케스트레이션 (`auth.ts`)

**Files:**
- Create: `src/lib/kis/auth.ts`
- Test: `src/lib/kis/auth.test.ts`

**Interfaces:**
- Consumes: `getKisEnv` (Task 3), `getDb`, `readToken`, `writeToken`, `isTokenUsable`, `TokenRecord` (Task 4), `readWsKey`, `writeWsKey` (Task 5), `kisError`, `toKisApiError` (Task 2).
- Produces: `ensureAccessToken(db?: Database.Database): Promise<TokenRecord>`, `ensureWsApprovalKey(db?: Database.Database): Promise<string>`. Task 7(token route), Task 11(quote), Task 18(realtime client)이 이 함수들을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/auth.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "./db";
import { writeToken } from "./tokenStore";
import { writeWsKey } from "./wsKeyStore";
import { ensureAccessToken, ensureWsApprovalKey } from "./auth";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return fn().finally(() => {
    for (const key of Object.keys(vars)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

test("ensureAccessToken returns the cached token without calling fetch when still valid", async () => {
  const db = getDb(":memory:");
  writeToken({ accessToken: "cached-token", tokenType: "Bearer", expiresAt: Date.now() + 120_000 }, db);

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    const token = await ensureAccessToken(db);
    assert.equal(token.accessToken, "cached-token");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureAccessToken fetches and caches a new token when none is cached", async () => {
  const db = getDb(":memory:");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ access_token: "fresh-token", token_type: "Bearer", expires_in: 3600 }),
      { status: 200 }
    )) as typeof fetch;

  try {
    await withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: "secret" }, async () => {
      const token = await ensureAccessToken(db);
      assert.equal(token.accessToken, "fresh-token");
      assert.equal(token.tokenType, "Bearer");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureAccessToken throws CREDENTIALS_MISSING when env vars are absent", async () => {
  const db = getDb(":memory:");
  await withEnv({ KIS_APP_KEY: undefined, KIS_APP_SECRET: undefined }, async () => {
    await assert.rejects(
      () => ensureAccessToken(db),
      (err: any) => err.code === "CREDENTIALS_MISSING"
    );
  });
});

test("ensureAccessToken maps a non-ok KIS response to TOKEN_EXPIRED", async () => {
  const db = getDb(":memory:");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error_description: "invalid appkey" }), { status: 401 })) as typeof fetch;

  try {
    await withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: "secret" }, async () => {
      await assert.rejects(
        () => ensureAccessToken(db),
        (err: any) => err.code === "TOKEN_EXPIRED"
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureWsApprovalKey returns the cached key without calling fetch", async () => {
  const db = getDb(":memory:");
  writeWsKey({ approvalKey: "cached-key", issuedAt: Date.now() }, db);

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("should not be called");
  }) as typeof fetch;

  try {
    const key = await ensureWsApprovalKey(db);
    assert.equal(key, "cached-key");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureWsApprovalKey fetches and caches a new key when none is cached", async () => {
  const db = getDb(":memory:");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ approval_key: "new-approval-key" }), { status: 200 })) as typeof fetch;

  try {
    await withEnv({ KIS_APP_KEY: "key", KIS_APP_SECRET: "secret" }, async () => {
      const key = await ensureWsApprovalKey(db);
      assert.equal(key, "new-approval-key");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/auth.test.ts`
Expected: FAIL — `./auth` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/auth.ts`:
```ts
import type Database from "better-sqlite3";
import { getKisEnv } from "./env";
import { getDb } from "./db";
import { readToken, writeToken, isTokenUsable, type TokenRecord } from "./tokenStore";
import { readWsKey, writeWsKey } from "./wsKeyStore";
import { kisError, toKisApiError } from "./errors";

export async function ensureAccessToken(db: Database.Database = getDb()): Promise<TokenRecord> {
  try {
    const cached = readToken(db);
    if (isTokenUsable(cached)) {
      return cached;
    }

    const env = getKisEnv();
    const res = await fetch(`${env.baseUrl}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: env.appKey,
        appsecret: env.appSecret,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      throw kisError(
        "TOKEN_EXPIRED",
        data.error_description ?? data.msg1 ?? "토큰 발급에 실패했습니다."
      );
    }

    const expiresInSec = Number(data.expires_in ?? 86400);
    const token: TokenRecord = {
      accessToken: data.access_token as string,
      tokenType: (data.token_type as string) ?? "Bearer",
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    writeToken(token, db);
    return token;
  } catch (err) {
    throw toKisApiError(err);
  }
}

export async function ensureWsApprovalKey(db: Database.Database = getDb()): Promise<string> {
  try {
    const cached = readWsKey(db);
    if (cached) return cached.approvalKey;

    const env = getKisEnv();
    const res = await fetch(`${env.baseUrl}/oauth2/Approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: env.appKey,
        secretkey: env.appSecret,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data.approval_key) {
      throw kisError(
        "UPSTREAM_NETWORK_ERROR",
        data.error_description ?? "WebSocket 접속키 발급에 실패했습니다."
      );
    }

    const key: string = data.approval_key;
    writeWsKey({ approvalKey: key, issuedAt: Date.now() }, db);
    return key;
  } catch (err) {
    throw toKisApiError(err);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/auth.test.ts`
Expected: 6개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/auth.ts src/lib/kis/auth.test.ts
git commit -m "feat: add ensureAccessToken/ensureWsApprovalKey orchestration"
```

---

### Task 7: 토큰 API 라우트 교체 (SQLite 기반 상태 조회/발급)

**Files:**
- Modify: `src/app/api/kis/token/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `ensureAccessToken` (Task 6), `readToken`, `isTokenUsable` (Task 4), `toKisApiError`, `kisErrorResponseBody` (Task 2), `TokenRecord` 타입.
- Produces: `GET /api/kis/token` → `{ status: "none" } | { status: "issued", expiresAt: string, remainingMs: number }`. `POST /api/kis/token` → 동일 shape 또는 에러. Task 9(token 페이지)가 이 응답 shape를 그대로 소비한다.

- [ ] **Step 1: 기존 파일을 교체할 새 구현 작성**

`src/app/api/kis/token/route.ts` (전체 내용을 아래로 교체):
```ts
import { NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/kis/auth";
import { readToken, isTokenUsable, type TokenRecord } from "@/lib/kis/tokenStore";
import { toKisApiError, kisErrorResponseBody } from "@/lib/kis/errors";

type TokenStatusResponse =
  | { status: "none" }
  | { status: "issued"; expiresAt: string; remainingMs: number };

function tokenStatusResponse(token: TokenRecord | null): TokenStatusResponse {
  if (!token) return { status: "none" };
  return {
    status: "issued",
    expiresAt: new Date(token.expiresAt).toISOString(),
    remainingMs: Math.max(0, token.expiresAt - Date.now()),
  };
}

export async function GET() {
  const cached = readToken();
  return NextResponse.json(tokenStatusResponse(isTokenUsable(cached) ? cached : null));
}

export async function POST() {
  try {
    const token = await ensureAccessToken();
    return NextResponse.json(tokenStatusResponse(token));
  } catch (err) {
    const kisErr = toKisApiError(err);
    return NextResponse.json(kisErrorResponseBody(kisErr), { status: kisErr.status });
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 타입 에러 없이 성공.

- [ ] **Step 3: 수동 통합 테스트**

Run:
```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/kis/token
echo
curl -s -X POST http://localhost:3000/api/kis/token
echo
curl -s http://localhost:3000/api/kis/token
kill %1
```
Expected: 첫 GET은 `{"status":"none"}`, POST는 `{"status":"issued", "expiresAt": "...", "remainingMs": ...}` (access_token 필드 없음 확인), 두번째 GET도 같은 `issued` 상태.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kis/token/route.ts
git commit -m "refactor: back token API with SQLite, never return raw access_token"
```

---

### Task 8: 토큰 상태 대시보드 페이지 교체

**Files:**
- Modify: `src/app/token/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `GET /api/kis/token`, `POST /api/kis/token` (Task 7)의 JSON shape.

- [ ] **Step 1: 페이지 구현 작성**

`src/app/token/page.tsx` (전체 내용을 아래로 교체):
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type TokenStatus =
  | { status: "none" }
  | { status: "issued"; expiresAt: string; remainingMs: number };

type ApiError = { error: string; code: string };

function formatRemaining(ms: number): string {
  if (ms <= 0) return "만료됨";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}시간 ${minutes}분 ${seconds}초`;
}

export default function TokenPage() {
  const [state, setState] = useState<TokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kis/token");
      const data = await res.json();
      if (!res.ok) {
        setError((data as ApiError).error ?? "상태 조회에 실패했습니다.");
        return;
      }
      setState(data as TokenStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const issueToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kis/token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError((data as ApiError).error ?? "토큰 발급에 실패했습니다.");
        return;
      }
      setState(data as TokenStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs =
    state?.status === "issued" ? Math.max(0, new Date(state.expiresAt).getTime() - now) : 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">토큰 상태</h1>
      <p className="mt-1 text-sm text-slate-500">
        한국투자증권 Open API 접근토큰 상태를 확인합니다. 토큰 값 자체는 서버 밖으로 절대 나가지
        않습니다.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          새로고침
        </button>
        <button
          onClick={issueToken}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "처리 중..." : "발급 / 갱신"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {state && (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">상태</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                state.status === "issued"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {state.status === "issued" ? "발급됨" : "없음"}
            </span>
          </div>
          {state.status === "issued" && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>만료: {new Date(state.expiresAt).toLocaleString("ko-KR")}</span>
              <span>남은 시간: {formatRemaining(remainingMs)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 브라우저 수동 확인**

Run: `npm run dev`, 브라우저로 `http://localhost:3000/token` 접속.
Expected: 처음엔 "없음" 배지 → "발급 / 갱신" 클릭 → "발급됨" 배지 + 만료 시각 + 매초 줄어드는 남은 시간 표시. 화면 어디에도 토큰 문자열이 보이지 않는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/token/page.tsx
git commit -m "feat: replace manual token test page with a status dashboard"
```

---

### Task 9: WebSocket 접속키 발급 라우트

**Files:**
- Create: `src/app/api/kis/ws-key/route.ts`

**Interfaces:**
- Consumes: `ensureWsApprovalKey` (Task 6), `toKisApiError`, `kisErrorResponseBody` (Task 2).
- Produces: `POST /api/kis/ws-key` → `{ status: "ok" }` 또는 에러. Task 18(realtime client)은 이 라우트를 거치지 않고 `ensureWsApprovalKey`를 직접 호출하므로, 이 라우트는 수동 점검/디버깅 용도다.

- [ ] **Step 1: 구현 작성**

`src/app/api/kis/ws-key/route.ts`:
```ts
import { NextResponse } from "next/server";
import { ensureWsApprovalKey } from "@/lib/kis/auth";
import { toKisApiError, kisErrorResponseBody } from "@/lib/kis/errors";

export async function POST() {
  try {
    await ensureWsApprovalKey();
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const kisErr = toKisApiError(err);
    return NextResponse.json(kisErrorResponseBody(kisErr), { status: kisErr.status });
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 통합 테스트**

Run:
```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/kis/ws-key
kill %1
```
Expected: `{"status":"ok"}` (approval_key 원문이 응답에 없는지 확인).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kis/ws-key/route.ts
git commit -m "feat: add WebSocket approval key issuance route"
```

---

### Task 10: 시세조회 클라이언트 (`quote.ts`)

**Files:**
- Create: `src/lib/kis/quote.ts`

**Interfaces:**
- Consumes: `getKisEnv` (Task 3), `ensureAccessToken` (Task 6), `kisError`, `toKisApiError` (Task 2).
- Produces: `type StockQuote = { code: string; name: string; price: number; changeRate: number; volume: number }`, `fetchStockQuote(code: string): Promise<StockQuote>`. Task 11(stocks/[code] route)이 이 함수를 쓴다.

이 모듈은 실제 KIS 서버가 있어야 검증 가능해 자동 테스트를 만들지 않는다(스펙의 "테스트 전략" 참고). 대신 Step 3에서 실제 서버로 수동 검증한다.

- [ ] **Step 1: 구현 작성**

`src/lib/kis/quote.ts`:
```ts
import { getKisEnv } from "./env";
import { ensureAccessToken } from "./auth";
import { kisError, toKisApiError } from "./errors";

export type StockQuote = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
};

// TR_ID FHKST01010100 (주식현재가 시세조회), 경로는 KIS 공식 문서 기준.
// 문서: https://apiportal.koreainvestment.com (국내주식시세 > 주식현재가 시세)
// 구현 시점에 최신 문서로 한 번 더 대조할 것 (경로/TR_ID가 바뀌었을 수 있음).
export async function fetchStockQuote(code: string): Promise<StockQuote> {
  try {
    const env = getKisEnv();
    const token = await ensureAccessToken();

    const url = new URL("/uapi/domestic-stock/v1/quotations/inquire-price", env.baseUrl);
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", code);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token.accessToken}`,
        appkey: env.appKey,
        appsecret: env.appSecret,
        tr_id: "FHKST01010100",
      },
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || data.rt_cd !== "0") {
      throw kisError(
        "STOCK_NOT_FOUND",
        `종목 ${code}를 찾을 수 없거나 조회에 실패했습니다: ${data.msg1 ?? res.status}`
      );
    }

    // 필드 이름은 공식 문서 기준. 값의 실제 형식(자리채움 등)은 실행 시 실제 응답으로
    // 재확인할 것 — Part.2 위키가 겪은 "pdno 자리채움" 같은 함정을 방지하기 위함.
    const output = data.output ?? {};

    return {
      code,
      name: String(output.hts_kor_isnm ?? ""),
      price: Number(output.stck_prpr ?? 0),
      changeRate: Number(output.prdy_ctrt ?? 0),
      volume: Number(output.acml_vol ?? 0),
    };
  } catch (err) {
    throw toKisApiError(err);
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: Commit**

```bash
git add src/lib/kis/quote.ts
git commit -m "feat: add KIS stock quote REST client"
```

(실제 서버 대상 수동 검증은 Task 11에서 라우트를 통해 함께 확인한다.)

---

### Task 11: 종목 상세조회 API 라우트

**Files:**
- Create: `src/app/api/kis/stocks/[code]/route.ts`

**Interfaces:**
- Consumes: `fetchStockQuote` (Task 10), `toKisApiError`, `kisErrorResponseBody` (Task 2).
- Produces: `GET /api/kis/stocks/:code` → `StockQuote` JSON 또는 에러. Task 20(quote 페이지)이 이 응답을 소비한다.

- [ ] **Step 1: 구현 작성**

`src/app/api/kis/stocks/[code]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { fetchStockQuote } from "@/lib/kis/quote";
import { toKisApiError, kisErrorResponseBody } from "@/lib/kis/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const quote = await fetchStockQuote(code);
    return NextResponse.json(quote);
  } catch (err) {
    const kisErr = toKisApiError(err);
    return NextResponse.json(kisErrorResponseBody(kisErr), { status: kisErr.status });
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 통합 테스트 (실제 KIS 서버 필요, 토큰 먼저 발급)**

Run:
```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/kis/token > /dev/null
curl -s http://localhost:3000/api/kis/stocks/005930
echo
curl -s http://localhost:3000/api/kis/stocks/000000
kill %1
```
Expected: `005930`은 삼성전자 현재가 정보 JSON, `000000`은 `STOCK_NOT_FOUND` 코드의 에러 응답. 응답 필드 이름/형식이 기대와 다르면 `quote.ts`의 `output.*` 매핑을 실제 응답에 맞게 수정한다(문서 이름 vs 실제 값 형식 차이 — 위키 교훈 1).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kis/stocks/[code]/route.ts
git commit -m "feat: add stock detail quote API route"
```

---

### Task 12: 종목마스터 파일 파서 (`masterFile.ts`)

**Files:**
- Create: `src/lib/kis/masterFile.ts`
- Test: `src/lib/kis/masterFile.test.ts`

**Interfaces:**
- Produces: `type StockMasterEntry = { code: string; standardCode: string; name: string; market: "KOSPI" | "KOSDAQ" }`, `parseZipSingleEntry(zip: Buffer): Buffer`, `decodeCp949(buffer: Buffer): string`, `parseMasterLines(text: string, market: "KOSPI" | "KOSDAQ"): StockMasterEntry[]`, `loadStockMaster(): Promise<StockMasterEntry[]>` (모듈 메모리 캐시). Task 13(search.ts), Task 14(stocks/search route)가 이 함수/타입을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/masterFile.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseZipSingleEntry, decodeCp949, parseMasterLines } from "./masterFile";

function buildZip(content: Buffer): Buffer {
  const compressed = deflateRawSync(content);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // local file header signature
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // general purpose bit flag
  header.writeUInt16LE(8, 8); // compression method: deflate
  header.writeUInt16LE(0, 10); // last mod time
  header.writeUInt16LE(0, 12); // last mod date
  header.writeUInt32LE(0, 14); // crc-32 (unused by our parser)
  header.writeUInt32LE(compressed.length, 18); // compressed size
  header.writeUInt32LE(content.length, 22); // uncompressed size
  header.writeUInt16LE(0, 26); // file name length
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, compressed]);
}

test("parseZipSingleEntry extracts and inflates a single deflate member", () => {
  const original = Buffer.from("hello kis master file", "utf-8");
  const result = parseZipSingleEntry(buildZip(original));
  assert.equal(result.toString("utf-8"), "hello kis master file");
});

test("parseZipSingleEntry handles a stored (uncompressed) member", () => {
  const original = Buffer.from("stored content", "utf-8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(0, 8); // compression method: stored
  header.writeUInt32LE(original.length, 18);
  header.writeUInt32LE(original.length, 22);
  const zip = Buffer.concat([header, original]);
  assert.equal(parseZipSingleEntry(zip).toString("utf-8"), "stored content");
});

test("parseZipSingleEntry throws on a non-ZIP buffer", () => {
  assert.throws(() => parseZipSingleEntry(Buffer.from("not a zip")));
});

test("decodeCp949 decodes EUC-KR bytes into the correct Korean text", () => {
  // "삼성전자"의 EUC-KR(cp949) 바이트 (python3 -c "print(list('삼성전자'.encode('cp949')))"로 확인).
  const encoded = Buffer.from([0xbb, 0xef, 0xbc, 0xba, 0xc0, 0xfc, 0xc0, 0xda]);
  assert.equal(decodeCp949(encoded), "삼성전자");
});

function buildMasterLine(code: string, standardCode: string, name: string, tailLength: number): string {
  const paddedCode = code.padEnd(9, " ");
  const paddedStandard = standardCode.padEnd(12, " ").slice(0, 12);
  return paddedCode + paddedStandard + name + "9".repeat(tailLength);
}

test("parseMasterLines splits KOSPI lines using a 228-char tail", () => {
  const line = buildMasterLine("005930", "KR7005930003", "삼성전자", 228);
  const [entry] = parseMasterLines(line, "KOSPI");
  assert.deepEqual(entry, {
    code: "005930",
    standardCode: "KR7005930003",
    name: "삼성전자",
    market: "KOSPI",
  });
});

test("parseMasterLines splits KOSDAQ lines using a 222-char tail (different from KOSPI)", () => {
  const line = buildMasterLine("086520", "KR7086520004", "에코프로", 222);
  const [entry] = parseMasterLines(line, "KOSDAQ");
  assert.equal(entry.name, "에코프로");
  assert.equal(entry.market, "KOSDAQ");
});

test("parseMasterLines excludes codes that are not 6 digits (funds/trusts)", () => {
  const line = buildMasterLine("A00123", "KR7000000000", "펀드", 228);
  assert.deepEqual(parseMasterLines(line, "KOSPI"), []);
});

test("parseMasterLines skips lines shorter than the expected tail length", () => {
  assert.deepEqual(parseMasterLines("too short", "KOSPI"), []);
});

test("parseMasterLines parses multiple lines and skips blank ones", () => {
  const line1 = buildMasterLine("005930", "KR7005930003", "삼성전자", 228);
  const line2 = buildMasterLine("005935", "KR7005935008", "삼성전자우", 228);
  const text = [line1, "", line2].join("\n");
  const entries = parseMasterLines(text, "KOSPI");
  assert.deepEqual(
    entries.map((e) => e.code),
    ["005930", "005935"]
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/masterFile.test.ts`
Expected: FAIL — `./masterFile` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/masterFile.ts`:
```ts
import { inflateRawSync } from "node:zlib";

export type StockMasterEntry = {
  code: string;
  standardCode: string;
  name: string;
  market: "KOSPI" | "KOSDAQ";
};

type Market = "KOSPI" | "KOSDAQ";

// 실제 배포 URL은 KIS 공식 문서(종목마스터파일 다운로드 안내)로 실행 시 한 번 더 대조할 것.
const MASTER_URLS: Record<Market, string> = {
  KOSPI: "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
  KOSDAQ: "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
};

// KOSPI와 KOSDAQ의 꼬리(고정폭 필드) 길이가 다르다 — 같다고 가정하면 종목명이 잘린다.
const TAIL_LENGTH: Record<Market, number> = {
  KOSPI: 228,
  KOSDAQ: 222,
};

const SHORT_CODE_LEN = 9;
const STANDARD_CODE_LEN = 12;

export function parseZipSingleEntry(zip: Buffer): Buffer {
  if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("ZIP 로컬 파일 헤더 시그니처를 찾을 수 없습니다.");
  }

  const compressionMethod = zip.readUInt16LE(8);
  const compressedSize = zip.readUInt32LE(18);
  const nameLength = zip.readUInt16LE(26);
  const extraLength = zip.readUInt16LE(28);

  if (compressionMethod === 8 && compressedSize === 0) {
    throw new Error(
      "압축 크기 정보가 로컬 헤더에 없습니다 (data descriptor 방식의 ZIP은 지원하지 않습니다)."
    );
  }

  const dataStart = 30 + nameLength + extraLength;
  const compressed = zip.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return Buffer.from(compressed);
  }
  if (compressionMethod === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(`지원하지 않는 압축 방식입니다: ${compressionMethod}`);
}

export function decodeCp949(buffer: Buffer): string {
  return new TextDecoder("euc-kr").decode(buffer);
}

export function parseMasterLines(text: string, market: Market): StockMasterEntry[] {
  const tailLength = TAIL_LENGTH[market];
  const entries: StockMasterEntry[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.length <= tailLength) continue;

    const head = rawLine.slice(0, rawLine.length - tailLength);
    if (head.length < SHORT_CODE_LEN + STANDARD_CODE_LEN) continue;

    const code = head.slice(0, SHORT_CODE_LEN).trim();
    const standardCode = head.slice(SHORT_CODE_LEN, SHORT_CODE_LEN + STANDARD_CODE_LEN).trim();
    const name = head.slice(SHORT_CODE_LEN + STANDARD_CODE_LEN).trim();

    if (!/^\d{6}$/.test(code)) continue;

    entries.push({ code, standardCode, name, market });
  }

  return entries;
}

let cachedMaster: StockMasterEntry[] | null = null;

export async function loadStockMaster(): Promise<StockMasterEntry[]> {
  if (cachedMaster) return cachedMaster;

  const markets: Market[] = ["KOSPI", "KOSDAQ"];
  const results = await Promise.all(
    markets.map(async (market) => {
      const res = await fetch(MASTER_URLS[market]);
      const zipBuffer = Buffer.from(await res.arrayBuffer());
      const raw = parseZipSingleEntry(zipBuffer);
      const text = decodeCp949(raw);
      return parseMasterLines(text, market);
    })
  );

  cachedMaster = results.flat();
  return cachedMaster;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/masterFile.test.ts`
Expected: 9개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/masterFile.ts src/lib/kis/masterFile.test.ts
git commit -m "feat: add KOSPI/KOSDAQ master file zip/cp949 parser (no new deps)"
```

---

### Task 13: 종목 검색 (`search.ts`)

**Files:**
- Create: `src/lib/kis/search.ts`
- Test: `src/lib/kis/search.test.ts`

**Interfaces:**
- Consumes: `StockMasterEntry` type (Task 12).
- Produces: `searchStockMaster(entries: StockMasterEntry[], query: string, limit?: number): StockMasterEntry[]`. Task 14(stocks/search route)가 이 함수를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/search.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchStockMaster } from "./search";
import type { StockMasterEntry } from "./masterFile";

const fixture: StockMasterEntry[] = [
  { code: "005930", standardCode: "KR7005930003", name: "삼성전자", market: "KOSPI" },
  { code: "005935", standardCode: "KR7005935008", name: "삼성전자우", market: "KOSPI" },
  { code: "086520", standardCode: "KR7086520004", name: "에코프로", market: "KOSDAQ" },
  { code: "247540", standardCode: "KR7247540008", name: "에코프로비엠", market: "KOSDAQ" },
];

test("searchStockMaster matches by name substring", () => {
  const results = searchStockMaster(fixture, "삼성");
  assert.deepEqual(results.map((r) => r.code), ["005930", "005935"]);
});

test("searchStockMaster matches by exact code", () => {
  const results = searchStockMaster(fixture, "005930");
  assert.deepEqual(results.map((r) => r.code), ["005930"]);
});

test("searchStockMaster returns an empty array for a blank query", () => {
  assert.deepEqual(searchStockMaster(fixture, "   "), []);
});

test("searchStockMaster respects the limit", () => {
  const results = searchStockMaster(fixture, "에코", 1);
  assert.equal(results.length, 1);
});

test("searchStockMaster returns an empty array when nothing matches", () => {
  assert.deepEqual(searchStockMaster(fixture, "존재하지않는종목"), []);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/search.test.ts`
Expected: FAIL — `./search` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/search.ts`:
```ts
import type { StockMasterEntry } from "./masterFile";

export function searchStockMaster(
  entries: StockMasterEntry[],
  query: string,
  limit = 20
): StockMasterEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: StockMasterEntry[] = [];
  for (const entry of entries) {
    if (entry.code === trimmed || entry.name.includes(trimmed)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/search.test.ts`
Expected: 5개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/search.ts src/lib/kis/search.test.ts
git commit -m "feat: add stock master search by code/name"
```

---

### Task 14: 종목 검색 API 라우트

**Files:**
- Create: `src/app/api/kis/stocks/search/route.ts`

**Interfaces:**
- Consumes: `loadStockMaster` (Task 12), `searchStockMaster` (Task 13), `toKisApiError`, `kisErrorResponseBody` (Task 2).
- Produces: `GET /api/kis/stocks/search?q=` → `{ results: StockMasterEntry[] }`. Task 20(quote 페이지)이 이 응답을 소비한다.

- [ ] **Step 1: 구현 작성**

`src/app/api/kis/stocks/search/route.ts`:
```ts
import { NextResponse } from "next/server";
import { loadStockMaster } from "@/lib/kis/masterFile";
import { searchStockMaster } from "@/lib/kis/search";
import { toKisApiError, kisErrorResponseBody } from "@/lib/kis/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const master = await loadStockMaster();
    const results = searchStockMaster(master, query);
    return NextResponse.json({ results });
  } catch (err) {
    const kisErr = toKisApiError(err);
    return NextResponse.json(kisErrorResponseBody(kisErr), { status: kisErr.status });
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 통합 테스트 (네트워크로 실제 마스터 파일 다운로드)**

Run:
```bash
npm run dev &
sleep 3
curl -s "http://localhost:3000/api/kis/stocks/search?q=삼성전자"
echo
curl -s "http://localhost:3000/api/kis/stocks/search?q=005930"
kill %1
```
Expected: 두 요청 모두 삼성전자(005930)를 포함한 `results` 배열. 첫 요청은 마스터 파일을 처음 내려받아 다소 느릴 수 있고, 이후 요청은 캐시로 빠르다.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kis/stocks/search/route.ts
git commit -m "feat: add stock search API route"
```

---

### Task 15: 실시간 프레임 디코더 (`realtime/decode.ts`)

**Files:**
- Create: `src/lib/kis/realtime/decode.ts`
- Test: `src/lib/kis/realtime/decode.test.ts`

**Interfaces:**
- Produces: `type TradeTick`, `type OrderBookLevel`, `type OrderBook`, `type DecodedFrame = { type: "trade"; payload: TradeTick } | { type: "orderbook"; payload: OrderBook } | { type: "unknown"; trId: string }`, `splitEnvelope(raw: string): { trId: string; body: string } | null`, `decodeTradeFrame(body: string): TradeTick[]`, `decodeOrderBookFrame(body: string): OrderBook[]`, `decodeFrame(raw: string): DecodedFrame[]`. Task 16(hub), Task 17(client), Task 18(stream route)이 이 타입/함수를 쓴다.

**주의**: 필드 인덱스(`TRADE_FIELD_COUNT`=46, `ORDERBOOK_FIELD_COUNT`=62 및 각 필드 위치)는 공개된 KIS 실시간시세 문서 기준 통상값이다. 실제 KIS 서버로 장중 테스트할 때(Task 19) 실제 프레임과 반드시 대조하고, 다르면 이 파일의 인덱스 상수만 조정한다 — 그 신호로 아래 구현은 필드 수가 안 맞으면 조용히 넘어가지 않고 `console.warn`을 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/realtime/decode.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitEnvelope, decodeTradeFrame, decodeOrderBookFrame, decodeFrame } from "./decode";

function buildTradeBody(overrides: Record<number, string> = {}): string {
  const fields = new Array(46).fill("0");
  fields[0] = "005930";
  fields[1] = "091530";
  fields[2] = "70200";
  fields[5] = "1.23";
  fields[12] = "0";
  fields[13] = "1000000";
  for (const [index, value] of Object.entries(overrides)) {
    fields[Number(index)] = value;
  }
  return fields.join("^");
}

function buildOrderBookBody(): string {
  const fields = new Array(62).fill("0");
  fields[0] = "005930";
  fields[1] = "091530";
  for (let i = 0; i < 10; i++) {
    fields[3 + i] = String(70000 + i);
    fields[13 + i] = String(69000 - i);
    fields[23 + i] = String(100 + i);
    fields[33 + i] = String(200 + i);
  }
  return fields.join("^");
}

test("splitEnvelope parses the pipe-delimited envelope", () => {
  const result = splitEnvelope("0|H0STCNT0|001|" + buildTradeBody());
  assert.equal(result?.trId, "H0STCNT0");
});

test("splitEnvelope returns null for a malformed envelope", () => {
  assert.equal(splitEnvelope("not-an-envelope"), null);
});

test("decodeTradeFrame extracts price, change rate, and code", () => {
  const [tick] = decodeTradeFrame(buildTradeBody());
  assert.equal(tick.code, "005930");
  assert.equal(tick.price, 70200);
  assert.equal(tick.changeRate, 1.23);
});

test("decodeTradeFrame does not discard a tick with zero trade volume", () => {
  const [tick] = decodeTradeFrame(buildTradeBody({ 12: "0" }));
  assert.equal(tick.volume, 0);
  assert.equal(tick.code, "005930");
});

test("decodeOrderBookFrame extracts all 10 price levels", () => {
  const [book] = decodeOrderBookFrame(buildOrderBookBody());
  assert.equal(book.levels.length, 10);
  assert.equal(book.levels[0].askPrice, 70000);
  assert.equal(book.levels[0].bidPrice, 69000);
  assert.equal(book.levels[9].askVolume, 109);
});

test("decodeFrame dispatches trade frames by TR ID", () => {
  const [decoded] = decodeFrame("0|H0STCNT0|001|" + buildTradeBody());
  assert.equal(decoded.type, "trade");
});

test("decodeFrame dispatches orderbook frames by TR ID", () => {
  const [decoded] = decodeFrame("0|H0STASP0|001|" + buildOrderBookBody());
  assert.equal(decoded.type, "orderbook");
});

test("decodeFrame reports unknown TR ids instead of throwing", () => {
  const [decoded] = decodeFrame("0|H0ZZZZZZ|001|foo^bar");
  assert.deepEqual(decoded, { type: "unknown", trId: "H0ZZZZZZ" });
});

test("decodeFrame returns an empty array for a malformed envelope instead of throwing", () => {
  assert.deepEqual(decodeFrame("garbage"), []);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/realtime/decode.test.ts`
Expected: FAIL — `./decode` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/realtime/decode.ts`:
```ts
export type TradeTick = {
  code: string;
  time: string;
  price: number;
  changeRate: number;
  volume: number;
  accumulatedVolume: number;
};

export type OrderBookLevel = {
  askPrice: number;
  askVolume: number;
  bidPrice: number;
  bidVolume: number;
};

export type OrderBook = {
  code: string;
  time: string;
  levels: OrderBookLevel[];
};

export type DecodedFrame =
  | { type: "trade"; payload: TradeTick }
  | { type: "orderbook"; payload: OrderBook }
  | { type: "unknown"; trId: string };

// KIS 실시간 프레임 봉투: <암호화유무>|<TR_ID>|<데이터건수>|<응답데이터>
export function splitEnvelope(raw: string): { trId: string; body: string } | null {
  const parts = raw.split("|");
  if (parts.length < 4) return null;
  const [, trId, , ...rest] = parts;
  return { trId, body: rest.join("|") };
}

// 통상적으로 알려진 필드 수. 실제 KIS 서버로 검증되기 전까지의 잠정값이다.
const TRADE_FIELD_COUNT = 46;
const ORDERBOOK_FIELD_COUNT = 62;

function warnIfFieldCountMismatch(trId: string, fieldCount: number, expected: number): void {
  if (fieldCount % expected !== 0) {
    console.warn(
      `[kis-realtime] ${trId} 필드 수(${fieldCount})가 예상값(${expected}의 배수)과 다릅니다. ` +
        "decode.ts의 필드 수/인덱스 상수를 최신 KIS 문서 및 실제 프레임으로 재확인하세요."
    );
  }
}

export function decodeTradeFrame(body: string): TradeTick[] {
  const fields = body.split("^");
  warnIfFieldCountMismatch("H0STCNT0", fields.length, TRADE_FIELD_COUNT);

  const ticks: TradeTick[] = [];
  for (let offset = 0; offset + TRADE_FIELD_COUNT <= fields.length; offset += TRADE_FIELD_COUNT) {
    const f = fields.slice(offset, offset + TRADE_FIELD_COUNT);
    ticks.push({
      code: f[0],
      time: f[1],
      price: Number(f[2]),
      changeRate: Number(f[5]),
      volume: Number(f[12]),
      accumulatedVolume: Number(f[13]),
    });
  }
  return ticks;
}

export function decodeOrderBookFrame(body: string): OrderBook[] {
  const fields = body.split("^");
  warnIfFieldCountMismatch("H0STASP0", fields.length, ORDERBOOK_FIELD_COUNT);

  const books: OrderBook[] = [];
  for (
    let offset = 0;
    offset + ORDERBOOK_FIELD_COUNT <= fields.length;
    offset += ORDERBOOK_FIELD_COUNT
  ) {
    const f = fields.slice(offset, offset + ORDERBOOK_FIELD_COUNT);
    const levels: OrderBookLevel[] = [];
    for (let i = 0; i < 10; i++) {
      levels.push({
        askPrice: Number(f[3 + i]),
        bidPrice: Number(f[13 + i]),
        askVolume: Number(f[23 + i]),
        bidVolume: Number(f[33 + i]),
      });
    }
    books.push({ code: f[0], time: f[1], levels });
  }
  return books;
}

export function decodeFrame(raw: string): DecodedFrame[] {
  const envelope = splitEnvelope(raw);
  if (!envelope) return [];

  if (envelope.trId === "H0STCNT0") {
    return decodeTradeFrame(envelope.body).map((payload) => ({ type: "trade" as const, payload }));
  }
  if (envelope.trId === "H0STASP0") {
    return decodeOrderBookFrame(envelope.body).map((payload) => ({
      type: "orderbook" as const,
      payload,
    }));
  }
  return [{ type: "unknown", trId: envelope.trId }];
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/realtime/decode.test.ts`
Expected: 9개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/realtime/decode.ts src/lib/kis/realtime/decode.test.ts
git commit -m "feat: add KIS realtime frame decoder for H0STCNT0/H0STASP0"
```

---

### Task 16: 구독자 허브 (`realtime/hub.ts`)

**Files:**
- Create: `src/lib/kis/realtime/hub.ts`
- Test: `src/lib/kis/realtime/hub.test.ts`

**Interfaces:**
- Consumes: `DecodedFrame` type (Task 15).
- Produces: `subscribe(code: string, subscriber: { send: (frame: DecodedFrame) => void; sendDecodeError: (message: string) => void }): () => void`, `hasSubscribers(code: string): boolean`, `subscribedCodes(): string[]`, `broadcast(code: string, frame: DecodedFrame): void`, `broadcastDecodeError(code: string, message: string): void`. Task 17(client), Task 18(stream route)이 이 함수들을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/kis/realtime/hub.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  subscribe,
  hasSubscribers,
  subscribedCodes,
  broadcast,
  broadcastDecodeError,
} from "./hub";
import type { DecodedFrame } from "./decode";

test("subscribe registers a subscriber and broadcast reaches it", () => {
  const received: DecodedFrame[] = [];
  const unsubscribe = subscribe("005930", {
    send: (frame) => received.push(frame),
    sendDecodeError: () => {},
  });

  broadcast("005930", { type: "unknown", trId: "TEST" });
  assert.equal(received.length, 1);

  unsubscribe();
});

test("unsubscribe removes the code from subscribedCodes once its subscriber count hits zero", () => {
  const unsubscribe = subscribe("999999", { send: () => {}, sendDecodeError: () => {} });
  assert.equal(hasSubscribers("999999"), true);
  assert.ok(subscribedCodes().includes("999999"));

  unsubscribe();
  assert.equal(hasSubscribers("999999"), false);
  assert.ok(!subscribedCodes().includes("999999"));
});

test("broadcast only reaches subscribers of the matching code", () => {
  const received: DecodedFrame[] = [];
  const unsubscribeA = subscribe("111111", { send: (f) => received.push(f), sendDecodeError: () => {} });
  const unsubscribeB = subscribe("222222", { send: (f) => received.push(f), sendDecodeError: () => {} });

  broadcast("111111", { type: "unknown", trId: "ONLY_111111" });
  assert.equal(received.length, 1);

  unsubscribeA();
  unsubscribeB();
});

test("broadcastDecodeError reaches only subscribers of that code", () => {
  const messages: string[] = [];
  const unsubscribe = subscribe("333333", {
    send: () => {},
    sendDecodeError: (m) => messages.push(m),
  });

  broadcastDecodeError("444444", "다른 종목 오류");
  assert.equal(messages.length, 0);

  broadcastDecodeError("333333", "이 종목 오류");
  assert.deepEqual(messages, ["이 종목 오류"]);

  unsubscribe();
});

test("a code with two subscribers keeps hasSubscribers true until both unsubscribe", () => {
  const unsubscribe1 = subscribe("555555", { send: () => {}, sendDecodeError: () => {} });
  const unsubscribe2 = subscribe("555555", { send: () => {}, sendDecodeError: () => {} });

  unsubscribe1();
  assert.equal(hasSubscribers("555555"), true);

  unsubscribe2();
  assert.equal(hasSubscribers("555555"), false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/realtime/hub.test.ts`
Expected: FAIL — `./hub` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/realtime/hub.ts`:
```ts
import type { DecodedFrame } from "./decode";

type Subscriber = {
  send: (frame: DecodedFrame) => void;
  sendDecodeError: (message: string) => void;
};

const subscribersByCode = new Map<string, Set<Subscriber>>();

export function subscribe(code: string, subscriber: Subscriber): () => void {
  let set = subscribersByCode.get(code);
  if (!set) {
    set = new Set();
    subscribersByCode.set(code, set);
  }
  set.add(subscriber);

  return () => {
    const current = subscribersByCode.get(code);
    current?.delete(subscriber);
    if (current && current.size === 0) {
      subscribersByCode.delete(code);
    }
  };
}

export function hasSubscribers(code: string): boolean {
  return (subscribersByCode.get(code)?.size ?? 0) > 0;
}

export function subscribedCodes(): string[] {
  return [...subscribersByCode.keys()];
}

export function broadcast(code: string, frame: DecodedFrame): void {
  const set = subscribersByCode.get(code);
  if (!set) return;
  for (const subscriber of set) {
    subscriber.send(frame);
  }
}

export function broadcastDecodeError(code: string, message: string): void {
  const set = subscribersByCode.get(code);
  if (!set) return;
  for (const subscriber of set) {
    subscriber.sendDecodeError(message);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/realtime/hub.test.ts`
Expected: 5개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/realtime/hub.ts src/lib/kis/realtime/hub.test.ts
git commit -m "feat: add per-code subscriber hub for realtime broadcast"
```

---

### Task 17: KIS 실시간 WebSocket 싱글턴 클라이언트 (`realtime/client.ts`)

**Files:**
- Create: `src/lib/kis/realtime/client.ts`
- Test: `src/lib/kis/realtime/client.test.ts`

**Interfaces:**
- Consumes: `ensureWsApprovalKey` (Task 6), `decodeFrame`, `DecodedFrame` (Task 15), `subscribedCodes`, `broadcast`, `broadcastDecodeError` (Task 16).
- Produces: `subscribeCode(code: string): Promise<void>`, `unsubscribeCode(code: string): Promise<void>`, `parseControlMessage(raw: string): { code: string; message: string } | null` (테스트 가능하도록 분리된 순수 함수). Task 18(stream route)이 `subscribeCode`/`unsubscribeCode`를 쓴다.

이 모듈의 연결/재연결/구독 로직은 실제 KIS WebSocket 서버가 있어야 검증되므로 자동 테스트를 만들지 않는다. 순수 함수인 `parseControlMessage`만 단위 테스트한다. 나머지는 Task 19에서 장중 수동으로 검증한다.

- [ ] **Step 1: `parseControlMessage`에 대한 실패하는 테스트 작성**

`src/lib/kis/realtime/client.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseControlMessage } from "./client";

test("parseControlMessage extracts the failing code and message from a rejected subscription", () => {
  const raw = JSON.stringify({
    header: { tr_key: "005930" },
    body: { rt_cd: "1", msg1: "ALREADY IN USE appkey" },
  });
  assert.deepEqual(parseControlMessage(raw), { code: "005930", message: "ALREADY IN USE appkey" });
});

test("parseControlMessage returns null for a successful subscription ack", () => {
  const raw = JSON.stringify({
    header: { tr_key: "005930" },
    body: { rt_cd: "0", msg1: "SUBSCRIBE SUCCESS" },
  });
  assert.equal(parseControlMessage(raw), null);
});

test("parseControlMessage returns null for non-JSON pipe-delimited data frames", () => {
  assert.equal(parseControlMessage("0|H0STCNT0|001|005930^091530^70200"), null);
});

test("parseControlMessage returns null when rt_cd is present but tr_key is missing", () => {
  const raw = JSON.stringify({ header: {}, body: { rt_cd: "1", msg1: "오류" } });
  assert.equal(parseControlMessage(raw), null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx tsx --test src/lib/kis/realtime/client.test.ts`
Expected: FAIL — `./client` 모듈 없음.

- [ ] **Step 3: 구현 작성**

`src/lib/kis/realtime/client.ts`:
```ts
import { WebSocket } from "ws";
import { ensureWsApprovalKey } from "../auth";
import { decodeFrame, type DecodedFrame } from "./decode";
import { subscribedCodes, broadcast, broadcastDecodeError } from "./hub";

const DEFAULT_WS_URL = "ws://ops.koreainvestment.com:21000";

type TrId = "H0STCNT0" | "H0STASP0";
const TR_IDS: TrId[] = ["H0STCNT0", "H0STASP0"];

type ApprovedSocket = WebSocket & { approvalKey?: string };

let socket: ApprovedSocket | null = null;
let connecting: Promise<ApprovedSocket> | null = null;
const activeSubscriptions = new Set<string>(); // `${trId}:${code}`
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function wsUrl(): string {
  return process.env.KIS_WS_URL || DEFAULT_WS_URL;
}

export function parseControlMessage(raw: string): { code: string; message: string } | null {
  try {
    const json = JSON.parse(raw);
    const rtCd = json?.body?.rt_cd;
    const trKey = json?.header?.tr_key;
    if (rtCd && rtCd !== "0" && trKey) {
      return { code: trKey, message: json?.body?.msg1 ?? `구독 실패 (rt_cd=${rtCd})` };
    }
    return null;
  } catch {
    return null;
  }
}

function handleMessage(raw: string): void {
  if (raw.startsWith("0") || raw.startsWith("1")) {
    for (const frame of decodeFrame(raw)) {
      if (frame.type === "trade") broadcast(frame.payload.code, frame);
      else if (frame.type === "orderbook") broadcast(frame.payload.code, frame);
    }
    return;
  }

  const control = parseControlMessage(raw);
  if (control) {
    broadcastDecodeError(control.code, control.message);
    return;
  }

  console.warn("[kis-realtime] 인식할 수 없는 메시지:", raw.slice(0, 200));
}

async function connect(): Promise<ApprovedSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const approvalKey = await ensureWsApprovalKey();
    const ws = new WebSocket(wsUrl()) as ApprovedSocket;

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });

    ws.approvalKey = approvalKey;
    ws.on("message", (data) => handleMessage(data.toString()));
    ws.on("close", () => {
      socket = null;
      activeSubscriptions.clear();
      scheduleReconnect();
    });
    ws.on("error", (err) => {
      console.error("[kis-realtime] WebSocket 오류:", err.message);
    });

    socket = ws;
    return ws;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (subscribedCodes().length > 0) {
      resubscribeAll().catch((err) => console.error("[kis-realtime] 재연결 실패:", err));
    }
  }, 2000);
}

async function resubscribeAll(): Promise<void> {
  for (const code of subscribedCodes()) {
    for (const trId of TR_IDS) {
      await sendSubscription(trId, code, "1");
    }
  }
}

async function sendSubscription(trId: TrId, code: string, trType: "1" | "2"): Promise<void> {
  const ws = await connect();
  const message = {
    header: {
      approval_key: ws.approvalKey ?? "",
      custtype: "P",
      tr_type: trType,
      "content-type": "utf-8",
    },
    body: { input: { tr_id: trId, tr_key: code } },
  };
  ws.send(JSON.stringify(message));
}

export async function subscribeCode(code: string): Promise<void> {
  for (const trId of TR_IDS) {
    const key = `${trId}:${code}`;
    if (activeSubscriptions.has(key)) continue;
    await sendSubscription(trId, code, "1");
    activeSubscriptions.add(key);
  }
}

export async function unsubscribeCode(code: string): Promise<void> {
  for (const trId of TR_IDS) {
    const key = `${trId}:${code}`;
    if (!activeSubscriptions.has(key)) continue;
    await sendSubscription(trId, code, "2");
    activeSubscriptions.delete(key);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx tsx --test src/lib/kis/realtime/client.test.ts`
Expected: 4개 테스트 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kis/realtime/client.ts src/lib/kis/realtime/client.test.ts
git commit -m "feat: add singleton KIS realtime WebSocket client with reconnect"
```

---

### Task 18: 실시간 체결·호가 SSE 스트림 라우트

**Files:**
- Create: `src/app/api/kis/stream/route.ts`

**Interfaces:**
- Consumes: `subscribeCode`, `unsubscribeCode` (Task 17), `subscribe as subscribeToHub`, `hasSubscribers` (Task 16), `DecodedFrame` (Task 15), `toKisApiError`, `kisErrorResponseBody` (Task 2).
- Produces: `GET /api/kis/stream?code=` — SSE 스트림. 이벤트: `subscribed`, `frame`, `decode-error`, `silence-warning`. Task 20(quote 페이지)이 `EventSource`로 이 라우트에 붙는다.

- [ ] **Step 1: 구현 작성**

`src/app/api/kis/stream/route.ts`:
```ts
import { subscribeCode, unsubscribeCode } from "@/lib/kis/realtime/client";
import { subscribe as subscribeToHub, hasSubscribers } from "@/lib/kis/realtime/hub";
import type { DecodedFrame } from "@/lib/kis/realtime/decode";
import { toKisApiError, kisErrorResponseBody } from "@/lib/kis/errors";

export const runtime = "nodejs";

const SILENCE_TIMEOUT_MS = 5000;

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json(
      { error: "code 쿼리 파라미터가 필요합니다.", code: "STOCK_NOT_FOUND" },
      { status: 400 }
    );
  }

  try {
    await subscribeCode(code);
  } catch (err) {
    const kisErr = toKisApiError(err);
    return Response.json(kisErrorResponseBody(kisErr), { status: kisErr.status });
  }

  let unsubscribeFromHub: (() => void) | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let receivedFrame = false;

      silenceTimer = setTimeout(() => {
        if (!receivedFrame) {
          controller.enqueue(
            encoder.encode(
              sseLine("silence-warning", {
                message:
                  "구독은 성공했지만 데이터가 오지 않습니다. 대체거래소 미상장 종목이거나 장 시간이 아닐 수 있습니다.",
              })
            )
          );
        }
      }, SILENCE_TIMEOUT_MS);

      unsubscribeFromHub = subscribeToHub(code, {
        send: (frame: DecodedFrame) => {
          receivedFrame = true;
          controller.enqueue(encoder.encode(sseLine("frame", frame)));
        },
        sendDecodeError: (message: string) => {
          controller.enqueue(encoder.encode(sseLine("decode-error", { message })));
        },
      });

      controller.enqueue(encoder.encode(sseLine("subscribed", { code })));
    },
    async cancel() {
      console.log(`[kis-stream] client disconnected: ${code}`);
      if (silenceTimer) clearTimeout(silenceTimer);
      unsubscribeFromHub?.();
      if (!hasSubscribers(code)) {
        await unsubscribeCode(code);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 수동 통합 테스트 (장중 09:00-15:30에만 데이터 확인 가능, 그 외 시간엔 subscribed/silence-warning만 확인)**

Run:
```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/kis/token > /dev/null
timeout 8 curl -N "http://localhost:3000/api/kis/stream?code=005930"
kill %1
```
Expected: 최소 `event: subscribed` 라인이 오고, 장중이면 `event: frame` 라인들이 이어짐, 장 마감 시간이면 5초 뒤 `event: silence-warning`이 옴. `ws-key` 발급이 실패하면(권한 없음 등) HTTP 에러 JSON이 온다 — 그 경우 KIS OpenAPI 포털에서 해당 앱키에 실시간 시세 권한이 활성화되어 있는지 확인이 필요하다.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kis/stream/route.ts
git commit -m "feat: add SSE realtime trade/orderbook stream route"
```

---

### Task 19: 종목 조회 페이지 (`/quote`)

**Files:**
- Create: `src/app/quote/page.tsx`

**Interfaces:**
- Consumes: `GET /api/kis/stocks/search` (Task 14), `GET /api/kis/stocks/:code` (Task 11), `GET /api/kis/stream?code=` SSE (Task 18).

- [ ] **Step 1: 구현 작성**

`src/app/quote/page.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type SearchResult = { code: string; name: string; market: "KOSPI" | "KOSDAQ" };
type StockQuote = { code: string; name: string; price: number; changeRate: number; volume: number };
type TradeTick = {
  code: string;
  time: string;
  price: number;
  changeRate: number;
  volume: number;
  accumulatedVolume: number;
};
type OrderBookLevel = { askPrice: number; askVolume: number; bidPrice: number; bidVolume: number };
type OrderBook = { code: string; time: string; levels: OrderBookLevel[] };
type ApiError = { error: string; code: string };
type Frame =
  | { type: "trade"; payload: TradeTick }
  | { type: "orderbook"; payload: OrderBook }
  | { type: "unknown"; trId: string };

export default function QuotePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [trade, setTrade] = useState<TradeTick | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "subscribed" | "silent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kis/stocks/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (res.ok) setResults(data.results as SearchResult[]);
      } catch {
        // 검색 실패는 조용히 무시 - 사용자가 다시 타이핑하면 재시도된다
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => {
    if (!selected) return;

    eventSourceRef.current?.close();
    setQuote(null);
    setTrade(null);
    setOrderBook(null);
    setError(null);
    setStreamStatus("idle");

    (async () => {
      try {
        const res = await fetch(`/api/kis/stocks/${selected.code}`);
        const data = await res.json();
        if (!res.ok) {
          setError((data as ApiError).error);
          return;
        }
        setQuote(data as StockQuote);
      } catch (e) {
        setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
      }
    })();

    const es = new EventSource(`/api/kis/stream?code=${selected.code}`);
    eventSourceRef.current = es;

    es.addEventListener("subscribed", () => setStreamStatus("subscribed"));
    es.addEventListener("silence-warning", () => setStreamStatus("silent"));
    es.addEventListener("decode-error", (event) => {
      setStreamStatus("error");
      const data = JSON.parse((event as MessageEvent).data) as { message: string };
      setError(data.message);
    });
    es.addEventListener("frame", (event) => {
      const frame = JSON.parse((event as MessageEvent).data) as Frame;
      if (frame.type === "trade") setTrade(frame.payload);
      if (frame.type === "orderbook") setOrderBook(frame.payload);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [selected]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">종목 조회</h1>
      <p className="mt-1 text-sm text-slate-500">
        종목을 검색해서 실시간 체결가와 호가를 확인합니다. 주문 기능은 없습니다.
      </p>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selected) setSelected(null);
        }}
        placeholder="종목명 또는 종목코드 (예: 삼성전자, 005930)"
        className="mt-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />

      {results.length > 0 && !selected && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {results.map((r) => (
            <li key={r.code}>
              <button
                onClick={() => {
                  setSelected(r);
                  setQuery(r.name);
                  setResults([]);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>{r.name}</span>
                <span className="text-xs text-slate-400">
                  {r.code} · {r.market}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selected && quote && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{quote.name}</h2>
            <span className="text-xs text-slate-400">{quote.code}</span>
          </div>
          <div className="mt-2 flex gap-6 text-sm">
            <span>현재가 {quote.price.toLocaleString("ko-KR")}</span>
            <span>등락률 {quote.changeRate}%</span>
            <span>거래량 {quote.volume.toLocaleString("ko-KR")}</span>
          </div>

          <div className="mt-3 text-xs">
            {streamStatus === "idle" && <span className="text-slate-400">실시간 연결 중...</span>}
            {streamStatus === "subscribed" && !trade && (
              <span className="text-slate-400">실시간 시세 대기 중</span>
            )}
            {streamStatus === "silent" && (
              <span className="text-amber-600">
                이 종목은 데이터가 오지 않을 수 있습니다(대체거래소 미상장 종목이거나 장 시간이 아님).
              </span>
            )}
          </div>

          {trade && (
            <div className="mt-3 text-sm">
              실시간 체결가: {trade.price.toLocaleString("ko-KR")} ({trade.time})
            </div>
          )}

          {orderBook && (
            <table className="mt-4 w-full table-fixed text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-1 text-left">매수잔량</th>
                  <th className="py-1 text-center">매수호가</th>
                  <th className="py-1 text-center">매도호가</th>
                  <th className="py-1 text-right">매도잔량</th>
                </tr>
              </thead>
              <tbody>
                {orderBook.levels.map((level, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 text-left text-slate-500">
                      {level.bidVolume.toLocaleString("ko-KR")}
                    </td>
                    <td className="py-1 text-center font-medium text-blue-600">
                      {level.bidPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className="py-1 text-center font-medium text-red-600">
                      {level.askPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className="py-1 text-right text-slate-500">
                      {level.askVolume.toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: Commit**

```bash
git add src/app/quote/page.tsx
git commit -m "feat: add stock search + realtime trade/orderbook page"
```

---

### Task 20: 사이드바에 종목 조회 메뉴 추가 + 전체 수동 확인

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음 (nav 배열만 수정).

- [ ] **Step 1: nav 항목 추가**

`src/components/Sidebar.tsx`의 `nav` 배열을 아래로 교체:
```ts
const nav = [
  { href: "/", label: "홈" },
  { href: "/token", label: "토큰 상태" },
  { href: "/quote", label: "종목 조회" },
];
```

- [ ] **Step 2: 홈 페이지 링크 문구 갱신**

`src/app/page.tsx`에서 "토큰 발급 기능이 준비되어 있습니다" 문구와 링크를 상황에 맞게 갱신한다 (현재 파일을 열어 `<p>`와 `<Link>` 텍스트를 "토큰 상태 확인과 종목 조회 기능이 준비되어 있습니다"/"시작하기 →"로 바꾸고 `href="/token"`은 유지).

- [ ] **Step 3: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: Task 2~17에서 작성한 모든 테스트(약 40여개)가 PASS.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 5: 브라우저로 전체 플로우 수동 확인**

Run: `npm run dev`, 브라우저로 아래 순서를 확인:
1. `/` → "종목 조회" 등 새 문구 확인, 사이드바에 "토큰 상태"/"종목 조회" 두 메뉴가 보이는지 확인.
2. `/token` → 발급/갱신 클릭 후 상태 대시보드 정상 동작 확인 (Task 8에서 이미 확인했다면 재확인만).
3. `/quote` → "삼성전자" 검색 → 후보 클릭 → 상세정보 + (장중이면) 실시간 체결가/호가 테이블이 채워지는지 확인. 장 마감 시간이면 5초 후 "데이터가 오지 않을 수 있습니다" 안내가 뜨는지 확인.
4. 브라우저 개발자 도구 Network 탭에서 `/api/kis/token`, `/api/kis/stocks/*` 응답 어디에도 `access_token`이나 `approval_key` 원문이 없는지 확인.

- [ ] **Step 6: README 갱신**

`README.md`의 "현재 상태" 섹션 아래에 Part.2 기능 설명을 추가한다 (섹션 제목 "## 종목 조회 (Part.2)"로 새로 추가):
```markdown
## 종목 조회 (Part.2)

- `/quote` 페이지에서 종목명·코드로 검색 → 상세정보(현재가/등락률/거래량) → 실시간 체결가·10단계 호가(KRX 전용 채널)를 확인할 수 있습니다.
- 종목마스터(KOSPI/KOSDAQ) 파일은 서버가 처음 검색 요청을 받을 때 한 번 내려받아 메모리에 캐싱합니다(재시작 전까지 유지).
- 실시간 데이터는 서버가 KIS WebSocket에 연결 1개만 유지하고, 브라우저에는 Server-Sent Events(`/api/kis/stream`)로 중계합니다.
- 실시간 기능은 장중(09:00–15:30)에만 실제 데이터로 확인할 수 있습니다. 그 외 시간에는 "데이터 대기" 안내만 뜨는 것이 정상입니다.
- KIS 앱키에 실시간 시세 이용 권한이 없으면 `/api/kis/stream` 호출 시 에러가 반환됩니다 — KIS OpenAPI 포털에서 해당 앱키의 실시간 시세 권한을 확인하세요.
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx src/app/page.tsx README.md
git commit -m "feat: wire up quote page navigation and document Part.2 in README"
```

---

## Self-Review Notes (실행 전 참고)

- **필드 인덱스 불확실성**: Task 15(`decode.ts`)의 `TRADE_FIELD_COUNT`/`ORDERBOOK_FIELD_COUNT`와 각 필드 위치는 공개적으로 널리 알려진 KIS 실시간시세 스펙을 따랐지만, 최신 공식 문서로 확정된 값은 아니다. Task 19에서 장중에 실제 프레임을 콘솔로 한 번 찍어보고 `console.warn`이 뜨는지, 가격/호가 값이 상식적인 범위인지로 최종 검증한다. 다르면 `decode.ts`의 상수만 고치면 되도록 다른 모든 코드는 이 모듈을 통해서만 프레임을 읽는다.
- **종목마스터 URL 불확실성**: Task 12의 `MASTER_URLS.KOSDAQ`는 KOSPI URL과 같은 명명 규칙을 따른 것으로, 위키가 명시한 것은 KOSPI URL뿐이다. Task 14 수동 테스트에서 404가 나면 KIS 공식 문서에서 KOSDAQ 마스터 파일 URL을 직접 확인해 상수만 교체한다.
- **WebSocket 접속 주소**: `KIS_WS_URL` 기본값(`ws://ops.koreainvestment.com:21000`)은 실전투자 주소다. 모의투자 계좌로 데이터가 안 오면 `.env`의 `KIS_WS_URL`을 `:31000`으로 바꿔 재시도한다(Task 1에서 이미 `.env.example`에 안내를 넣어뒀다).
