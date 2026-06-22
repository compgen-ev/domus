declare module '@openhistoricalmap/maplibre-gl-dates' {
  import { Map } from 'maplibre-gl';

  /**
   * Filters the map's features by a date.
   * @param map The MapLibre map object to filter
   * @param date The date to filter by (Date object or date string in YYYY, YYYY-MM, or YYYY-MM-DD format)
   */
  export function filterByDate(map: Map, date: Date | string): void;

  export interface DateRange {
    startDate: Date;
    startDecimalYear: number;
    startISODate: string;
    endDate: Date;
    endDecimalYear: number;
    endISODate: string;
  }

  export function dateRangeFromDate(date: Date | string): DateRange | undefined;
  export function decimalYearFromDate(date: Date): number;
  export function dateRangeFromISODate(isoDate: string): DateRange | undefined;
}
