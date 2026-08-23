export type { Branch } from "@/lib/types/dashboard";

/** Form data for creating/editing a branch (T-09 branch management). */
export interface BranchFormData {
  name: string;
  address: string;
  phone: string; // "" = not provided
  branchManagerId: string; // "" = unassigned
  isActive: boolean;
}
