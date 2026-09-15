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

## 현재 상태 / 알려진 이슈

이번 점검에서 확인된 내용입니다.

1. **의존성 미설치**: `node_modules`와 lockfile(`package-lock.json`)이 없어 `npm install` 없이는 `npm run dev`/`npm run build`가 즉시 실패합니다. 이번 점검 중 `npm install`을 실행해 정상 설치 및 빌드/토큰 발급까지 확인했습니다. lockfile을 생성해 커밋하는 것을 권장합니다.
2. **첫 커밋이 아직 없음**: 저장소에 커밋 이력이 전혀 없고, 현재 스테이징된 파일들이 첫 커밋 후보로 올라가 있는 상태입니다.
3. **`_to_delete/` 폴더가 git에 스테이징됨**: 이름상 삭제 예정 폴더인 `_to_delete/`(빈 git lock 파일들, 소스 백업 tar.gz)가 `git add`로 이미 인덱스에 올라가 있습니다. 이후 `.gitignore`에 `/_to_delete/` 규칙이 추가됐지만, 이미 스테이징된 파일은 자동으로 빠지지 않습니다. 커밋 전에 `git rm -r --cached _to_delete`로 인덱스에서 제외하고, 폴더 자체도 정리하는 것이 좋습니다.
4. **`.gitignore` / `.env.example`이 스테이징 이후 수정됨**: 두 파일 모두 "Changes not staged for commit" 상태로 남아 있어, 첫 커밋 전에 `git add`로 최신 내용을 다시 반영해야 합니다.
5. **`.env`의 `KIS_BASE_URL` 값에 앞 공백**: `KIS_BASE_URL= https://...`처럼 `=` 뒤에 공백이 포함되어 있습니다. 브라우저/Node의 URL 파서가 앞뒤 공백을 무시해 이번 테스트에서는 정상 동작했지만, 의도한 값이 아니므로 공백 없이 `KIS_BASE_URL=https://...` 형태로 정리하는 것을 권장합니다.
6. **핵심 기능은 정상 동작 확인**: 위 문제들을 제외하면 `npm run build`가 성공하고, 개발 서버에서 `/api/kis/token` 호출 시 모의투자(KIS VTS) 서버로부터 실제 접근토큰을 정상 발급받는 것을 확인했습니다.
