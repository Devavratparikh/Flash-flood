/** react-query hooks over the himvaah API. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { byId, rankByScore, type Area, type District } from "./types";

export const qk = {
  overview: ["overview"] as const,
  districts: ["districts"] as const,
  areas: ["areas"] as const,
  area: (id: string) => ["area", id] as const,
  areaScores: (id: string, h: string) => ["area", id, "scores", h] as const,
  reports: (areaId?: string) => ["reports", areaId ?? "all"] as const,
  broadcasts: ["broadcasts"] as const,
  history: (districtId: string, from: string) => ["history", districtId, from] as const,
  insights: ["insights"] as const,
  preferences: ["preferences"] as const,
};

const LIVE_REFETCH = 60_000;

export function useOverview() {
  const q = useQuery({
    queryKey: qk.overview,
    queryFn: api.overview,
    refetchInterval: LIVE_REFETCH,
  });
  return {
    ...q,
    stats: q.data?.stats,
    areas: q.data?.areas ?? [],
    ranked: q.data?.areas ?? [], // backend already returns score DESC
  };
}

export function useDistricts() {
  const q = useQuery({ queryKey: qk.districts, queryFn: api.districts, staleTime: 5 * 60_000 });
  const districts = q.data ?? [];
  return {
    ...q,
    districts,
    districtById: (id?: string) => byId<District>(districts, id),
  };
}

export function useAreas() {
  const q = useQuery({ queryKey: qk.areas, queryFn: api.areas, refetchInterval: LIVE_REFETCH });
  const areas = q.data ?? [];
  return {
    ...q,
    areas,
    ranked: rankByScore(areas),
    areaById: (id?: string) => byId<Area>(areas, id),
    areasByDistrict: (districtId: string) => areas.filter((a) => a.districtId === districtId),
  };
}

export function useArea(id: string) {
  return useQuery({
    queryKey: qk.area(id),
    queryFn: () => api.area(id),
    refetchInterval: LIVE_REFETCH,
  });
}

export function useAreaScores(id: string, horizon = "nowcast") {
  return useQuery({
    queryKey: qk.areaScores(id, horizon),
    queryFn: () => api.areaScores(id, horizon),
  });
}

export function useReports(areaId?: string) {
  return useQuery({
    queryKey: qk.reports(areaId),
    queryFn: () => api.reports(areaId),
    refetchInterval: LIVE_REFETCH,
  });
}

export function useBroadcasts() {
  return useQuery({
    queryKey: qk.broadcasts,
    queryFn: api.broadcasts,
    refetchInterval: LIVE_REFETCH,
  });
}

export function useHistory(districtId = "all", from = "") {
  return useQuery({
    queryKey: qk.history(districtId, from),
    queryFn: () => api.history(districtId, from || undefined),
  });
}

export function useInsights() {
  return useQuery({ queryKey: qk.insights, queryFn: api.insights, staleTime: 60_000 });
}

export function usePreferences(enabled: boolean) {
  return useQuery({ queryKey: qk.preferences, queryFn: api.preferences, enabled });
}

/* ------------------------------ mutations ------------------------------ */

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.submitReport(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useVerifyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      api.verifyReport(id, verified),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.broadcasts }),
  });
}

export function usePushReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      areaId,
      ...payload
    }: {
      areaId: string;
      rainfall1h: number;
      soilSaturation: number;
      reservoirLevel?: number;
      damStatus?: string;
    }) => api.pushReading(areaId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.overview });
      qc.invalidateQueries({ queryKey: qk.areas });
      qc.invalidateQueries({ queryKey: qk.area(vars.areaId) });
    },
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: (data) => qc.setQueryData(qk.preferences, data),
  });
}
