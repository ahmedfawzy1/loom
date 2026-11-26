import type { CmsUser } from "@loom/dto/models";
import { users } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

export const useUsers = () =>
  useQuery({ queryKey: userKeys.list(), queryFn: users.list });

/** Everyone's name and email, for filters — readable by every role, unlike the Users screen. */
export const useDirectory = () =>
  useQuery({
    queryKey: [...userKeys.all, "directory"] as const,
    queryFn: users.directory,
    staleTime: 5 * 60_000,
  });

export const useInviteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: users.invite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
};

export const useCreatePasswordLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: users.createPasswordLink,
    // The list shows when each person's link runs out
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: CmsUser["id"];
      role: CmsUser["role"];
    }) => users.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
};

export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: CmsUser["id"];
      status: CmsUser["status"];
    }) => users.updateStatus(userId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: CmsUser["id"]) => users.remove(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
};
