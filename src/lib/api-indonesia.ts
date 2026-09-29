/**
 * Klien apiindonesia.id — data publik Indonesia (wilayah, cuaca, hari libur).
 * API key disimpan di app_settings (diatur admin via UI Pengaturan),
 * fallback ke env API_INDONESIA_KEY.
 * Dokumentasi: https://docs.apiindonesia.id — auth: header x-api-key.
 */

import { getSetting } from "./app-settings";

export const API_INDONESIA_KEY_SETTING = "api_indonesia_key";

const BASE = "https://use.apiindonesia.id/api/v1";

export async function getApiIndonesiaKey(): Promise<string | null> {
  try {
    const fromDb = await getSetting(API_INDONESIA_KEY_SETTING);
    if (fromDb) return fromDb;
  } catch (err) {
    console.error("[api-indonesia] failed to read key from DB", err);
  }
  return process.env.API_INDONESIA_KEY || null;
}

/** GET dengan x-api-key; null bila key belum dipasang. */
async function apiGet<T>(path: string): Promise<T | null> {
  const key = await getApiIndonesiaKey();
  if (!key) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`apiindonesia ${path} -> HTTP ${res.status}`);
  }
  const json = (await res.json()) as { success?: boolean; data?: T };
  if (!json.success || json.data === undefined) {
    throw new Error(`apiindonesia ${path} -> respons tak valid`);
  }
  return json.data;
}

export interface ApiProvince {
  id: string;
  name: string;
}

export interface ApiRegency {
  id: string;
  name: string;
  province_id: string;
}

/**
 * Daftar provinsi (semua halaman). ~38 provinsi → 1 request (per_page 100).
 */
export async function fetchProvinces(): Promise<ApiProvince[]> {
  const data = await apiGet<ApiProvince[]>("/wilayah/provinsi?per_page=100");
  return data ?? [];
}

/**
 * Daftar kabupaten/kota satu provinsi (semua halaman yang relevan).
 */
export async function fetchRegencies(provinceId: string): Promise<ApiRegency[]> {
  const data = await apiGet<ApiRegency[]>(
    `/wilayah/kabupaten?provinsi_id=${encodeURIComponent(provinceId)}&per_page=100`,
  );
  return data ?? [];
}

export interface ApiWeatherRow {
  kotkab: string;
  datetime: string;
  weather_desc: string;
  temperature_c: number;
  humidity_percent: number;
  wind_speed: number;
}

/** Prakiraan cuaca per kabupaten/kota (BMKG, cache 6 jam di sisi API). */
export async function fetchWeather(regencyId: string): Promise<ApiWeatherRow[]> {
  const data = await apiGet<ApiWeatherRow[]>(
    `/cuaca?kabupaten_id=${encodeURIComponent(regencyId)}`,
  );
  return data ?? [];
}

export interface ApiHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** Hari libur nasional + cuti bersama per tahun (SKB 3 Menteri). */
export async function fetchHolidays(year: number): Promise<ApiHoliday[]> {
  const data = await apiGet<ApiHoliday[]>(`/libur?year=${year}`);
  return data ?? [];
}

/** Deskripsi cuaca dianggap buruk untuk panen bila mengandung kata ini. */
const BAD_WEATHER = ["hujan", "badai", "angin kencang", "petir"];

export function isBadWeather(desc: string): boolean {
  const d = desc.toLowerCase();
  return BAD_WEATHER.some((w) => d.includes(w));
}
