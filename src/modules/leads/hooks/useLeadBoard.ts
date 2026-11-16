"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { queryKeys } from "@core/query";
import type { LeadStageKey } from "../constants/STAGE";
import type { getLeadBoard } from "../services/board.service";

export function useLeadBoardQuery() { return useQuery<Awaited<ReturnType<typeof getLeadBoard>>>({ queryKey: queryKeys.leads.board(), queryFn: () => apiFetch("/api/leads/board") }); }
export function useLeadColumnMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (data: { id: string; stage: LeadStageKey; column: string }) => apiFetch("/api/leads/board", { method: "PATCH", json: data }), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.leads.all }) });
}
