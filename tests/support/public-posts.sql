INSERT OR IGNORE INTO categories (id, name) VALUES (1, '웹 개발');
INSERT OR IGNORE INTO categories (id, name) VALUES (2, '비공개 주제');

WITH RECURSIVE numbers(n) AS (
  VALUES (1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 21
)
INSERT OR IGNORE INTO posts (id, title, body, category_id, status, published_at)
SELECT
  printf('01900000-0000-7000-8000-%012d', n),
  printf('발행 글 %02d', n),
  '## 본문 예제' || char(10, 10) ||
    '```text' || char(10) || printf('%0120d', n) || char(10) || '```' ||
    char(10, 10) || '| 긴 헤더 | 값 |' || char(10) || '| --- | --- |' ||
    char(10) || '| ' || printf('%0120d', n) || ' | 데이터 |',
  1,
  'published',
  1700000000000
FROM numbers;

INSERT OR IGNORE INTO posts (id, title, body, category_id, status, published_at, deleted_at)
VALUES
  ('01900000-0000-7000-8000-000000000022', '초안 제목', '', 2, 'draft', null, null),
  ('01900000-0000-7000-8000-000000000023', '보관 제목', '보관 본문', 1, 'archived', 1700000000000, null),
  ('01900000-0000-7000-8000-000000000024', '휴지통 제목', '휴지통 본문', 1, 'published', 1700000000000, 1700000000000);

INSERT OR IGNORE INTO tags (post_id, name)
VALUES
  ('01900000-0000-7000-8000-000000000001', '스벨트'),
  ('01900000-0000-7000-8000-000000000021', '스벨트'),
  ('01900000-0000-7000-8000-000000000022', '숨은태그'),
  ('01900000-0000-7000-8000-000000000023', '스벨트');
