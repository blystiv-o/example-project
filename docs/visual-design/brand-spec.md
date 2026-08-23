# Expense Tracker Material Design 3 System

Система: Material Design 3 для компактного фінансового веб-продукту з MUI-компонентами, спокійними нейтралями та одним зеленим primary-акцентом.

```css
:root {
  --bg: oklch(97.6% 0.012 151);
  --surface: oklch(99.2% 0.006 151);
  --fg: oklch(24% 0.035 151);
  --muted: oklch(50% 0.028 151);
  --border: oklch(88% 0.018 151);
  --accent: oklch(46% 0.13 151);
}
```

Typography:
- Display/body: "Roboto Flex", "Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "Roboto Mono", "SFMono-Regular", Consolas, monospace

Posture rules:
- MD3 rounded shapes are allowed for containers and inputs; use them as product structure, not decorative cards.
- Finance values use mono numerals and clear positive/negative status colors.
- Use one primary green accent for selection and primary action; semantic colors stay reserved for budget status.
- Mobile screens prioritize current month balance, last expenses, and one create action.
- CRUD flows are full dialogs/drawers with validation states, not static mockups.
