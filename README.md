# All of IT

<br />
<br />

## 동기: Motivation

배움이나 삶 속에서는 특정 순간에만 느낄 수 있는 깊은 깨달음이 있습니다.

하지만 기억에 의존하여 그것들을 흡수하거나 표현하기에는 아쉽게 손실되는 부분이 분명 존재합니다.

<br />

> _공부한 내용, 문제 상황과 해결 과정들 뿐만 아니라 한 인간으로서 지니는 가치관과 이를 통해 세상을 바라보는 시선까지_

<br />

이 모든 것들을 기록하기 위한 공간을 직접 구현하고자 하였고 해당 공간의 이름이자 Identity를 **_All of IT_** 으로 하였습니다.

<br />
<br />

## 로그: Logs

**_2023.12.09_**

- 프로젝트 생성 및 환경 설정 :point_right: [@aed3f1a](https://github.com/herokwon/blog/commit/aed3f1aa000d4d3e80f9174127068c7071897f04)

<br />

**_2023.12.10_**

- navigation 추가 :point_right: [@9622a7b](https://github.com/herokwon/blog/commit/9622a7ba8a764d44d6effe94a7250aaa847f2195)

<br />

**_2023.12.11_**

- darkmode 적용 :point_right: [@dea0a3d](https://github.com/herokwon/blog/commit/dea0a3d16e32deca9e42323d442d586b94c51d3c)
- Button 컴포넌트화 :point_right: [@8116373](https://github.com/herokwon/blog/commit/81163733cd5270307cb4225de2cc6e133f1b501b)

<br />

**_2023.12.12 ~ 13_**

- Notion Data Fetch API 추가
  - Articles :point_right: [@2627717](https://github.com/herokwon/blog/commit/2627717eb79a8c476481ad27c235c530af1d1959)
  - Summary :point_right: [@b37a974](https://github.com/herokwon/blog/commit/b37a974fbec62286bb64452abf6c340befa24472)
  - Categories & Tags :point_right: [@f658b32](https://github.com/herokwon/blog/commit/f658b325807eb01ddf81f4bf6f637ee554ee1dd2)
  - Block(s) :point_right: [@432977e](https://github.com/herokwon/blog/commit/432977e8525c5d773a9b7fffe87e9344f5056edc)
    - 참고 : [API Reference | Notion Developers](https://developers.notion.so/reference)

<br />

**_2023.12.14_**

- Database Query를 위한 매개변수 타입 정의 :point_right: [@c176e87](https://github.com/herokwon/blog/commit/c176e8752db83566afa8116a9fe0ebcc45d71c77)
  - TypeScript Omit(유틸리티 타입) → Notion SDK 타입에서 특정 Key를 생략한 타입 정의 및 API 적용
    - 참고 : [TypeScript: Documentation - Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

<br />

**_2023.12.15_**

- Articles (list & container) Component 추가 :point_right: [@dc582f6](https://github.com/herokwon/blog/commit/dc582f69093cafdcf44a5c6d5051969b4349e8b4)
  - Notion API 응답 데이터 타입을 위한 새로운 타입 정의
    - 참고 : [TypeScript: Documentation - Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
  - Notion API 응답 데이터 활용을 위한 유틸리티 함수 추가
  - 외부 이미지 사용을 위한 Next.js 환경 설정 업데이트
    - 참고 : [Components: \<Image> | Next.js](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns)
- library 폴더 업데이트 :point_right: [@b1b539f](https://github.com/herokwon/blog/commit/b1b539fa2828d80b97bf349a61121d64ff19fa20)
  - `lib/data` : 데이터, 상수 등
  - `lib/functions` : 주요 기능 관련 함수
  - `lib/utils`: 유틸리티 함수
- Node.js 환경에 따른 baseUrl 설정 :point_right: [@558e44e](https://github.com/herokwon/blog/commit/558e44eff04e6a7e2a49c6f18ee95909dc4bddab)

<br />

**_2023.12.16 ~ 17_**

- Page-Header 추가 :point_right: [@74336da](https://github.com/herokwon/blog/commit/74336da1ce1000ae4783e32bd1c67c01cd32f3d7)
  - Posts 카테고리 일부 변경 (성장 → 회고)
  - 이미지 파일 추가

<br />

**_2023.12.18_**

- Sidebar 추가 :point_right: [@6e3b6b5](https://github.com/herokwon/blog/commit/6e3b6b59a49698826537ef9a22b8c4a8012ecd31)

<br />

**_2023.12.19_**

- articles 관련 컴포넌트 그룹화 (`components/articles`) :point_right: [@630e671](https://github.com/herokwon/blog/commit/630e671c9b4a766652d6ca2cec400fb43ded8c49)
- Catebory Button Component 추가 :point_right: [@24e2651](https://github.com/herokwon/blog/commit/24e26513760ae78b1669014f3737608a49eaf1b6)
- Article Category 상수 관리 방식 변경 (**_object_** → **_const assertion_**) :point_right: [@286a49b](https://github.com/herokwon/blog/commit/286a49b1c1d3119b30c1a8e19952869899d1ac14)

<br />

**_2023.12.20_**

- External Image Rendering hook 추가 :point_right: [@6e1ee24](https://github.com/herokwon/blog/commit/6e1ee24fe4a9bc1bff7ea381ce19b5737b9e577c)
  - Notion 및 외부 이미지 렌더링 & 리렌더링(유효기간 만료 등) 상태 관리
- Loading UI - Spinner 추가 :point_right: [@9fbf115](https://github.com/herokwon/blog/commit/9fbf115b8ac4ee78c6ea3dd3e69eda03cbb53446)

<br />

**_2023.12.21_**

- Read more 버튼이 있는 infinite scroll 구현 :point_right: [@8fe17c0](https://github.com/herokwon/blog/commit/8fe17c098ece3b24cdd6f29c58c1840fea859e16)
- Article-Content 페이지 추가
  - 페이지 생성 :point_right: [@893b1dd](https://github.com/herokwon/blog/commit/893b1dd6a0d0097cb8fbe2d844084d24ccc3f8f8)
  - 데이터 적용 :point_right: [@cd43b8e](https://github.com/herokwon/blog/commit/cd43b8e97539fdbd747e150c1c05a4293eac8874)
- Article-Content 페이지 Page-Header 적용 :point_right: [@20f9a8c](https://github.com/herokwon/blog/commit/20f9a8c663eb2ca4b1f14fbdc98f7ff699aabd48)

<br />

**_2023.12.22_**

- Typescript 설정 업데이트 - **_stictNullChecks_** :point_right: [@b601ed1](https://github.com/herokwon/blog/commit/b601ed1304e7bd56584cf0defc139f27699736ad)
  - 참고 : [TypeScript: TSConfig Reference - Docs on every TSConfig option](https://www.typescriptlang.org/tsconfig#strictNullChecks)

<br />

**_2023.12.23_**

- API Routes → Server Actions 적용 :point_right: [@0afd79f](https://github.com/herokwon/blog/commit/0afd79fcf2f9198753d4ea2ee2435ffc81973edf)
- Module Import 구분 (internal / external) :point_right: [@3f0c9ba](https://github.com/herokwon/blog/commit/3f0c9ba12abcf246a99da976bab7b0490ba3be7a)
- Next.js 환경 설정 업데이트 - `images/srcSet` 설정 :point_right: [@7d0659c](https://github.com/herokwon/blog/commit/7d0659ce14bb2bde7d216f68c3a800d356b9f42d)
- Image-Header Component 추가 :point_right: [@6df929f](https://github.com/herokwon/blog/commit/6df929f710809f5fbf98428d62a4f19ed176e4bb)
  - Page-Header 내 이미지 렌더링을 위한 리펙토링

<br />

**_2023.12.24_**

- Normal Text Blocks 추가 :point_right: [@d5377dc](https://github.com/herokwon/blog/commit/d5377dc247452b4269b29203953fca30d72abc15)
  - `Heading`, `Paragraph`, `RichText`, `Quote`

<br />

**_2023.12.25_**

- Specific Text Blocks 추가 :point_right: [@d89f70e](https://github.com/herokwon/blog/commit/d89f70eba4414a897220de36786f77e1b3a7833b)
  - `Callout`, `Code`, `Column`, `ColumnList`, `Equation`, `List(bulleted & numbered)`, `Table`, `TableRow`, `Toggle`
  - Text Style Library 추가
    - 참고 : [**`prismjs`**](https://github.com/Prismjs/Prism) & [**`katex`**](https://github.com/katex/katex)

<br />

**_2023.12.26_**

- Content Blocks Folder Segmentation :point_right: [@05aa5f4](https://github.com/herokwon/blog/commit/05aa5f49ed194de52fa301305fafa1be689e124b)
- Media Blocks 추가 :point_right: [@e16ca46](https://github.com/herokwon/blog/commit/e16ca46578d828d5d346964b5bac2630187ed0ea)
  - `Image`, `Video`
  - sharp 라이브러리 추가
    - 참고 : [sharp - High performance Node.js image processing](https://sharp.pixelplumbing.com/)

<br />
<br />

## 기술: Skills

> 언어 (Language)

[<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">](https://www.typescriptlang.org/)

<br />

> 프레임워크 (Framework)

[<img src="https://img.shields.io/badge/NextJS-000000?style=for-the-badge&logo=next.js&logoColor=white">](https://nextjs.org/)
[<img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white">](https://tailwindcss.com/)

<br />

> 번들러(Bundler)

[<img src="https://img.shields.io/badge/Turbopack-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMzguNjg2OCAzNi42OTgzQzM3LjU1NTkgMzYuNjk4MyAzNi42MzkxIDM3LjYxNTEgMzYuNjM5MSAzOC43NDU5VjYxLjUyMDJDMzYuNjM5MSA2Mi42NTEgMzcuNTU1OSA2My41Njc4IDM4LjY4NjggNjMuNTY3OEg2MS40NjFDNjIuNTkxOSA2My41Njc4IDYzLjUwODYgNjIuNjUxIDYzLjUwODYgNjEuNTIwMlYzOC43NDU5QzYzLjUwODYgMzcuNjE1MSA2Mi41OTE5IDM2LjY5ODMgNjEuNDYxIDM2LjY5ODNIMzguNjg2OFpNMjIuMjU5IDIwLjQ0MjZDMjEuMjIzMiAyMC40NDI2IDIwLjM4MzQgMjEuMjgyMyAyMC4zODM0IDIyLjMxODJWNzcuOTQ3OUMyMC4zODM0IDc4Ljk4MzggMjEuMjIzMiA3OS44MjM1IDIyLjI1OSA3OS44MjM1SDc3Ljg4ODdDNzguOTI0NiA3OS44MjM1IDc5Ljc2NDMgNzguOTgzOCA3OS43NjQzIDc3Ljk0NzlWMjIuMzE4MkM3OS43NjQzIDIxLjI4MjMgNzguOTI0NiAyMC40NDI2IDc3Ljg4ODcgMjAuNDQyNkgyMi4yNTlaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMCA1MS4wNjM4Vjg3LjIzNEMwIDg5LjY2MDkgMC42NzcxNjcgOTEuOTI5NSAxLjg1Mjg2IDkzLjg2MTRMMTQuODkzNiA4MC44MjA2VjUxLjA2MzhIMFoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yNzU4XzEzODQ4KSIvPgo8cGF0aCBkPSJNNS45NDY0NCA5OC4wMjc4TDE4Ljg3NjUgODUuMDk3OEMxOC45NjY2IDg1LjEwMzUgMTkuMDU3NCA4NS4xMDY0IDE5LjE0ODkgODUuMTA2NEg0Ny42NDAyVjEwMEgxMi43NjZDMTAuMjU4MiAxMDAgNy45MTkzMSA5OS4yNzY5IDUuOTQ2NDQgOTguMDI3OFoiIGZpbGw9InVybCgjcGFpbnQxX2xpbmVhcl8yNzU4XzEzODQ4KSIvPgo8cGF0aCBkPSJNNTMuNDgxIDEwMEg4Ny4yMzRDOTQuMjg0NSAxMDAgMTAwIDk0LjI4NDUgMTAwIDg3LjIzNFYxMi43NjZDMTAwIDUuNzE1NTEgOTQuMjg0NSAwIDg3LjIzNCAwSDUxLjA2MzhWMTQuODkzNkg4MC44NTExQzgzLjIwMTIgMTQuODkzNiA4NS4xMDY0IDE2Ljc5ODggODUuMTA2NCAxOS4xNDg5VjgwLjg1MTFDODUuMTA2NCA4My4yMDEyIDgzLjIwMTIgODUuMTA2NCA4MC44NTExIDg1LjEwNjRINTMuNDgxVjEwMFoiIGZpbGw9InVybCgjcGFpbnQyX2xpbmVhcl8yNzU4XzEzODQ4KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzI3NThfMTM4NDgiIHgxPSI1NC45MTY3IiB5MT0iNy4wMzEyNSIgeDI9IjUuNjk5MzYiIHkyPSI1NS45MTQ4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiMwMDk2RkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkYxRTU2Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl8yNzU4XzEzODQ4IiB4MT0iNTQuOTE2NyIgeTE9IjcuMDMxMjUiIHgyPSI1LjY5OTM2IiB5Mj0iNTUuOTE0OCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMDA5NkZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZGMUU1NiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50Ml9saW5lYXJfMjc1OF8xMzg0OCIgeDE9IjU0LjkxNjciIHkxPSI3LjAzMTI1IiB4Mj0iNS42OTkzNiIgeTI9IjU1LjkxNDgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzAwOTZGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNGRjFFNTYiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K&logoColor=white">](https://turbo.build/pack)

<br />

> 데이터베이스 (Database)

[<img src="https://img.shields.io/badge/Notion-000000?style=for-the-badge&logo=notion&logoColor=white">](https://notion.so/)

<br />

> 배포 (Deploy)

[<img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white">](https://vercel.com/)

<br />

> 기타 (.etc)

[<img src="https://img.shields.io/badge/Lucide-FFFFFF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZwogIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICB3aWR0aD0iMjQiCiAgaGVpZ2h0PSIyNCIKICB2aWV3Qm94PSIwIDAgMjQgMjQiCiAgZmlsbD0ibm9uZSIKICBzdHJva2U9ImN1cnJlbnRDb2xvciIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCiAgaWQ9Imx1Y2lkZS1sb2dvIgo+CiAgPHBhdGggZD0iTTE0IDEyQzE0IDkuNzkwODYgMTIuMjA5MSA4IDEwIDhDNy43OTA4NiA4IDYgOS43OTA4NiA2IDEyQzYgMTYuNDE4MyA5LjU4MTcyIDIwIDE0IDIwQzE4LjQxODMgMjAgMjIgMTYuNDE4MyAyMiAxMkMyMiA4LjQ0NiAyMC40NTUgNS4yNTI4NSAxOCAzLjA1NTU3IiBzdHJva2U9IiMyRDM3NDgiIC8+CiAgPHBhdGggZD0iTTEwIDEyQzEwIDE0LjIwOTEgMTEuNzkwOSAxNiAxNCAxNkMxNi4yMDkxIDE2IDE4IDE0LjIwOTEgMTggMTJDMTggNy41ODE3MiAxNC40MTgzIDQgMTAgNEM1LjU4MTcyIDQgMiA3LjU4MTcyIDIgMTJDMiAxNS41ODQxIDMuNTcxMjcgMTguODAxMiA2LjA2MjUzIDIxIiBzdHJva2U9IiNGNTY1NjUiIC8+Cjwvc3ZnPgo=">](https://lucide.dev/)

<br />
<br />
