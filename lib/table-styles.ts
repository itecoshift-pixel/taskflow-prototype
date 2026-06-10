/**
 * table-styles.ts
 *
 * Singleton fetch for /api/table-styles.
 * All components share one in-flight request and one cached result.
 * Zero duplicate requests regardless of how many components mount simultaneously.
 */

export interface TableStyles {
  th_bg: string;
  layout: string;
  td_text: string;
  th_text: string;
  table_bg: string;
  tfoot_bg: string;
  td_border: string;
  th_border: string;
  tr_border: string;
  td_padding: string;
  tfoot_text: string;
  th_padding: string;
  toolbar_bg: string;
  tr_hover_bg: string;
  table_border: string;
  table_shadow: string;
  td_font_size: string;
  tfoot_border: string;
  th_font_size: string;
  pagination_bg: string;
  tfoot_padding: string;
  th_font_weight: string;
  toolbar_border: string;
  toolbar_btn_bg: string;
  pagination_text: string;
  tfoot_font_size: string;
  toolbar_btn_text: string;
  toolbar_input_bg: string;
  pagination_border: string;
  pagination_radius: string;
  table_font_family: string;
  th_letter_spacing: string;
  toolbar_btn_border: string;
  toolbar_input_text: string;
  table_border_radius: string;
  pagination_active_bg: string;
  toolbar_input_border: string;
  pagination_active_text: string;
}

export const DEFAULT_TABLE_STYLES: TableStyles = {
  th_bg:                  "#f9fafb",
  layout:                 "datatable",
  td_text:                "#111827",
  th_text:                "#374151",
  table_bg:               "#ffffff",
  tfoot_bg:               "#ffffff",
  td_border:              "#f3f4f6",
  th_border:              "#e5e7eb",
  tr_border:              "#f3f4f6",
  td_padding:             "12",
  tfoot_text:             "#6b7280",
  th_padding:             "12",
  toolbar_bg:             "#f9fafb",
  tr_hover_bg:            "#f9fafb",
  table_border:           "#e5e7eb",
  table_shadow:           "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
  td_font_size:           "13",
  tfoot_border:           "#e5e7eb",
  th_font_size:           "12",
  pagination_bg:          "#ffffff",
  tfoot_padding:          "12",
  th_font_weight:         "600",
  toolbar_border:         "#e5e7eb",
  toolbar_btn_bg:         "#ffffff",
  pagination_text:        "#374151",
  tfoot_font_size:        "12",
  toolbar_btn_text:       "#374151",
  toolbar_input_bg:       "#ffffff",
  pagination_border:      "#d1d5db",
  pagination_radius:      "8",
  table_font_family:      "'Inter', 'Segoe UI', Arial, sans-serif",
  th_letter_spacing:      "0.01em",
  toolbar_btn_border:     "#d1d5db",
  toolbar_input_text:     "#374151",
  table_border_radius:    "16",
  pagination_active_bg:   "#3b82f6",
  toolbar_input_border:   "#d1d5db",
  pagination_active_text: "#ffffff",
};

// ── Module-level singleton ────────────────────────────────────────────────────
// One promise shared across all imports — only one HTTP request ever fires.
let _promise: Promise<TableStyles> | null = null;
let _cached: TableStyles | null = null;

export function getTableStyles(): Promise<TableStyles> {
  // Return cached result immediately
  if (_cached) return Promise.resolve(_cached);

  // Return the in-flight promise if already fetching
  if (_promise) return _promise;

  // First caller kicks off the fetch
  _promise = fetch("/api/table-styles")
    .then((res) => {
      if (!res.ok) throw new Error("table-styles fetch failed");
      return res.json();
    })
    .then((data) => {
      _cached = data?.table_styles
        ? { ...DEFAULT_TABLE_STYLES, ...data.table_styles }
        : DEFAULT_TABLE_STYLES;
      return _cached!;
    })
    .catch(() => {
      _promise = null; // allow retry on error
      return DEFAULT_TABLE_STYLES;
    });

  return _promise;
}

/** Call in tests or hot-reload scenarios to bust the cache. */
export function clearTableStylesCache() {
  _promise = null;
  _cached  = null;
}
