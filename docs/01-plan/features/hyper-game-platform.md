# PDCA Plan: 하이퍼 게임 플랫폼 (Hyper Game Platform)

## 1. 개요 (Overview)
웹 브라우저에서 직접 실행 가능한 고성능 하이퍼 게임 플랫폼을 구축합니다.

## 2. 목표 (Goals)
- 웹 기반의 반응형 게임 로비 및 실행 환경 구축
- iframe을 통한 독립적인 게임 실행 환경 (샌드박스)
- 플랫폼-게임 간 실시간 데이터 통신 (점수 등)

## 3. 핵심 기능 (Key Features)
- **게임 로비**: 게임 목록 표시 및 선택
- **게임 플레이어**: iframe 컨테이너 및 상단 정보 바
- **상태 관리**: Zustand를 이용한 게임 목록 및 현재 점수 관리
- **통신 모듈**: PostMessage API 기반 이벤트 핸들러

## 4. 기술 스택 (Technical Stack)
- **Frontend**: React (TypeScript), Vite, Tailwind CSS v4, Zustand
- **Routing**: React Router DOM
- **Icons**: Lucide React

## 5. 성공 지표 (Success Metrics)
- Vite 기반 빌드 성공
- 샘플 게임 점수가 플랫폼 UI에 실시간 반영됨
- 반응형 레이아웃 정상 작동
