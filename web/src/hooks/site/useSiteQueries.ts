import type {
  CreateSiteRequestDto,
  UpdateSiteLanguageRequestDto,
  UpdateSiteRequestDto,
} from "@loom/dto";
import type { Site } from "@loom/dto/models";
import { sites } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const siteKeys = {
  all: ["sites"] as const,
  list: () => [...siteKeys.all, "list"] as const,
};

export const useSites = () =>
  useQuery({ queryKey: siteKeys.list(), queryFn: sites.list });

export const useCreateSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateSiteRequestDto) => sites.create(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useDeleteSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      confirmName,
    }: {
      siteId: Site["id"];
      confirmName: Site["name"];
    }) => sites.remove(siteId, confirmName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useUpdateSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      args,
    }: {
      siteId: Site["id"];
      args: UpdateSiteRequestDto;
    }) => sites.update(siteId, args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useUpdateProtectedTerms = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      protectedTerms,
    }: {
      siteId: Site["id"];
      protectedTerms: Site["protectedTerms"];
    }) => sites.updateProtectedTerms(siteId, protectedTerms),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useUpdateSiteLanguages = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      languages,
    }: {
      siteId: Site["id"];
      languages: UpdateSiteLanguageRequestDto[];
    }) => sites.updateLanguages(siteId, languages),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};
