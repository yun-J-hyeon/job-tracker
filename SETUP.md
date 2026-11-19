---
작성자:
  - 윤지현
  - Claude Code
checked: false
---

# 배포·알림 설정 순서

코드는 완성돼 있다. 아래는 **직접** 해야 하는 작업이다.

## 1. 저장소 만들기

1. GitHub 로그인 → 우측 위 `+` → **New repository**
2. 이름 `job-tracker`, **Public**, README 체크 해제 → Create
3. 이 폴더(`job-tracker/`)를 올린다.

```powershell
cd D:\YunJH_202337028\job-tracker
git init -b main
git add .
git commit -m "첫 배포"
git remote add origin https://github.com/내계정/job-tracker.git
git push -u origin main
```

## 2. Pages 켜기

1. 저장소 → **Settings** → **Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / `/ (root)` → Save
4. 1~2분 뒤 `https://내계정.github.io/job-tracker/` 접속

## 3. PC에서 저장 연결 (토큰)

1. GitHub 우측 위 프로필 → Settings → Developer settings
2. Personal access tokens → **Fine-grained tokens** → Generate
3. Repository access: `job-tracker` **하나만**
4. Permissions → Contents: **Read and write**
5. 사이트 → 설정 탭 → 저장소 `내계정/job-tracker`, 토큰 붙여넣기 → 연결 저장
6. 토큰은 이 PC 브라우저에만 저장된다. 채팅이나 파일에 적지 않는다.

## 4. 폰에 설치 (Android)

1. 폰 Chrome으로 사이트 접속
2. ⋮ 메뉴 → **홈 화면에 추가** (또는 설치)

## 5. 알림 켜기

1. PC에서 키 생성 (한 번만)

```powershell
npx web-push generate-vapid-keys
```

2. **Public Key**를 `data.json`의 `settings`에 추가한다.

```json
"vapidPublicKey": "여기에 Public Key"
```

3. 저장소 → Settings → Secrets and variables → Actions → New secret
   - `VAPID_PUBLIC`: Public Key
   - `VAPID_PRIVATE`: Private Key (**절대 공개 금지**)
   - `VAPID_SUBJECT`: `mailto:내이메일`
4. 폰 앱 → 설정 → **이 기기에서 알림 켜기** → 허용
5. 화면에 나온 JSON을 복사해 Secret `PUSH_SUBSCRIPTION`으로 등록
6. 저장소 → Actions → remind → **Run workflow**로 시험 발송

## 알아둘 점

- 알림은 매일 20시, 22시. 그날 기록이 있으면 오지 않는다.
- GitHub Actions는 몇 분 늦을 수 있다.
- D-day와 취업 활동은 이 PC에만 저장된다. `data.json`에 안 올라간다.
- 저장 후 폰 반영은 1~2분 걸린다.
- 60일간 저장소 활동이 없으면 GitHub이 예약 실행을 멈춘다. 기록 저장이 곧 활동이다.
