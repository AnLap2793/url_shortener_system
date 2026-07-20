---
title: URL Shortener System Design
status: final
created: 2026-07-19
updated: 2026-07-19
sources:
  - ../../prds/prd-url_shortener_system-2026-07-19/prd.md
colors:
  primary: '#1C5CAB'
  primary-foreground: '#FFFFFF'
  accent: '#0D366B'
  success: '#006300'
  warning: '#8A5700'
  danger: '#B42318'
  page: '#F9F9F7'
  surface: '#FCFCFB'
  ink: '#0B0B0B'
  ink-secondary: '#52514E'
  ink-muted: '#64635F'
  border: '#E1E0D9'
  chart-sequential-100: '#CDE2FB'
  chart-sequential-400: '#3987E5'
  chart-sequential-600: '#184F95'
  chart-series-1: '#2A78D6'
  chart-series-2: '#1BAF7A'
  chart-series-3: '#EDA100'
  chart-series-4: '#008300'
  chart-series-5: '#4A3AA7'
  chart-series-6: '#E34948'
  chart-series-7: '#E87BA4'
  chart-series-8: '#EB6834'
typography:
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: '16px'
    lineHeight: '1.5'
  heading:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontWeight: '650'
  metric:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontVariantNumeric: 'tabular-nums'
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
spacing:
  unit: '4px'
  card: '24px'
  section: '32px'
components:
  primary-button:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  metric-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
  focus-ring:
    color: '{colors.primary}'
    width: '2px'
    offset: '2px'
  chart:
    background: '{colors.surface}'
    sequential: '{colors.chart-sequential-400}'
    tableFallback: 'required'
    seriesIdentity: 'fixed-order color plus direct label or table; never status semantics'
---

## Brand & Style

**Calm Analytics**: sạch, đáng tin cậy, ưu tiên dữ liệu và thao tác campaign. Giao diện không dùng gradient, không dùng decoration để thay thế hierarchy, và không tạo cảm giác gamification. Primary blue hướng dẫn hành động; accent navy dùng cho active navigation và emphasis. Status colors chỉ biểu thị trạng thái, không dùng làm series chart.

MVP dùng light mode. Dark mode là phạm vi sau, tránh nhân đôi kiểm tra chart và state khi sản phẩm chưa có nhu cầu rõ.

## Colors

- `{colors.page}` là page plane; `{colors.surface}` là card/chart surface.
- `{colors.ink}` cho nội dung chính; `{colors.ink-secondary}` cho mô tả; `{colors.ink-muted}` cho axis/metadata.
- `{colors.primary}` chỉ cho primary action, link, active state và focus ring.
- `{colors.success}`, `{colors.warning}`, `{colors.danger}` luôn đi cùng icon hoặc nhãn; màu không mang ý nghĩa một mình.
- Chart trend dùng sequential blue `{colors.chart-sequential-100}` → `{colors.chart-sequential-600}`.
- Breakdown theo identity dùng categorical order `chart-series-1` đến `chart-series-8`. Không tạo hue thứ chín; nhóm phần còn lại vào `Other`.
- Palette categorical đã chạy validator; các slot aqua/yellow/pink dưới 3:1 trên light surface phải có label trực tiếp hoặc table view.

## Typography

System sans giúp dashboard đọc nhanh và không thêm dependency font. Heading dùng weight 650; body dùng 16px với line-height 1.5. Metric dùng tabular numerals để các KPI và cột số thẳng hàng. Không dùng display serif.

## Layout & Spacing

Desktop-first responsive web. Content width tối đa 1280px; sidebar 232px ở desktop; main content dùng grid 12 cột. Spacing theo bội số `{spacing.unit}`; card padding `{spacing.card}`; giữa section dùng `{spacing.section}`.

- Desktop ≥1024px: sidebar cố định, main dashboard 12-column.
- Tablet 768–1023px: sidebar thu gọn, chart grid giảm cột.
- Mobile <768px: sidebar thành drawer; KPI thành stack; bảng cho phép horizontal scroll; thao tác copy link luôn dễ chạm.

## Elevation & Depth

Ưu tiên border hairline `{colors.border}` và surface contrast nhẹ. Shadow chỉ dùng cho popover, dialog và drawer; không dùng shadow để tạo nhiều tầng card lồng nhau. Hover nâng nhẹ bằng border/outline, không đổi layout.

## Shapes

- Input/button: `{rounded.sm}` hoặc `{rounded.md}`.
- Card/chart: `{rounded.lg}`.
- Không dùng pill cho mọi component; pill chỉ dành cho status/badge.
- Focus ring luôn nhìn thấy và không bị cắt bởi overflow.

## Components

Mock composition references:

- [Dashboard analytics](mockups/dashboard-analytics.html)
- [Create Link](mockups/create-link.html)

Spines win on conflict with mockups.

- **App shell**: sidebar với Dashboard, Links, Account; mobile dùng drawer.
- **Primary button**: một hành động chính mỗi surface; dùng `{colors.primary}`.
- **Metric card**: label, value, optional delta/sparkline; không dùng chart nếu chỉ có một số hiện tại.
- **Filter bar**: một hàng trên chart; date range trước, dimension filters sau; filter áp dụng cho toàn bộ dashboard.
- **Chart card**: title, data visualization, direct labels khi cần, table fallback, tooltip cho hover và keyboard focus.
- **Link table**: short path, destination, created date, total clicks, actions; không cắt mất short path.
- **Toast/banner**: feedback sau create/edit/delete/refresh; warning không chặn khi UTM casing/spaces không chuẩn.
- **Dialog**: delete confirmation và account-linking guidance; không stack quá một modal.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Dẫn bằng KPI, trend, rồi breakdown | Dồn mọi biểu đồ lên cùng một màn hình không hierarchy |
| Hiển thị `Last updated`, `Estimated`, `unknown` | Giả định location/referrer luôn chính xác |
| Có table fallback cho chart | Dùng màu chart làm tín hiệu duy nhất |
| Dùng một primary action rõ mỗi surface | Cho nhiều nút primary cạnh tranh |
| Giữ short path dễ đọc và copy được | Dùng URL dài làm label chính |
| Dùng border/subtle depth | Gradient, glassmorphism, decoration không có nhiệm vụ |
