import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/lib/queries";

/** Who the signed-in person is at work: job, department, panel and rights. */
export type Profile = {
  employee_id?: string;
  full_name: string;
  position: string;
  position_title?: string;
  department?: string;
  department_name?: string;
  panel: string;
  permissions: string[];
  is_admin: boolean;
};

export const profileQuery = queryOptions({
  queryKey: ["my_profile"],
  staleTime: 30_000,
  queryFn: async (): Promise<Profile | null> => {
    const { data, error } = await supabase.rpc("my_profile");
    if (error) throw error;
    return (data ?? null) as unknown as Profile | null;
  },
});

export const can = (profile: Profile | null | undefined, code: string) =>
  Boolean(
    profile &&
      (profile.is_admin ||
        profile.permissions?.includes("*") ||
        profile.permissions?.includes(code)),
  );

