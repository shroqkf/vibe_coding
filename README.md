# KIS 대시보드

한국투자증권(KIS) Open API를 연동하기 위한 Next.js 기반 대시보드입니다. 현재는 OAuth2 접근토큰(access token) 발급 기능이 구현되어 있으며, 이후 시세 조회·주문 등 다른 API 기능을 추가해 나가는 것을 목표로 합니다.

## 기술 스택

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Tailwind CSS 3
- Next.js Route Handler를 이용한 서버 사이드 API 프록시

## 폴더 구조

```
src/
  app/
    api/kis/token/route.ts   # KIS OAuth2 접근토큰 발급 API (서버 전용)
    token/page.tsx           # 토큰 발급 UI
    page.tsx                 # 홈 화면
    layout.tsx               # 공통 레이아웃 (Sidebar + Header)
  components/
    Sidebar.tsx               # 좌측 내비게이션
    Header.tsx                 # 상단 헤더
```

## 동작 방식

- APP Key / Secret은 `.env`에만 저장되며 서버(Route Handler)에서만 사용됩니다. 브라우저로는 절대 전송되지 않습니다.
- `/api/kis/token`에 POST 요청을 보내면 서버가 KIS OAuth2 서버(`/oauth2/tokenP`)에 토큰 발급을 요청합니다.
- KIS는 토큰 재발급 횟수에 제한이 있어, 발급받은 토큰은 만료 60초 전까지 서버 프로세스 메모리에 캐싱되어 재사용됩니다. (서버 재시작 시 캐시 초기화)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 참고해 저장소 루트에 `.env` 파일을 만들고 KIS Open API 인증 정보를 입력합니다.

```env
KIS_APP_KEY=발급받은_APP_KEY
KIS_APP_SECRET=발급받은_APP_SECRET

# 선택: 지정하지 않으면 실전투자 도메인이 기본값
# 실전투자: https://openapi.koreainvestment.com:9443
# 모의투자: https://openapivts.koreainvestment.com:29443
KIS_BASE_URL=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`에서 확인할 수 있으며, 사이드바의 "토큰 발급" 메뉴에서 접근토큰 발급을 테스트할 수 있습니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm run start
```

## 현재 상태

- `npm install` → `npm run build` → 개발 서버에서 `/api/kis/token` 호출까지 확인했으며, 모의투자(KIS VTS) 서버로부터 실제 접근토큰이 정상 발급됩니다.
- 첫 커밋 완료. 저장소에는 소스 코드와 `package-lock.json`, 이 README만 포함되어 있고, 불필요했던 `_to_delete/` 백업 폴더(빈 git lock 파일, 소스 tar.gz)는 제거했습니다.
- `.env`는 git에 커밋되지 않으며, `.env.example`을 기준으로 각자 로컬에 값을 채워 사용합니다.
