# iM Agent — Frontend

React + TypeScript + Vite 기반 SPA입니다. 저장소 루트의 **[README.md](../README.md)** 에서 전체 프로젝트 설명·iM BRIDGE 파이프라인을 확인할 수 있습니다.

**백엔드 연동 참고:** 신규 창구 시연 화면은 FastAPI `POST /api/bridge/consulting-package` 등 ([agentserver/README.md](../agentserver/README.md))과 연결하면 `feature_mart_summary`, `router_result`, `specialist_result`를 한 번에 받을 수 있습니다. 기존 화면은 `POST /api/analyze`(LangGraph)를 사용할 수 있습니다.

## 이 폴더에서만 작업할 때

```bash
cp .env.example .env.local   # Windows: copy .env.example .env.local
# .env.local 에 VITE_UPSTAGE_API_KEY= 를 입력

npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
npm run preview  # 빌드 결과 미리보기
```

## 경로 별칭

`@/` → `src/` (`vite.config.ts` · `tsconfig.app.json`)

## Upstage 프록시

`npm run dev` 실행 시 `/api/upstage` 요청이 `api.upstage.ai`로 프록시됩니다.
